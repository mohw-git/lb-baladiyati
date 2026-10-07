import type L from 'leaflet';

export type BoundaryGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
};

const COORD_DECIMALS = 6;

export function roundCoord(n: number): number {
  return Math.round(n * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;
}

/** Close ring and snap last vertex to first (backend requires exact match). */
export function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const out = ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)] as [number, number]);
  const first = out[0]!;
  out[out.length - 1] = [first[0], first[1]];
  if (out.length < 4) {
    out.push([first[0], first[1]]);
  }
  return out;
}

function normalizePolygonCoords(coords: number[][][]): number[][][] {
  return coords.map((ring) => closeRing(ring as [number, number][]));
}

/** Parse geometry stored on the municipality boundary row (Polygon/MultiPolygon or Feature). */
export function parseStoredBoundaryGeometry(geojson: unknown): BoundaryGeometry | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Polygon' || obj.type === 'MultiPolygon') {
    return normalizeBoundaryGeometry(obj as BoundaryGeometry);
  }
  if (obj.type === 'Feature' && obj.geometry && typeof obj.geometry === 'object') {
    return parseStoredBoundaryGeometry(obj.geometry);
  }
  return null;
}

export function normalizeBoundaryGeometry(geom: BoundaryGeometry): BoundaryGeometry {
  if (geom.type === 'Polygon') {
    const coords = geom.coordinates as number[][][];
    return { type: 'Polygon', coordinates: normalizePolygonCoords(coords) };
  }
  const multi = geom.coordinates as number[][][][];
  return {
    type: 'MultiPolygon',
    coordinates: multi.map((poly) => normalizePolygonCoords(poly)),
  };
}

/** Extract Polygon/MultiPolygon from a Leaflet layer (drawn or imported). */
export function geometryFromLeafletLayer(layer: L.Layer): BoundaryGeometry | null {
  if (!('toGeoJSON' in layer) || typeof layer.toGeoJSON !== 'function') {
    return null;
  }
  const raw = layer.toGeoJSON() as GeoJSON.Feature | GeoJSON.Geometry;
  const geometry =
    raw.type === 'Feature' ? raw.geometry : (raw as GeoJSON.Geometry);
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return normalizeBoundaryGeometry({
      type: 'Polygon',
      coordinates: geometry.coordinates,
    });
  }
  if (geometry.type === 'MultiPolygon') {
    return normalizeBoundaryGeometry({
      type: 'MultiPolygon',
      coordinates: geometry.coordinates,
    });
  }
  return null;
}

/** Combine multiple Polygon/MultiPolygon parts into one stored geometry (no dissolve). */
export function mergeBoundaryGeometries(parts: BoundaryGeometry[]): BoundaryGeometry | null {
  if (!parts.length) return null;
  const polygons: number[][][][] = [];
  for (const g of parts) {
    if (g.type === 'Polygon') {
      polygons.push(g.coordinates as number[][][]);
    } else {
      for (const p of g.coordinates as number[][][][]) {
        polygons.push(p);
      }
    }
  }
  if (!polygons.length) return null;
  const merged =
    polygons.length === 1
      ? ({ type: 'Polygon' as const, coordinates: polygons[0]! })
      : ({ type: 'MultiPolygon' as const, coordinates: polygons });
  return normalizeBoundaryGeometry(merged);
}

export function geometryFromFeatureGroup(
  fg: L.FeatureGroup,
): BoundaryGeometry | null {
  const layers = fg.getLayers();
  const polygons: number[][][][] = [];
  for (const layer of layers) {
    const g = geometryFromLeafletLayer(layer);
    if (!g) continue;
    if (g.type === 'Polygon') {
      polygons.push(g.coordinates as number[][][]);
    } else {
      for (const p of g.coordinates as number[][][][]) {
        polygons.push(p);
      }
    }
  }
  if (!polygons.length) return null;
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0]! };
  }
  return { type: 'MultiPolygon', coordinates: polygons };
}
