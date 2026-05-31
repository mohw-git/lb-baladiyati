import { booleanIntersects } from '@turf/boolean-intersects';
import { multiPolygon, polygon } from '@turf/helpers';
import type { GeoJsonGeometry } from './geojson-location.util';
import { boundaryBounds } from './geojson-boundary.util';

export type BoundaryOverlapHit = {
  municipalityId: string;
  name: string;
  code: string;
};

function geometryToTurf(geom: GeoJsonGeometry) {
  if (geom.type === 'Polygon') {
    return polygon(geom.coordinates);
  }
  return multiPolygon(geom.coordinates);
}

function boundsOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  const [aSouth, aWest, aNorth, aEast] = a;
  const [bSouth, bWest, bNorth, bEast] = b;
  return !(aEast < bWest || bEast < aWest || aNorth < bSouth || bNorth < aSouth);
}

/**
 * Detect intersections with other active municipality boundaries.
 * Uses Turf booleanIntersects after a bounding-box prefilter.
 */
export function findBoundaryOverlaps(
  candidate: GeoJsonGeometry,
  others: Array<{
    municipalityId: string;
    name: string;
    code: string;
    geojson: GeoJsonGeometry;
  }>,
): BoundaryOverlapHit[] {
  const candidateFeature = geometryToTurf(candidate);
  const candidateBounds = boundaryBounds(candidate);
  const hits: BoundaryOverlapHit[] = [];

  for (const other of others) {
    const otherBounds = boundaryBounds(other.geojson);
    if (!boundsOverlap(candidateBounds, otherBounds)) {
      continue;
    }
    try {
      const otherFeature = geometryToTurf(other.geojson);
      if (booleanIntersects(candidateFeature, otherFeature)) {
        hits.push({
          municipalityId: other.municipalityId,
          name: other.name,
          code: other.code,
        });
      }
    } catch {
      // Skip malformed peer geometry in overlap pass.
    }
  }

  return hits;
}
