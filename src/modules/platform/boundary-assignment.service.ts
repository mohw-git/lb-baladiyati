import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BoundarySourceImportStatus,
  MunicipalityBoundarySourceType,
  Prisma,
} from '@prisma/client';
import {
  boundaryBounds,
  mergeBoundaryGeometries,
  normalizeBoundaryGeoJson,
} from '../../core/geo/geojson-boundary.util';
import { findBoundaryOverlaps } from '../../core/geo/geojson-boundary-overlap.util';
import type { GeoJsonGeometry } from '../../core/geo/geojson-location.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BoundarySourceImportService } from './boundary-source-import.service';
import { UpdateBoundaryAssignmentsDto } from './dto/boundary-source.dto';
import { PlatformBoundaryService } from './platform-boundary.service';

export type AssignmentConflict = {
  featureId: string;
  featureKey: string;
  adm3Name: string;
  currentMunicipalityId: string;
  currentMunicipalityName: string;
};

@Injectable()
export class BoundaryAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: BoundarySourceImportService,
    private readonly boundaryService: PlatformBoundaryService,
  ) {}

  async getWorkspace() {
    const pendingImport = await this.importService.getPendingImport();
    const activeImport = await this.importService.getActiveImport();

    const municipalities = await this.prisma.municipality.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        code: true,
        boundaryColor: true,
        boundary: {
          select: {
            isActive: true,
            sourceType: true,
            sourceImportId: true,
            lastGeneratedAt: true,
            geojson: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let assignments: Array<{
      id: string;
      featureId: string;
      municipalityId: string;
      featureKey: string;
      adm3Name: string;
      adm3Pcode: string;
    }> = [];

    let unassignedFeatureCount = 0;
    let conflictCount = 0;

    if (activeImport) {
      const activeRows = await this.prisma.boundarySourceAssignment.findMany({
        where: { revokedAt: null, feature: { importId: activeImport.id } },
        include: {
          feature: {
            select: {
              featureKey: true,
              adm3Name: true,
              adm3Pcode: true,
            },
          },
        },
      });

      assignments = activeRows.map((a) => ({
        id: a.id,
        featureId: a.featureId,
        municipalityId: a.municipalityId,
        featureKey: a.feature.featureKey,
        adm3Name: a.feature.adm3Name,
        adm3Pcode: a.feature.adm3Pcode,
      }));

      const assignedFeatureIds = new Set(activeRows.map((a) => a.featureId));
      const totalFeatures = activeImport.featureCount;
      unassignedFeatureCount = Math.max(0, totalFeatures - assignedFeatureIds.size);

      const dupCheck = await this.prisma.boundarySourceAssignment.groupBy({
        by: ['featureId'],
        where: { revokedAt: null, feature: { importId: activeImport.id } },
        _count: { featureId: true },
      });
      conflictCount = dupCheck.filter((g) => g._count.featureId > 1).length;
    }

    const configured = municipalities.filter((m) => m.boundary?.isActive).length;
    const missing = municipalities.length - configured;

    return {
      activeImport,
      pendingImport,
      municipalities: municipalities.map((m) => ({
        id: m.id,
        name: m.name,
        nameAr: m.nameAr,
        nameFr: m.nameFr,
        code: m.code,
        boundaryColor: m.boundaryColor,
        configured: Boolean(m.boundary?.isActive),
        sourceType: m.boundary?.sourceType ?? null,
        sourceImportId: m.boundary?.sourceImportId ?? null,
        lastGeneratedAt: m.boundary?.lastGeneratedAt?.toISOString() ?? null,
        assignedFeatureCount: assignments.filter((a) => a.municipalityId === m.id).length,
      })),
      assignments,
      boundaries: municipalities
        .filter((m) => m.boundary?.isActive && m.boundary.geojson)
        .map((m) => ({
          municipalityId: m.id,
          name: m.name,
          code: m.code,
          sourceType: m.boundary!.sourceType,
          geojson: m.boundary!.geojson as GeoJsonGeometry,
          bounds: boundaryBounds(m.boundary!.geojson as GeoJsonGeometry),
        })),
      stats: {
        configured,
        missing,
        unassignedFeatureCount,
        conflictCount,
      },
    };
  }

  async updateBoundaryColor(municipalityId: string, boundaryColor: string) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!muni) throw new NotFoundException('Municipality not found');
    return this.prisma.municipality.update({
      where: { id: municipalityId },
      data: { boundaryColor },
      select: { id: true, boundaryColor: true },
    });
  }

  private async findActiveAssignmentForFeature(featureId: string) {
    return this.prisma.boundarySourceAssignment.findFirst({
      where: { featureId, revokedAt: null },
      include: {
        municipality: { select: { id: true, name: true } },
        feature: { select: { featureKey: true, adm3Name: true } },
      },
    });
  }

  async updateAssignments(
    dto: UpdateBoundaryAssignmentsDto,
    actorId: string,
  ) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id: dto.municipalityId },
      include: { boundary: true },
    });
    if (!muni) throw new NotFoundException('Municipality not found');

    if (dto.mode === 'unassign') {
      return this.unassignFeatures(dto.municipalityId, dto.featureIds, actorId);
    }

    return this.assignFeatures(dto, actorId, muni);
  }

  private async assignFeatures(
    dto: UpdateBoundaryAssignmentsDto,
    actorId: string,
    muni: {
      id: string;
      name: string;
      boundary: {
        sourceType: MunicipalityBoundarySourceType;
        isActive: boolean;
      } | null;
    },
  ) {
    const activeImport = await this.importService.getActiveImport();
    if (!activeImport) {
      throw new BadRequestException('No active boundary source import');
    }

    if (
      muni.boundary?.isActive &&
      muni.boundary.sourceType === MunicipalityBoundarySourceType.MANUAL_GEOJSON &&
      !dto.switchToSourceBased
    ) {
      throw new ConflictException({
        code: 'MANUAL_BOUNDARY_SWITCH_REQUIRED',
        message:
          'This municipality has a manual GeoJSON boundary. Confirm switchToSourceBased to assign Admin3 areas.',
      });
    }

    const features = await this.prisma.boundarySourceFeature.findMany({
      where: {
        id: { in: dto.featureIds },
        importId: activeImport.id,
      },
    });
    if (features.length !== dto.featureIds.length) {
      throw new BadRequestException('One or more features are invalid for the active import');
    }

    const conflicts: AssignmentConflict[] = [];
    for (const feature of features) {
      const existing = await this.findActiveAssignmentForFeature(feature.id);
      if (
        existing &&
        existing.municipalityId !== dto.municipalityId
      ) {
        conflicts.push({
          featureId: feature.id,
          featureKey: feature.featureKey,
          adm3Name: feature.adm3Name,
          currentMunicipalityId: existing.municipalityId,
          currentMunicipalityName: existing.municipality.name,
        });
      }
    }

    if (conflicts.length && !dto.forceReassign) {
      throw new ConflictException({
        code: 'FEATURE_ASSIGNMENT_CONFLICT',
        message: 'One or more areas are already assigned to another municipality',
        conflicts,
      });
    }

    const affectedMunicipalityIds = new Set<string>([dto.municipalityId]);

    await this.prisma.$transaction(async (tx) => {
      for (const feature of features) {
        const existing = await tx.boundarySourceAssignment.findFirst({
          where: { featureId: feature.id, revokedAt: null },
        });
        if (existing) {
          if (existing.municipalityId === dto.municipalityId) continue;
          affectedMunicipalityIds.add(existing.municipalityId);
          await tx.boundarySourceAssignment.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
          });
        }

        const stillActive = await tx.boundarySourceAssignment.findFirst({
          where: { featureId: feature.id, revokedAt: null },
        });
        if (stillActive) {
          throw new ConflictException('Active assignment already exists for feature');
        }

        await tx.boundarySourceAssignment.create({
          data: {
            featureId: feature.id,
            municipalityId: dto.municipalityId,
            assignedByUserId: actorId,
          },
        });
      }
    });

    const regenResults: Array<{ municipalityId: string; overlaps: unknown[] }> = [];
    for (const municipalityId of affectedMunicipalityIds) {
      const result = await this.regenerateFromSource(municipalityId, actorId, {
        confirmOverlap: dto.confirmOverlap,
        switchToSourceBased: dto.switchToSourceBased || municipalityId === dto.municipalityId,
      });
      regenResults.push({
        municipalityId,
        overlaps: result.overlaps ?? [],
      });
    }

    return { assigned: features.length, regenerated: regenResults };
  }

  private async unassignFeatures(
    municipalityId: string,
    featureIds: string[],
    actorId: string,
  ) {
    const activeImport = await this.importService.getActiveImport();
    if (!activeImport) {
      throw new BadRequestException('No active boundary source import');
    }

    const rows = await this.prisma.boundarySourceAssignment.findMany({
      where: {
        municipalityId,
        featureId: { in: featureIds },
        revokedAt: null,
        feature: { importId: activeImport.id },
      },
    });

    if (!rows.length) {
      return { unassigned: 0, regenerated: null };
    }

    await this.prisma.boundarySourceAssignment.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { revokedAt: new Date() },
    });

    const regen = await this.regenerateFromSource(municipalityId, actorId, {
      allowDeactivateIfEmpty: true,
    });

    return { unassigned: rows.length, regenerated: regen };
  }

  async clearMunicipalityAssignments(
    municipalityId: string,
    actorId: string,
    confirmed: boolean,
  ) {
    if (!confirmed) {
      throw new BadRequestException({
        code: 'CONFIRMATION_REQUIRED',
        message: 'Pass confirmed=true to clear all assignments for this municipality',
      });
    }

    const activeImport = await this.importService.getActiveImport();
    if (!activeImport) {
      throw new BadRequestException('No active boundary source import');
    }

    const rows = await this.prisma.boundarySourceAssignment.findMany({
      where: {
        municipalityId,
        revokedAt: null,
        feature: { importId: activeImport.id },
      },
    });

    if (rows.length) {
      await this.prisma.boundarySourceAssignment.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { revokedAt: new Date() },
      });
    }

    const boundary = await this.prisma.municipalityBoundary.findUnique({
      where: { municipalityId },
    });

    if (
      boundary?.sourceType === MunicipalityBoundarySourceType.AUTO_FROM_SOURCE
    ) {
      await this.prisma.municipalityBoundary.update({
        where: { municipalityId },
        data: { isActive: false },
      });
    }

    return {
      revoked: rows.length,
      boundaryDeactivated:
        boundary?.sourceType === MunicipalityBoundarySourceType.AUTO_FROM_SOURCE,
    };
  }

  async regenerateFromSource(
    municipalityId: string,
    actorId: string,
    options?: {
      confirmOverlap?: boolean;
      switchToSourceBased?: boolean;
      allowDeactivateIfEmpty?: boolean;
    },
  ) {
    const activeImport = await this.importService.getActiveImport();
    if (!activeImport) {
      throw new BadRequestException('No active boundary source import');
    }

    const muni = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      include: { boundary: true },
    });
    if (!muni) throw new NotFoundException('Municipality not found');

    if (
      muni.boundary?.isActive &&
      muni.boundary.sourceType === MunicipalityBoundarySourceType.MANUAL_GEOJSON &&
      !options?.switchToSourceBased
    ) {
      throw new ConflictException({
        code: 'MANUAL_BOUNDARY_SWITCH_REQUIRED',
        message: 'Cannot regenerate over a manual boundary without switchToSourceBased',
      });
    }

    const activeAssignments = await this.prisma.boundarySourceAssignment.findMany({
      where: {
        municipalityId,
        revokedAt: null,
        feature: { importId: activeImport.id },
      },
      include: { feature: { select: { geometry: true } } },
    });

    if (!activeAssignments.length) {
      if (options?.allowDeactivateIfEmpty) {
        const existing = await this.prisma.municipalityBoundary.findUnique({
          where: { municipalityId },
        });
        if (
          existing?.sourceType === MunicipalityBoundarySourceType.AUTO_FROM_SOURCE
        ) {
          await this.prisma.municipalityBoundary.update({
            where: { municipalityId },
            data: { isActive: false },
          });
        }
        return {
          municipalityId,
          configured: false,
          deactivated: true,
          overlaps: [],
        };
      }
      throw new BadRequestException('No assigned source features for this municipality');
    }

    const geometries = activeAssignments.map(
      (a) => a.feature.geometry as GeoJsonGeometry,
    );
    const merged = mergeBoundaryGeometries(geometries);
    if (!merged) {
      throw new BadRequestException('Could not merge assigned geometries');
    }

    const geometry = normalizeBoundaryGeoJson(merged) as GeoJsonGeometry;
    const overlaps = await this.boundaryService.detectOverlaps(
      municipalityId,
      geometry,
    );

    if (overlaps.length && !options?.confirmOverlap) {
      throw new ConflictException({
        code: 'BOUNDARY_OVERLAP',
        message: 'Generated boundary overlaps another active municipality boundary',
        overlaps,
      });
    }

    const bufferMeters = muni.boundary?.bufferMeters ?? 0;
    const now = new Date();

    const row = await this.prisma.municipalityBoundary.upsert({
      where: { municipalityId },
      create: {
        municipalityId,
        geojson: geometry as Prisma.InputJsonValue,
        bufferMeters,
        isActive: true,
        sourceType: MunicipalityBoundarySourceType.AUTO_FROM_SOURCE,
        sourceImportId: activeImport.id,
        lastGeneratedAt: now,
      },
      update: {
        geojson: geometry as Prisma.InputJsonValue,
        bufferMeters,
        isActive: true,
        sourceType: MunicipalityBoundarySourceType.AUTO_FROM_SOURCE,
        sourceImportId: activeImport.id,
        lastGeneratedAt: now,
      },
    });

    return {
      municipalityId,
      configured: true,
      isActive: row.isActive,
      sourceType: row.sourceType,
      lastGeneratedAt: row.lastGeneratedAt?.toISOString() ?? null,
      assignedFeatureCount: activeAssignments.length,
      bounds: boundaryBounds(geometry),
      overlaps,
    };
  }
}
