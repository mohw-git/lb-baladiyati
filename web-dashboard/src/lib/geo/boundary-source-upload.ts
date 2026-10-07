import { ApiError, platformApi } from '@/lib/api';
import type { Admin3Dataset } from './admin3-geojson-import';
import type { BoundaryGeometry } from './boundary-geojson-export';

/** Stay under Express default 100kb; route-specific limit is 512kb as safety margin. */
const TARGET_CHUNK_BYTES = 72_000;
const MAX_FEATURES_PER_CHUNK = 25;

export type BoundarySourceUploadProgress = {
  done: number;
  total: number;
  chunkIndex: number;
  chunkCount: number;
};

export class BoundarySourceUploadError extends Error {
  constructor(
    message: string,
    readonly importId: string | null,
    readonly uploadedCount: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BoundarySourceUploadError';
  }
}

type FeaturePayload = {
  featureKey: string;
  adm3Name: string;
  adm3Name1?: string;
  adm3Pcode: string;
  adm2Name: string;
  adm1Name: string;
  areaSqkm?: number;
  centerLat?: number;
  centerLon?: number;
  geometry: BoundaryGeometry;
};

function buildFeaturePayload(
  dataset: Admin3Dataset,
  rowId: string,
): FeaturePayload {
  const row = dataset.features.find((f) => f.id === rowId);
  const geometry = dataset.geometries.get(rowId);
  if (!row || !geometry) {
    throw new Error(`Missing feature row or geometry for ${rowId}`);
  }
  return {
    featureKey: row.id,
    adm3Name: row.adm3_name,
    adm3Name1: row.adm3_name_ar ?? undefined,
    adm3Pcode: row.adm3_pcode,
    adm2Name: row.adm2_name,
    adm1Name: row.adm1_name,
    areaSqkm: row.area_sqkm ?? undefined,
    centerLat: row.center_lat ?? undefined,
    centerLon: row.center_lon ?? undefined,
    geometry: geometry as BoundaryGeometry,
  };
}

function estimatePayloadBytes(features: FeaturePayload[]): number {
  return JSON.stringify({ features }).length;
}

function buildAdaptiveChunks(dataset: Admin3Dataset): FeaturePayload[][] {
  const chunks: FeaturePayload[][] = [];
  let current: FeaturePayload[] = [];
  let currentBytes = estimatePayloadBytes([]);

  for (const row of dataset.features) {
    const feature = buildFeaturePayload(dataset, row.id);
    const featureBytes = JSON.stringify(feature).length;
    const wouldExceed =
      current.length >= MAX_FEATURES_PER_CHUNK ||
      (current.length > 0 && currentBytes + featureBytes > TARGET_CHUNK_BYTES);

    if (wouldExceed) {
      chunks.push(current);
      current = [];
      currentBytes = estimatePayloadBytes([]);
    }

    current.push(feature);
    currentBytes = estimatePayloadBytes(current);
  }

  if (current.length) chunks.push(current);
  return chunks;
}

export async function uploadAdmin3SourceImport(
  dataset: Admin3Dataset,
  onProgress?: (progress: BoundarySourceUploadProgress) => void,
): Promise<string> {
  const total = dataset.features.length;
  const chunks = buildAdaptiveChunks(dataset);
  let importId: string | null = null;
  let uploaded = 0;

  try {
    const imp = await platformApi.createBoundarySourceImport({
      fileName: dataset.fileName,
      name: dataset.collectionName ?? dataset.fileName,
      validOn: dataset.validOn ?? undefined,
      version: dataset.version ?? undefined,
    });
    importId = imp.id;

    for (let i = 0; i < chunks.length; i++) {
      const features = chunks[i]!;
      await platformApi.addBoundarySourceFeatures(importId, { features });
      uploaded += features.length;
      onProgress?.({
        done: uploaded,
        total,
        chunkIndex: i + 1,
        chunkCount: chunks.length,
      });
    }

    await platformApi.activateBoundarySourceImport(importId);
    return importId;
  } catch (err) {
    const message =
      err instanceof ApiError && err.status === 413
        ? 'Upload chunk too large (413). Try again after canceling the partial import.'
        : err instanceof Error
          ? err.message
          : 'Import failed';
    throw new BoundarySourceUploadError(message, importId, uploaded, err);
  }
}

export async function cancelBoundarySourceImport(importId: string): Promise<void> {
  await platformApi.cancelBoundarySourceImport(importId);
}

export function admin3DatasetFromFeatureCollection(
  fileName: string,
  fc: GeoJSON.FeatureCollection,
  meta?: { validOn?: string | null; version?: string | null; collectionName?: string | null },
): Admin3Dataset {
  const features: Admin3Dataset['features'] = [];
  const geometries = new Map<string, BoundaryGeometry>();

  for (let i = 0; i < fc.features.length; i++) {
    const f = fc.features[i];
    if (!f || f.type !== 'Feature') continue;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(p.id ?? p.featureKey ?? `row-${i}`);
    const geom = f.geometry;
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue;

    const row = {
      id,
      adm3_name: String(p.adm3_name ?? p.adm3Name ?? ''),
      adm3_name_ar:
        p.adm3_name1 != null
          ? String(p.adm3_name1)
          : p.adm3Name1 != null
            ? String(p.adm3Name1)
            : null,
      adm3_pcode: String(p.adm3_pcode ?? p.adm3Pcode ?? id),
      adm2_name: String(p.adm2_name ?? p.adm2Name ?? ''),
      adm1_name: String(p.adm1_name ?? p.adm1Name ?? ''),
      area_sqkm: typeof p.area_sqkm === 'number' ? p.area_sqkm : null,
      center_lat: null as number | null,
      center_lon: null as number | null,
      valid_on: null,
      version: null,
    };
    features.push(row);
    geometries.set(id, geom as BoundaryGeometry);
  }

  return {
    fileName,
    collectionName: meta?.collectionName ?? null,
    featureCount: features.length,
    skippedCount: 0,
    validOn: meta?.validOn ?? null,
    version: meta?.version ?? null,
    features,
    geometries,
  };
}
