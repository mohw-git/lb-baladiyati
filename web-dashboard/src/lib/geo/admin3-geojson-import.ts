import {
  type BoundaryGeometry,
  mergeBoundaryGeometries,
  normalizeBoundaryGeometry,
} from './boundary-geojson-export';

export class Admin3ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Admin3ParseError';
  }
}

export type Admin3FeatureRow = {
  id: string;
  adm3_name: string;
  adm3_name_ar: string | null;
  adm3_pcode: string;
  adm2_name: string;
  adm1_name: string;
  area_sqkm: number | null;
  center_lat: number | null;
  center_lon: number | null;
  valid_on: string | null;
  version: string | null;
};

export type Admin3Dataset = {
  fileName: string;
  collectionName: string | null;
  featureCount: number;
  skippedCount: number;
  validOn: string | null;
  version: string | null;
  features: Admin3FeatureRow[];
  geometries: Map<string, BoundaryGeometry>;
};

export type Admin3ImportMeta = {
  sourceFileName: string;
  collectionName: string | null;
  validOn: string | null;
  version: string | null;
  selectedPcodes: string[];
  selectedNames: string[];
  featureCount: number;
};

export type Admin3SearchQuery = {
  text: string;
  adm1: string;
  adm2: string;
  pcode: string;
};

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

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

function geometryFromUnknown(geom: unknown): BoundaryGeometry | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    return normalizeBoundaryGeometry({
      type: g.type,
      coordinates: g.coordinates,
    } as BoundaryGeometry);
  }
  return null;
}

function rowSearchText(row: Admin3FeatureRow): string {
  return [
    row.adm3_name,
    row.adm3_name_ar ?? '',
    row.adm3_pcode,
    row.adm2_name,
    row.adm1_name,
  ]
    .join(' ')
    .toLowerCase();
}

export function filterAdmin3Features(
  features: Admin3FeatureRow[],
  query: Admin3SearchQuery,
): Admin3FeatureRow[] {
  const text = query.text.trim().toLowerCase();
  const adm1 = query.adm1.trim().toLowerCase();
  const adm2 = query.adm2.trim().toLowerCase();
  const pcode = query.pcode.trim().toLowerCase();

  return features.filter((row) => {
    if (text && !rowSearchText(row).includes(text)) return false;
    if (adm1 && !row.adm1_name.toLowerCase().includes(adm1)) return false;
    if (adm2 && !row.adm2_name.toLowerCase().includes(adm2)) return false;
    if (pcode && !row.adm3_pcode.toLowerCase().includes(pcode)) return false;
    return true;
  });
}

export async function parseAdmin3GeoJsonFile(file: File): Promise<Admin3Dataset> {
  if (!file.name.match(/\.(geo)?json$/i)) {
    throw new Admin3ParseError('File must be a .geojson or .json file.');
  }

  const text = await file.text();
  await yieldToMain();

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Admin3ParseError('Invalid JSON. Could not parse the file.');
  }

  if (!root || typeof root !== 'object') {
    throw new Admin3ParseError('GeoJSON root must be a JSON object.');
  }

  const obj = root as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
    throw new Admin3ParseError('Expected a GeoJSON FeatureCollection with a features array.');
  }

  const rawFeatures = obj.features as unknown[];
  if (!rawFeatures.length) {
    throw new Admin3ParseError('No features found in the file.');
  }

  const collectionName = asString(obj.name) || null;
  const features: Admin3FeatureRow[] = [];
  const geometries = new Map<string, BoundaryGeometry>();
  let skippedCount = 0;
  let validOn: string | null = null;
  let version: string | null = null;

  for (let i = 0; i < rawFeatures.length; i++) {
    if (i > 0 && i % 250 === 0) {
      await yieldToMain();
    }

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
    const geometry = geometryFromUnknown(feature.geometry);
    if (!geometry) {
      skippedCount++;
      continue;
    }

    const pcode = asString(props.adm3_pcode) || `row-${i}`;
    const id = `${pcode}#${i}`;
    const rowValidOn = asString(props.valid_on) || null;
    const rowVersion = asString(props.version) || null;
    if (!validOn && rowValidOn) validOn = rowValidOn;
    if (!version && rowVersion) version = rowVersion;

    const row: Admin3FeatureRow = {
      id,
      adm3_name: asString(props.adm3_name) || pcode,
      adm3_name_ar: asString(props.adm3_name1) || null,
      adm3_pcode: pcode,
      adm2_name: asString(props.adm2_name),
      adm1_name: asString(props.adm1_name),
      area_sqkm: asNumber(props.area_sqkm),
      center_lat: asNumber(props.center_lat),
      center_lon: asNumber(props.center_lon),
      valid_on: rowValidOn,
      version: rowVersion,
    };

    features.push(row);
    geometries.set(id, geometry);
  }

  if (!features.length) {
    throw new Admin3ParseError(
      'No usable Polygon/MultiPolygon features found. Unsupported geometry types were skipped.',
    );
  }

  return {
    fileName: file.name,
    collectionName,
    featureCount: features.length,
    skippedCount,
    validOn,
    version,
    features,
    geometries,
  };
}

export function mergeAdmin3Selection(
  dataset: Admin3Dataset,
  selectedIds: string[],
): { geometry: BoundaryGeometry; meta: Admin3ImportMeta } | null {
  const parts: BoundaryGeometry[] = [];
  const selectedPcodes: string[] = [];
  const selectedNames: string[] = [];

  for (const id of selectedIds) {
    const geom = dataset.geometries.get(id);
    const row = dataset.features.find((f) => f.id === id);
    if (!geom || !row) continue;
    parts.push(geom);
    selectedPcodes.push(row.adm3_pcode);
    selectedNames.push(row.adm3_name);
  }

  const geometry = mergeBoundaryGeometries(parts);
  if (!geometry) return null;

  return {
    geometry,
    meta: {
      sourceFileName: dataset.fileName,
      collectionName: dataset.collectionName,
      validOn: dataset.validOn,
      version: dataset.version,
      selectedPcodes,
      selectedNames,
      featureCount: selectedIds.length,
    },
  };
}
