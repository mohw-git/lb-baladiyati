import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  isPointInsideGeoJson,
  minDistanceToGeoJsonMeters,
} from '../../core/geo/geojson-location.util';
import {
  MunicipalityCandidate,
  MunicipalityResolutionMethod,
  MunicipalityResolutionResult,
  MunicipalityResolutionStatus,
} from './municipality-resolution.types';
import {
  MunicipalityResolutionError,
  MUNICIPALITY_RESOLUTION_MESSAGES,
} from './municipality-resolution.error';

@Injectable()
export class MunicipalityResolutionService {
  private readonly logger = new Logger(MunicipalityResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve operational municipality from WGS84 coordinates using boundaries only.
   * When status is AMBIGUOUS, caller must supply selectedMunicipalityId on submit.
   */
  async resolveFromCoordinates(
    latitude: number,
    longitude: number,
    _userMunicipalityId: string | null,
    selectedMunicipalityId?: string,
  ): Promise<MunicipalityResolutionResult> {
    const boundaries = await this.prisma.municipalityBoundary.findMany({
      where: { isActive: true, municipality: { isActive: true } },
      include: {
        municipality: {
          select: { id: true, name: true, code: true, nameAr: true, nameFr: true },
        },
      },
    });

    if (!boundaries.length) {
      this.logger.warn(
        'No active municipality boundaries configured — all coordinate lookups will return OUT_OF_COVERAGE until boundaries are uploaded.',
      );
    }

    const toCandidate = (m: {
      id: string;
      name: string;
      code: string;
      nameAr: string | null;
      nameFr: string | null;
    }): MunicipalityCandidate => ({
      id: m.id,
      name: m.name,
      code: m.code,
      nameAr: m.nameAr,
      nameFr: m.nameFr,
    });

    const exactMatches: MunicipalityCandidate[] = [];
    const bufferMatches: Array<{ candidate: MunicipalityCandidate; distanceMeters: number }> =
      [];

    for (const row of boundaries) {
      const candidate = toCandidate(row.municipality);
      if (isPointInsideGeoJson(latitude, longitude, row.geojson)) {
        exactMatches.push(candidate);
        continue;
      }
      if (row.bufferMeters > 0) {
        const dist = minDistanceToGeoJsonMeters(latitude, longitude, row.geojson);
        if (dist <= row.bufferMeters) {
          bufferMatches.push({ candidate, distanceMeters: dist });
        }
      }
    }

    if (exactMatches.length === 1) {
      return {
        status: 'EXACT',
        municipalityId: exactMatches[0]!.id,
        method: 'BOUNDARY_EXACT',
        candidates: exactMatches,
        confidence: 1,
      };
    }

    if (exactMatches.length > 1) {
      return this.finalizeAmbiguous(
        exactMatches,
        selectedMunicipalityId,
      );
    }

    if (bufferMatches.length === 1) {
      return {
        status: 'BUFFER',
        municipalityId: bufferMatches[0]!.candidate.id,
        method: 'BOUNDARY_BUFFER',
        candidates: [bufferMatches[0]!.candidate],
        distanceMeters: bufferMatches[0]!.distanceMeters,
        confidence: 0.85,
      };
    }

    if (bufferMatches.length > 1) {
      const candidates = bufferMatches.map((b) => b.candidate);
      return this.finalizeAmbiguous(candidates, selectedMunicipalityId);
    }

    return {
      status: 'OUT_OF_COVERAGE',
      municipalityId: null,
      method: null,
      candidates: [],
    };
  }

  private finalizeAmbiguous(
    candidates: MunicipalityCandidate[],
    selectedMunicipalityId?: string,
  ): MunicipalityResolutionResult {
    if (selectedMunicipalityId) {
      const allowed = candidates.some((c) => c.id === selectedMunicipalityId);
      if (!allowed) {
        return {
          status: 'AMBIGUOUS',
          municipalityId: null,
          method: null,
          candidates,
        };
      }
      return {
        status: 'EXACT',
        municipalityId: selectedMunicipalityId,
        method: 'USER_SELECTED_AMBIGUOUS',
        candidates,
        confidence: 0.9,
      };
    }

    return {
      status: 'AMBIGUOUS',
      municipalityId: null,
      method: null,
      candidates,
    };
  }

  /** Resolve operational municipality for complaint create (re-validates on submit). */
  async resolveForComplaintCreate(
    latitude: number | undefined,
    longitude: number | undefined,
    _userMunicipalityId: string | null,
    selectedMunicipalityId?: string,
  ): Promise<{
    operationalMunicipalityId: string;
    method: MunicipalityResolutionMethod;
    status: MunicipalityResolutionStatus;
    candidates: MunicipalityCandidate[];
    locationResolvedAt: Date;
  }> {
    if (latitude == null || longitude == null) {
      throw new MunicipalityResolutionError('LOCATION_REQUIRED');
    }

    const resolution = await this.resolveFromCoordinates(
      latitude,
      longitude,
      _userMunicipalityId,
      selectedMunicipalityId,
    );

    if (
      selectedMunicipalityId &&
      resolution.status === 'AMBIGUOUS' &&
      !resolution.municipalityId
    ) {
      throw new MunicipalityResolutionError(
        'INVALID_MUNICIPALITY_SELECTION',
        undefined,
        resolution.candidates,
      );
    }

    if (resolution.status === 'AMBIGUOUS') {
      throw new MunicipalityResolutionError(
        'MUNICIPALITY_AMBIGUOUS',
        undefined,
        resolution.candidates,
      );
    }

    if (resolution.status === 'OUT_OF_COVERAGE' || !resolution.municipalityId) {
      throw new MunicipalityResolutionError('OUT_OF_COVERAGE');
    }

    const method: MunicipalityResolutionMethod =
      resolution.method ?? 'BOUNDARY_EXACT';

    return {
      operationalMunicipalityId: resolution.municipalityId,
      method,
      status: resolution.status,
      candidates: resolution.candidates,
      locationResolvedAt: new Date(),
    };
  }
}

export { MUNICIPALITY_RESOLUTION_MESSAGES };
