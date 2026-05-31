import pointInPolygon from 'point-in-polygon';

type LngLat = [number, number];
type Ring = LngLat[];
type PolygonCoords = Ring[];
type MultiPolygonCoords = PolygonCoords[];

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoords }
  | { type: 'MultiPolygon'; coordinates: MultiPolygonCoords };

/** Haversine distance in meters between two WGS84 points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pointToSegmentMeters(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Planar approximation in local meters — sufficient for buffer checks.
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const px = lng * mPerDegLng;
  const py = lat * mPerDegLat;
  const x1 = lng1 * mPerDegLng;
  const y1 = lat1 * mPerDegLat;
  const x2 = lng2 * mPerDegLng;
  const y2 = lat2 * mPerDegLat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function minDistanceToRingMeters(lat: number, lng: number, ring: Ring): number {
  if (ring.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i]!;
    const [lng2, lat2] = ring[i + 1]!;
    min = Math.min(min, pointToSegmentMeters(lat, lng, lat1, lng1, lat2, lng2));
  }
  return min;
}

function minDistanceToPolygonMeters(lat: number, lng: number, polygon: PolygonCoords): number {
  if (!polygon.length) return Infinity;
  return minDistanceToRingMeters(lat, lng, polygon[0]!);
}

export function isPointInsideGeoJson(lat: number, lng: number, geojson: unknown): boolean {
  const geom = geojson as GeoJsonGeometry;
  const pt: LngLat = [lng, lat];
  if (geom?.type === 'Polygon') {
    const exterior = geom.coordinates[0];
    return exterior ? pointInPolygon(pt, exterior) : false;
  }
  if (geom?.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      const exterior = poly[0];
      if (exterior && pointInPolygon(pt, exterior)) return true;
    }
  }
  return false;
}

/** Minimum distance from point to polygon boundary (exterior ring) in meters. */
export function minDistanceToGeoJsonMeters(
  lat: number,
  lng: number,
  geojson: unknown,
): number {
  const geom = geojson as GeoJsonGeometry;
  if (geom?.type === 'Polygon') {
    return minDistanceToPolygonMeters(lat, lng, geom.coordinates);
  }
  if (geom?.type === 'MultiPolygon') {
    let min = Infinity;
    for (const poly of geom.coordinates) {
      min = Math.min(min, minDistanceToPolygonMeters(lat, lng, poly));
    }
    return min;
  }
  return Infinity;
}
