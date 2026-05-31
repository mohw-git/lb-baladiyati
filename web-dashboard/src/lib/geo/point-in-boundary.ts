import pointInPolygon from 'point-in-polygon';
import type { BoundaryGeometry } from './boundary-geojson-export';

type LngLat = [number, number];

/** WGS84 point-in-polygon test for stored municipality boundary geometry. */
export function isPointInBoundary(
  lat: number,
  lng: number,
  geometry: BoundaryGeometry,
): boolean {
  const pt: LngLat = [lng, lat];
  if (geometry.type === 'Polygon') {
    const exterior = (geometry.coordinates as LngLat[][])[0];
    return exterior ? pointInPolygon(pt, exterior) : false;
  }
  for (const poly of geometry.coordinates as LngLat[][][]) {
    const exterior = poly[0];
    if (exterior && pointInPolygon(pt, exterior)) return true;
  }
  return false;
}
