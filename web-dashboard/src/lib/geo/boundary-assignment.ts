import type { MunicipalityBoundaryMapItem } from '@/lib/api/endpoints/platform';
import type { Admin3Dataset, Admin3FeatureRow } from './admin3-geojson-import';
import type { BoundaryGeometry } from './boundary-geojson-export';
import { isPointInBoundary } from './point-in-boundary';

export type MunicipalityRef = {
  id: string;
  name: string;
  code: string;
};

export type FeatureAssignment = {
  municipalityId: string;
  municipalityName: string;
  municipalityCode: string;
  /** Feature center lies inside multiple saved boundaries. */
  conflict?: boolean;
  conflictMunicipalityIds?: string[];
};

const PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#be185d',
  '#4f46e5',
  '#0d9488',
  '#ca8a04',
  '#9333ea',
  '#0369a1',
];

export function colorForMunicipality(municipalityId: string): string {
  let hash = 0;
  for (let i = 0; i < municipalityId.length; i++) {
    hash = (hash * 31 + municipalityId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function resolveMunicipalityColor(
  municipalityId: string,
  customColors?: Map<string, string | null | undefined>,
): string {
  const custom = customColors?.get(municipalityId);
  if (custom && /^#[0-9a-fA-F]{3,8}$/.test(custom)) return custom;
  return colorForMunicipality(municipalityId);
}

export type WorkspaceAssignment = {
  featureId: string;
  municipalityId: string;
  municipalityName?: string;
  municipalityCode?: string;
};

/** Build feature-id → assignment map from persisted workspace assignments. */
export function buildAssignmentsFromWorkspace(
  assignments: WorkspaceAssignment[],
  muniById: Map<string, MunicipalityRef>,
): Map<string, FeatureAssignment | null> {
  const byFeature = new Map<string, WorkspaceAssignment[]>();
  for (const a of assignments) {
    const list = byFeature.get(a.featureId) ?? [];
    list.push(a);
    byFeature.set(a.featureId, list);
  }

  const result = new Map<string, FeatureAssignment | null>();
  byFeature.forEach((rows, featureId) => {
    if (rows.length > 1) {
      const primary = rows[0]!;
      const m = muniById.get(primary.municipalityId);
      result.set(featureId, {
        municipalityId: primary.municipalityId,
        municipalityName: primary.municipalityName ?? m?.name ?? primary.municipalityId,
        municipalityCode: primary.municipalityCode ?? m?.code ?? '',
        conflict: true,
        conflictMunicipalityIds: rows.map((r: WorkspaceAssignment) => r.municipalityId),
      });
      return;
    }

    const a = rows[0]!;
    const m = muniById.get(a.municipalityId);
    if (!m) return;
    result.set(featureId, {
      municipalityId: m.id,
      municipalityName: a.municipalityName ?? m.name,
      municipalityCode: a.municipalityCode ?? m.code,
    });
  });
  return result;
}

export function applyAssignOptimistic(
  assignments: Map<string, FeatureAssignment | null>,
  featureIds: string[],
  target: MunicipalityRef,
): Map<string, FeatureAssignment | null> {
  const next = new Map(assignments);
  for (const fid of featureIds) {
    next.set(fid, {
      municipalityId: target.id,
      municipalityName: target.name,
      municipalityCode: target.code,
    });
  }
  return next;
}

export function applyUnassignOptimistic(
  assignments: Map<string, FeatureAssignment | null>,
  featureIds: string[],
): Map<string, FeatureAssignment | null> {
  const next = new Map(assignments);
  for (const fid of featureIds) {
    next.set(fid, null);
  }
  return next;
}

export function applyClearMunicipalityOptimistic(
  assignments: Map<string, FeatureAssignment | null>,
  municipalityId: string,
): Map<string, FeatureAssignment | null> {
  const next = new Map(assignments);
  next.forEach((a, id) => {
    if (a && a.municipalityId === municipalityId && !a.conflict) {
      next.set(id, null);
    }
  });
  return next;
}

/**
 * Infer which Admin3 feature belongs to which municipality by testing each
 * feature center against active saved boundaries (v1 heuristic).
 */
export function inferAdmin3Assignments(
  dataset: Admin3Dataset,
  boundaries: MunicipalityBoundaryMapItem[],
  municipalities: MunicipalityRef[],
): Map<string, FeatureAssignment | null> {
  const result = new Map<string, FeatureAssignment | null>();
  const muniById = new Map(municipalities.map((m) => [m.id, m]));
  const active = boundaries.filter((b) => b.isActive && b.geojson);

  for (const row of dataset.features) {
    result.set(row.id, matchFeatureToBoundaries(row, active, muniById));
  }
  return result;
}

function matchFeatureToBoundaries(
  row: Admin3FeatureRow,
  boundaries: MunicipalityBoundaryMapItem[],
  muniById: Map<string, MunicipalityRef>,
): FeatureAssignment | null {
  const lat = row.center_lat;
  const lon = row.center_lon;
  if (lat == null || lon == null) return null;

  const hits: string[] = [];
  for (const b of boundaries) {
    if (isPointInBoundary(lat, lon, b.geojson as BoundaryGeometry)) {
      hits.push(b.municipalityId);
    }
  }

  if (!hits.length) return null;
  if (hits.length === 1) {
    const m = muniById.get(hits[0]!);
    if (!m) return null;
    return {
      municipalityId: m.id,
      municipalityName: m.name,
      municipalityCode: m.code,
    };
  }

  const primary = muniById.get(hits[0]!);
  return {
    municipalityId: hits[0]!,
    municipalityName: primary?.name ?? hits[0]!,
    municipalityCode: primary?.code ?? '',
    conflict: true,
    conflictMunicipalityIds: hits,
  };
}

export function buildAdmin3FeatureCollection(
  dataset: Admin3Dataset,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: dataset.features.map((row) => ({
      type: 'Feature',
      properties: {
        id: row.id,
        adm3_name: row.adm3_name,
        adm3_name_ar: row.adm3_name_ar,
        adm3_pcode: row.adm3_pcode,
        adm2_name: row.adm2_name,
        adm1_name: row.adm1_name,
        area_sqkm: row.area_sqkm,
      },
      geometry: dataset.geometries.get(row.id)! as GeoJSON.Geometry,
    })),
  };
}

export function boundsForFeatureIds(
  dataset: Admin3Dataset,
  featureIds: string[],
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let n = 0;
  for (const id of featureIds) {
    const row = dataset.features.find((f) => f.id === id);
    if (!row || row.center_lat == null || row.center_lon == null) continue;
    minLat = Math.min(minLat, row.center_lat);
    maxLat = Math.max(maxLat, row.center_lat);
    minLng = Math.min(minLng, row.center_lon);
    maxLng = Math.max(maxLng, row.center_lon);
    n++;
  }
  if (!n) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function featureIdsForMunicipality(
  assignments: Map<string, FeatureAssignment | null>,
  municipalityId: string,
): string[] {
  const ids: string[] = [];
  assignments.forEach((a, id) => {
    if (a && !a.conflict && a.municipalityId === municipalityId) ids.push(id);
  });
  return ids;
}
