import type { GeoJsonGeometry } from './geojson-location.util';

type PolygonCoords = number[][][];
type MultiPolygonCoords = PolygonCoords[];

export class GeoJsonBoundaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoJsonBoundaryValidationError';
  }
}

const SUPPORTED_GEOMETRY_TYPES = new Set(['Polygon', 'MultiPolygon']);
const MAX_BUFFER_METERS = 1000;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function validatePosition(pos: unknown, path: string): void {
  if (!Array.isArray(pos) || pos.length < 2) {
    throw new GeoJsonBoundaryValidationError(`${path}: each position must be [longitude, latitude].`);
  }
  const lng = pos[0];
  const lat = pos[1];
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    throw new GeoJsonBoundaryValidationError(`${path}: coordinates must be numbers.`);
  }
  if (lng < -180 || lng > 180) {
    throw new GeoJsonBoundaryValidationError(`${path}: longitude must be between -180 and 180.`);
  }
  if (lat < -90 || lat > 90) {
    throw new GeoJsonBoundaryValidationError(`${path}: latitude must be between -90 and 90.`);
  }
}

function validateRing(ring: unknown, path: string): void {
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new GeoJsonBoundaryValidationError(
      `${path}: a polygon ring must have at least 4 positions (closed ring).`,
    );
  }
  ring.forEach((pos, i) => validatePosition(pos, `${path}[${i}]`));
  const first = ring[0] as number[];
  const last = ring[ring.length - 1] as number[];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new GeoJsonBoundaryValidationError(`${path}: the first and last positions must be identical.`);
  }
}

function validatePolygonCoords(coords: unknown, path: string): void {
  if (!Array.isArray(coords) || coords.length === 0) {
    throw new GeoJsonBoundaryValidationError(`${path}: polygon must have at least one ring.`);
  }
  coords.forEach((ring, i) => validateRing(ring, `${path}[${i}]`));
}

function extractPolygonGeometries(obj: Record<string, unknown>): GeoJsonGeometry[] {
  const type = obj.type;
  if (type === 'Polygon') {
    validatePolygonCoords(obj.coordinates, 'coordinates');
    return [{ type: 'Polygon', coordinates: obj.coordinates } as GeoJsonGeometry];
  }
  if (type === 'MultiPolygon') {
    const polys = obj.coordinates;
    if (!Array.isArray(polys) || polys.length === 0) {
      throw new GeoJsonBoundaryValidationError('MultiPolygon must contain at least one polygon.');
    }
    polys.forEach((p, i) => validatePolygonCoords(p, `coordinates[${i}]`));
    return [
      {
        type: 'MultiPolygon',
        coordinates: polys,
      } as GeoJsonGeometry,
    ];
  }
  if (type === 'Feature') {
    const geom = obj.geometry;
    if (!geom || typeof geom !== 'object') {
      throw new GeoJsonBoundaryValidationError('Feature must include a geometry object.');
    }
    return extractPolygonGeometries(geom as Record<string, unknown>);
  }
  if (type === 'FeatureCollection') {
    const features = obj.features;
    if (!Array.isArray(features) || features.length === 0) {
      throw new GeoJsonBoundaryValidationError('FeatureCollection must include at least one feature.');
    }
    const polygons: GeoJsonGeometry[] = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f || typeof f !== 'object') {
        throw new GeoJsonBoundaryValidationError(`features[${i}] is invalid.`);
      }
      const ft = f as Record<string, unknown>;
      if (ft.type !== 'Feature') {
        throw new GeoJsonBoundaryValidationError(`features[${i}] must be a Feature.`);
      }
      polygons.push(...extractPolygonGeometries(ft));
    }
    if (!polygons.length) {
      throw new GeoJsonBoundaryValidationError('FeatureCollection has no Polygon or MultiPolygon geometries.');
    }
    return polygons;
  }
  throw new GeoJsonBoundaryValidationError(
    `Unsupported GeoJSON type "${String(type)}". Use Polygon, MultiPolygon, Feature, or FeatureCollection.`,
  );
}

/** Merge multiple polygon geometries into one stored geometry (no topological dissolve). */
export function mergeBoundaryGeometries(geometries: GeoJsonGeometry[]): GeoJsonGeometry | null {
  if (!geometries.length) return null;
  return mergeToSingleGeometry(geometries);
}

function mergeToSingleGeometry(geometries: GeoJsonGeometry[]): GeoJsonGeometry {
  if (geometries.length === 1) {
    return geometries[0]!;
  }
  const allPolyCoords: MultiPolygonCoords = [];
  for (const g of geometries) {
    if (g.type === 'Polygon') {
      allPolyCoords.push(g.coordinates);
    } else {
      for (const p of g.coordinates) {
        allPolyCoords.push(p);
      }
    }
  }
  if (allPolyCoords.length === 1) {
    return { type: 'Polygon', coordinates: allPolyCoords[0]! } as GeoJsonGeometry;
  }
  return { type: 'MultiPolygon', coordinates: allPolyCoords } as GeoJsonGeometry;
}

/**
 * Parse and validate boundary GeoJSON input; returns normalized geometry for storage.
 * Stored shape matches MunicipalityResolutionService (Polygon | MultiPolygon only).
 */
export function normalizeBoundaryGeoJson(input: unknown): GeoJsonGeometry {
  if (input === null || input === undefined) {
    throw new GeoJsonBoundaryValidationError('GeoJSON is required.');
  }
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new GeoJsonBoundaryValidationError('Invalid JSON.');
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new GeoJsonBoundaryValidationError('GeoJSON must be a JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.type) {
    throw new GeoJsonBoundaryValidationError('GeoJSON must include a type property.');
  }
  const geometries = extractPolygonGeometries(obj);
  return mergeToSingleGeometry(geometries);
}

export function validateBufferMeters(bufferMeters: unknown): number {
  if (bufferMeters === undefined || bufferMeters === null) {
    return 0;
  }
  if (!isFiniteNumber(bufferMeters) || !Number.isInteger(bufferMeters)) {
    throw new GeoJsonBoundaryValidationError('bufferMeters must be a whole number.');
  }
  if (bufferMeters < 0 || bufferMeters > MAX_BUFFER_METERS) {
    throw new GeoJsonBoundaryValidationError(
      `bufferMeters must be between 0 and ${MAX_BUFFER_METERS}.`,
    );
  }
  return bufferMeters;
}

/** Approximate bounding box [south, west, north, east] for map preview. */
export function boundaryBounds(geometry: GeoJsonGeometry): [number, number, number, number] {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  const visitPos = (pos: number[]) => {
    const lng = pos[0]!;
    const lat = pos[1]!;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  };

  const visitRing = (ring: number[][]) => {
    for (const pos of ring) visitPos(pos);
  };

  if (geometry.type === 'Polygon') {
    const exterior = geometry.coordinates[0];
    if (exterior) visitRing(exterior);
  } else {
    for (const poly of geometry.coordinates) {
      const exterior = poly[0];
      if (exterior) visitRing(exterior);
    }
  }

  if (!Number.isFinite(minLat)) {
    return [33.9, 35.5, 33.9, 35.5];
  }
  return [minLat, minLng, maxLat, maxLng];
}

export const BOUNDARY_SAMPLE_GEOJSON: GeoJsonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [35.4, 33.8],
      [35.6, 33.8],
      [35.6, 34.0],
      [35.4, 34.0],
      [35.4, 33.8],
    ],
  ],
};
