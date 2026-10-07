import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GeoJsonBoundaryValidationError,
  normalizeBoundaryGeoJson,
} from '../../core/geo/geojson-boundary.util';
import type { GeoJsonGeometry } from '../../core/geo/geojson-location.util';

export const DEFAULT_ADMIN3_FILE_NAME = 'lbn_admin3_em.geojson';

/**
 * Resolve the bundled Admin3 source file. The backend runs from dist in prod
 * (dist/src/main.js) but the data file lives at the project root under data/,
 * so we probe a few stable candidates relative to cwd and the compiled dir.
 */
export function resolveDefaultAdmin3Path(): string | null {
  const candidates = [
    process.env.ADMIN3_SOURCE_FILE,
    resolve(process.cwd(), 'data', DEFAULT_ADMIN3_FILE_NAME),
    resolve(__dirname, '../../../data', DEFAULT_ADMIN3_FILE_NAME),
    resolve(__dirname, '../../../../data', DEFAULT_ADMIN3_FILE_NAME),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export type ParsedAdmin3Feature = {
  featureKey: string;
  adm3Name: string;
  adm3Name1: string | null;
  adm3Pcode: string;
  adm2Name: string;
  adm1Name: string;
  areaSqkm: number | null;
  centerLat: number | null;
  centerLon: number | null;
  geometry: GeoJsonGeometry;
};

export type ParsedAdmin3Source = {
  fileName: string;
  collectionName: string | null;
  validOn: string | null;
  version: string | null;
  features: ParsedAdmin3Feature[];
  skippedCount: number;
  invalidGeometryCount: number;
};

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Read and validate the Admin3 GeoJSON FeatureCollection from disk.
 * Geometry is validated/normalized with the same helper used by manual import.
 */
export function parseAdmin3SourceFile(filePath: string): ParsedAdmin3Source {
  const raw = readFileSync(filePath, 'utf8');
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    throw new GeoJsonBoundaryValidationError('Default Admin3 file is not valid JSON.');
  }

  if (!root || typeof root !== 'object') {
    throw new GeoJsonBoundaryValidationError('Admin3 root must be a JSON object.');
  }

  const obj = root as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
    throw new GeoJsonBoundaryValidationError(
      'Admin3 file must be a GeoJSON FeatureCollection.',
    );
  }

  const rawFeatures = obj.features as unknown[];
  const features: ParsedAdmin3Feature[] = [];
  const collectionName = asString(obj.name) || null;
  let validOn: string | null = null;
  let version: string | null = null;
  let skippedCount = 0;
  let invalidGeometryCount = 0;

  for (let i = 0; i < rawFeatures.length; i++) {
    const raw = rawFeatures[i];
    if (!raw || typeof raw !== 'object') {
      skippedCount++;
      continue;
    }
    const feature = raw as Record<string, unknown>;
    if (feature.type !== 'Feature') {
      skippedCount++;
      continue;
    }

    const props = (feature.properties ?? {}) as Record<string, unknown>;
    let geometry: GeoJsonGeometry;
    try {
      geometry = normalizeBoundaryGeoJson(feature.geometry) as GeoJsonGeometry;
    } catch {
      invalidGeometryCount++;
      continue;
    }

    const pcode = asString(props.adm3_pcode) || `row-${i}`;
    const featureKey = `${pcode}#${i}`;
    const rowValidOn = asString(props.valid_on) || null;
    const rowVersion = asString(props.version) || null;
    if (!validOn && rowValidOn) validOn = rowValidOn;
    if (!version && rowVersion) version = rowVersion;

    features.push({
      featureKey,
      adm3Name: asString(props.adm3_name) || pcode,
      adm3Name1: asString(props.adm3_name1) || null,
      adm3Pcode: pcode,
      adm2Name: asString(props.adm2_name),
      adm1Name: asString(props.adm1_name),
      areaSqkm: asNumber(props.area_sqkm),
      centerLat: asNumber(props.center_lat),
      centerLon: asNumber(props.center_lon),
      geometry,
    });
  }

  if (!features.length) {
    throw new GeoJsonBoundaryValidationError(
      'No usable Polygon/MultiPolygon features found in the Admin3 file.',
    );
  }

  return {
    fileName: DEFAULT_ADMIN3_FILE_NAME,
    collectionName,
    validOn,
    version,
    features,
    skippedCount,
    invalidGeometryCount,
  };
}
