import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BoundarySourceImportStatus, Prisma } from '@prisma/client';
import { normalizeBoundaryGeoJson, GeoJsonBoundaryValidationError } from '../../core/geo/geojson-boundary.util';
import type { GeoJsonGeometry } from '../../core/geo/geojson-location.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  parseAdmin3SourceFile,
  resolveDefaultAdmin3Path,
  type ParsedAdmin3Feature,
} from './admin3-source-loader';
import {
  BulkBoundarySourceFeaturesDto,
  CreateBoundarySourceImportDto,
} from './dto/boundary-source.dto';

const DEFAULT_IMPORT_BATCH_SIZE = 200;

@Injectable()
export class BoundarySourceImportService {
  private readonly logger = new Logger(BoundarySourceImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActiveImport() {
    return this.prisma.boundarySourceImport.findFirst({
      where: { status: BoundarySourceImportStatus.ACTIVE },
      orderBy: { importedAt: 'desc' },
    });
  }

  async getPendingImport() {
    return this.prisma.boundarySourceImport.findFirst({
      where: { status: BoundarySourceImportStatus.IMPORTING },
      orderBy: { importedAt: 'desc' },
    });
  }

  /** Remove incomplete imports (features cascade). */
  async cancelImport(importId: string) {
    const imp = await this.prisma.boundarySourceImport.findUnique({
      where: { id: importId },
    });
    if (!imp) throw new NotFoundException('Boundary source import not found');
    if (imp.status !== BoundarySourceImportStatus.IMPORTING) {
      throw new BadRequestException(
        'Only imports in IMPORTING status can be cancelled',
      );
    }
    await this.prisma.boundarySourceImport.delete({ where: { id: importId } });
    return { cancelled: true, importId };
  }

  async createImport(dto: CreateBoundarySourceImportDto, actorId: string) {
    await this.prisma.boundarySourceImport.deleteMany({
      where: { status: BoundarySourceImportStatus.IMPORTING },
    });
    return this.prisma.boundarySourceImport.create({
      data: {
        name: dto.name?.trim() || dto.fileName,
        fileName: dto.fileName,
        validOn: dto.validOn ?? null,
        version: dto.version ?? null,
        status: BoundarySourceImportStatus.IMPORTING,
        importedByUserId: actorId,
      },
    });
  }

  async addFeatures(importId: string, dto: BulkBoundarySourceFeaturesDto) {
    const imp = await this.prisma.boundarySourceImport.findUnique({
      where: { id: importId },
    });
    if (!imp) throw new NotFoundException('Boundary source import not found');
    if (imp.status === BoundarySourceImportStatus.ARCHIVED) {
      throw new BadRequestException('Cannot add features to an archived import');
    }
    if (imp.status === BoundarySourceImportStatus.ACTIVE) {
      throw new BadRequestException('Cannot add features to an already active import');
    }
    if (dto.features.length > 50) {
      throw new BadRequestException('At most 50 features per chunk');
    }

    const rows: Prisma.BoundarySourceFeatureCreateManyInput[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dto.features.length; i++) {
      const f = dto.features[i]!;
      try {
        const geometry = normalizeBoundaryGeoJson(f.geometry) as GeoJsonGeometry;
        rows.push({
          importId,
          featureKey: f.featureKey,
          adm3Name: f.adm3Name,
          adm3Name1: f.adm3Name1 ?? null,
          adm3Pcode: f.adm3Pcode,
          adm2Name: f.adm2Name,
          adm1Name: f.adm1Name,
          areaSqkm: f.areaSqkm ?? null,
          centerLat: f.centerLat ?? null,
          centerLon: f.centerLon ?? null,
          geometry: geometry as Prisma.InputJsonValue,
        });
      } catch (err) {
        const msg =
          err instanceof GeoJsonBoundaryValidationError
            ? err.message
            : `features[${i}]: invalid geometry`;
        errors.push(msg);
      }
    }

    if (!rows.length && errors.length) {
      throw new BadRequestException({
        code: 'INVALID_BOUNDARY_GEOJSON',
        message: errors.join('; '),
      });
    }

    if (rows.length) {
      await this.prisma.boundarySourceFeature.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    const featureCount = await this.prisma.boundarySourceFeature.count({
      where: { importId },
    });
    await this.prisma.boundarySourceImport.update({
      where: { id: importId },
      data: { featureCount },
    });

    return {
      accepted: rows.length,
      skippedInvalid: errors.length,
      errors: errors.slice(0, 20),
      featureCount,
    };
  }

  async activateImport(importId: string) {
    const imp = await this.prisma.boundarySourceImport.findUnique({
      where: { id: importId },
    });
    if (!imp) throw new NotFoundException('Boundary source import not found');

    const featureCount = await this.prisma.boundarySourceFeature.count({
      where: { importId },
    });
    if (!featureCount) {
      throw new BadRequestException('Import has no features');
    }

    await this.prisma.$transaction([
      this.prisma.boundarySourceImport.updateMany({
        where: {
          status: BoundarySourceImportStatus.ACTIVE,
          id: { not: importId },
        },
        data: { status: BoundarySourceImportStatus.ARCHIVED },
      }),
      this.prisma.boundarySourceImport.update({
        where: { id: importId },
        data: {
          status: BoundarySourceImportStatus.ACTIVE,
          featureCount,
        },
      }),
    ]);

    return this.prisma.boundarySourceImport.findUnique({ where: { id: importId } });
  }

  /**
   * Server-side import of the bundled Admin3 source file. Reads from disk,
   * validates every geometry, inserts features in batches, then activates.
   * No browser upload, no chunked requests — avoids 413 and throttle issues.
   */
  async importDefaultSource(
    actorId: string | null,
    options: { replace?: boolean } = {},
  ) {
    const existingActive = await this.prisma.boundarySourceImport.findFirst({
      where: { status: BoundarySourceImportStatus.ACTIVE },
    });
    if (existingActive && !options.replace) {
      throw new ConflictException({
        code: 'DEFAULT_IMPORT_EXISTS',
        message:
          'An active Admin3 source already exists. Pass replace=true to import a fresh copy.',
      });
    }

    const filePath = resolveDefaultAdmin3Path();
    if (!filePath) {
      throw new BadRequestException({
        code: 'DEFAULT_IMPORT_FILE_MISSING',
        message:
          'Default Admin3 source file was not found on the server (expected data/lbn_admin3_em.geojson).',
      });
    }

    let parsed;
    try {
      parsed = parseAdmin3SourceFile(filePath);
    } catch (err) {
      const message =
        err instanceof GeoJsonBoundaryValidationError
          ? err.message
          : 'Failed to parse default Admin3 source file';
      throw new BadRequestException({ code: 'INVALID_BOUNDARY_GEOJSON', message });
    }

    // Clean up any incomplete imports from prior failed attempts.
    await this.prisma.boundarySourceImport.deleteMany({
      where: { status: BoundarySourceImportStatus.IMPORTING },
    });

    const imp = await this.prisma.boundarySourceImport.create({
      data: {
        name: parsed.collectionName ?? parsed.fileName,
        fileName: parsed.fileName,
        validOn: parsed.validOn,
        version: parsed.version,
        status: BoundarySourceImportStatus.IMPORTING,
        importedByUserId: actorId,
      },
    });

    this.logger.log(
      `Default Admin3 import ${imp.id}: ${parsed.features.length} features (` +
        `${parsed.invalidGeometryCount} invalid, ${parsed.skippedCount} skipped)`,
    );

    try {
      let inserted = 0;
      for (let i = 0; i < parsed.features.length; i += DEFAULT_IMPORT_BATCH_SIZE) {
        const batch = parsed.features.slice(i, i + DEFAULT_IMPORT_BATCH_SIZE);
        await this.prisma.boundarySourceFeature.createMany({
          data: batch.map((f: ParsedAdmin3Feature) => ({
            importId: imp.id,
            featureKey: f.featureKey,
            adm3Name: f.adm3Name,
            adm3Name1: f.adm3Name1,
            adm3Pcode: f.adm3Pcode,
            adm2Name: f.adm2Name,
            adm1Name: f.adm1Name,
            areaSqkm: f.areaSqkm,
            centerLat: f.centerLat,
            centerLon: f.centerLon,
            geometry: f.geometry as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        });
        inserted += batch.length;
      }

      const featureCount = await this.prisma.boundarySourceFeature.count({
        where: { importId: imp.id },
      });

      // Activate (archives previous ACTIVE) in a single transaction.
      await this.prisma.$transaction([
        this.prisma.boundarySourceImport.updateMany({
          where: {
            status: BoundarySourceImportStatus.ACTIVE,
            id: { not: imp.id },
          },
          data: { status: BoundarySourceImportStatus.ARCHIVED },
        }),
        this.prisma.boundarySourceImport.update({
          where: { id: imp.id },
          data: { status: BoundarySourceImportStatus.ACTIVE, featureCount },
        }),
      ]);

      this.logger.log(
        `Default Admin3 import ${imp.id} activated with ${featureCount} features`,
      );

      return {
        importId: imp.id,
        status: BoundarySourceImportStatus.ACTIVE,
        featureCount,
        inserted,
        invalidGeometryCount: parsed.invalidGeometryCount,
        skippedCount: parsed.skippedCount,
        replacedPrevious: Boolean(existingActive),
      };
    } catch (err) {
      // Leave the import as IMPORTING so it can be cancelled/cleaned up.
      this.logger.error(
        `Default Admin3 import ${imp.id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadRequestException({
        code: 'DEFAULT_IMPORT_FAILED',
        message: 'Default Admin3 import failed partway. Cancel the incomplete import and retry.',
        importId: imp.id,
      });
    }
  }

  async getActiveFeatureCollection() {
    const imp = await this.getActiveImport();
    if (!imp) return null;

    const features = await this.prisma.boundarySourceFeature.findMany({
      where: { importId: imp.id },
      select: {
        id: true,
        featureKey: true,
        adm3Name: true,
        adm3Name1: true,
        adm3Pcode: true,
        adm2Name: true,
        adm1Name: true,
        areaSqkm: true,
        geometry: true,
      },
    });

    return {
      import: imp,
      featureCollection: {
        type: 'FeatureCollection',
        features: features.map((f) => ({
          type: 'Feature',
          properties: {
            id: f.id,
            featureKey: f.featureKey,
            adm3_name: f.adm3Name,
            adm3_name1: f.adm3Name1,
            adm3_pcode: f.adm3Pcode,
            adm2_name: f.adm2Name,
            adm1_name: f.adm1Name,
            area_sqkm: f.areaSqkm,
          },
          geometry: f.geometry,
        })),
      },
    };
  }
}
