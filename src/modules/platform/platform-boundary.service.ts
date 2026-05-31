import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MunicipalityBoundarySourceType, Prisma } from '@prisma/client';
import {
  boundaryBounds,
  GeoJsonBoundaryValidationError,
  normalizeBoundaryGeoJson,
  validateBufferMeters,
} from '../../core/geo/geojson-boundary.util';
import {
  BoundaryOverlapHit,
  findBoundaryOverlaps,
} from '../../core/geo/geojson-boundary-overlap.util';
import type { GeoJsonGeometry } from '../../core/geo/geojson-location.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { UpsertMunicipalityBoundaryDto, ValidateMunicipalityBoundaryDto } from './dto/upsert-municipality-boundary.dto';

export type MunicipalityBoundaryResponse = {
  municipalityId: string;
  configured: boolean;
  isActive: boolean;
  bufferMeters: number;
  updatedAt: string | null;
  geojson: GeoJsonGeometry | null;
  bounds: [number, number, number, number] | null;
  sourceType?: MunicipalityBoundarySourceType | null;
  sourceImportId?: string | null;
  lastGeneratedAt?: string | null;
  assignedFeatureCount?: number;
  overlaps?: BoundaryOverlapHit[];
};

@Injectable()
export class PlatformBoundaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertMunicipalityExists(municipalityId: string) {
    const muni = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true, name: true, code: true },
    });
    if (!muni) throw new NotFoundException('Municipality not found');
    return muni;
  }

  private toResponse(
    municipalityId: string,
    row: {
      geojson: unknown;
      bufferMeters: number;
      isActive: boolean;
      updatedAt: Date;
      sourceType?: MunicipalityBoundarySourceType;
      sourceImportId?: string | null;
      lastGeneratedAt?: Date | null;
    } | null,
    extras?: { assignedFeatureCount?: number },
  ): MunicipalityBoundaryResponse {
    if (!row) {
      return {
        municipalityId,
        configured: false,
        isActive: false,
        bufferMeters: 0,
        updatedAt: null,
        geojson: null,
        bounds: null,
      };
    }
    const geojson = row.geojson as GeoJsonGeometry;
    return {
      municipalityId,
      configured: true,
      isActive: row.isActive,
      bufferMeters: row.bufferMeters,
      updatedAt: row.updatedAt.toISOString(),
      geojson,
      bounds: boundaryBounds(geojson),
      sourceType: row.sourceType ?? null,
      sourceImportId: row.sourceImportId ?? null,
      lastGeneratedAt: row.lastGeneratedAt?.toISOString() ?? null,
      assignedFeatureCount: extras?.assignedFeatureCount,
    };
  }

  private parseGeoJson(dto: { geojson: unknown; bufferMeters?: number }) {
    try {
      const geometry = normalizeBoundaryGeoJson(dto.geojson);
      const bufferMeters = validateBufferMeters(dto.bufferMeters);
      return { geometry, bufferMeters, bounds: boundaryBounds(geometry) };
    } catch (err) {
      if (err instanceof GeoJsonBoundaryValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_BOUNDARY_GEOJSON',
          message: err.message,
        });
      }
      throw err;
    }
  }

  private async loadActivePeerBoundaries(excludeMunicipalityId: string) {
    const rows = await this.prisma.municipalityBoundary.findMany({
      where: {
        isActive: true,
        municipality: { isActive: true },
        municipalityId: { not: excludeMunicipalityId },
      },
      include: {
        municipality: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    return rows.map((row) => ({
      municipalityId: row.municipalityId,
      name: row.municipality.name,
      code: row.municipality.code,
      geojson: row.geojson as GeoJsonGeometry,
      isActive: row.isActive,
    }));
  }

  async detectOverlaps(
    municipalityId: string,
    geometry: GeoJsonGeometry,
  ): Promise<BoundaryOverlapHit[]> {
    const peers = await this.loadActivePeerBoundaries(municipalityId);
    return findBoundaryOverlaps(
      geometry,
      peers.map((p) => ({
        municipalityId: p.municipalityId,
        name: p.name,
        code: p.code,
        geojson: p.geojson,
      })),
    );
  }

  /** All boundaries for super-admin map preview (neighboring context). */
  async listBoundariesForMap(includeInactive = false) {
    const rows = await this.prisma.municipalityBoundary.findMany({
      where: includeInactive
        ? { municipality: { isActive: true } }
        : { isActive: true, municipality: { isActive: true } },
      include: {
        municipality: {
          select: { id: true, name: true, nameAr: true, nameFr: true, code: true },
        },
      },
      orderBy: { municipality: { name: 'asc' } },
    });

    return {
      data: rows.map((row) => ({
        municipalityId: row.municipalityId,
        name: row.municipality.name,
        nameAr: row.municipality.nameAr,
        nameFr: row.municipality.nameFr,
        code: row.municipality.code,
        isActive: row.isActive,
        geojson: row.geojson as GeoJsonGeometry,
        bounds: boundaryBounds(row.geojson as GeoJsonGeometry),
      })),
    };
  }

  async getBoundary(municipalityId: string): Promise<MunicipalityBoundaryResponse> {
    await this.assertMunicipalityExists(municipalityId);
    const row = await this.prisma.municipalityBoundary.findUnique({
      where: { municipalityId },
    });
    let assignedFeatureCount: number | undefined;
    if (row?.sourceType === MunicipalityBoundarySourceType.AUTO_FROM_SOURCE) {
      assignedFeatureCount = await this.prisma.boundarySourceAssignment.count({
        where: { municipalityId, revokedAt: null },
      });
    }
    return this.toResponse(municipalityId, row, { assignedFeatureCount });
  }

  async validateBoundary(
    municipalityId: string,
    dto: ValidateMunicipalityBoundaryDto,
  ) {
    await this.assertMunicipalityExists(municipalityId);
    const { geometry, bufferMeters, bounds } = this.parseGeoJson(dto);
    const overlaps = await this.detectOverlaps(municipalityId, geometry);
    return {
      valid: true,
      geojson: geometry,
      bufferMeters,
      bounds,
      overlaps,
    };
  }

  async upsertBoundary(
    municipalityId: string,
    dto: UpsertMunicipalityBoundaryDto,
    actorId: string,
    actorEmail?: string | null,
  ): Promise<MunicipalityBoundaryResponse> {
    const muni = await this.assertMunicipalityExists(municipalityId);
    const { geometry, bufferMeters } = this.parseGeoJson(dto);
    const isActive = dto.isActive !== false;
    const overlaps = await this.detectOverlaps(municipalityId, geometry);

    const existing = await this.prisma.municipalityBoundary.findUnique({
      where: { municipalityId },
    });

    const row = await this.prisma.municipalityBoundary.upsert({
      where: { municipalityId },
      create: {
        municipalityId,
        geojson: geometry as Prisma.InputJsonValue,
        bufferMeters,
        isActive,
        sourceType: MunicipalityBoundarySourceType.MANUAL_GEOJSON,
        sourceImportId: null,
        lastGeneratedAt: null,
      },
      update: {
        geojson: geometry as Prisma.InputJsonValue,
        bufferMeters,
        isActive,
        sourceType: MunicipalityBoundarySourceType.MANUAL_GEOJSON,
        sourceImportId: null,
        lastGeneratedAt: null,
      },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId,
      action: existing
        ? AUDIT_ACTIONS.PLATFORM_MUNICIPALITY_BOUNDARY_UPDATE
        : AUDIT_ACTIONS.PLATFORM_MUNICIPALITY_BOUNDARY_CREATE,
      resourceType: 'MunicipalityBoundary',
      resourceId: row.id,
      metadata: {
        municipalityName: muni.name,
        municipalityCode: muni.code,
        bufferMeters,
        isActive,
        geometryType: geometry.type,
        overlapCount: overlaps.length,
      },
    });

    return {
      ...this.toResponse(municipalityId, row),
      overlaps,
    };
  }

  /** Soft-deactivate boundary (routing ignores inactive rows). */
  async deactivateBoundary(
    municipalityId: string,
    actorId: string,
    actorEmail?: string | null,
  ): Promise<MunicipalityBoundaryResponse> {
    const muni = await this.assertMunicipalityExists(municipalityId);
    const existing = await this.prisma.municipalityBoundary.findUnique({
      where: { municipalityId },
    });
    if (!existing) {
      return this.toResponse(municipalityId, null);
    }

    const row = await this.prisma.municipalityBoundary.update({
      where: { municipalityId },
      data: { isActive: false },
    });

    await this.audit.log({
      actorId,
      actorEmail,
      municipalityId,
      action: AUDIT_ACTIONS.PLATFORM_MUNICIPALITY_BOUNDARY_DEACTIVATE,
      resourceType: 'MunicipalityBoundary',
      resourceId: row.id,
      metadata: {
        municipalityName: muni.name,
        municipalityCode: muni.code,
      },
    });

    return this.toResponse(municipalityId, row);
  }
}
