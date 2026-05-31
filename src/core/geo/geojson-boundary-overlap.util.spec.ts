import { findBoundaryOverlaps } from './geojson-boundary-overlap.util';
import type { GeoJsonGeometry } from './geojson-location.util';

const polyA: GeoJsonGeometry = {
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

const polyB: GeoJsonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [35.5, 33.85],
      [35.7, 33.85],
      [35.7, 34.05],
      [35.5, 34.05],
      [35.5, 33.85],
    ],
  ],
};

const polyFar: GeoJsonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [36.0, 34.5],
      [36.2, 34.5],
      [36.2, 34.7],
      [36.0, 34.7],
      [36.0, 34.5],
    ],
  ],
};

describe('findBoundaryOverlaps', () => {
  it('detects overlapping municipalities', () => {
    const hits = findBoundaryOverlaps(polyA, [
      {
        municipalityId: 'm2',
        name: 'Other',
        code: 'O2',
        geojson: polyB,
      },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.municipalityId).toBe('m2');
  });

  it('returns empty when boundaries do not intersect', () => {
    const hits = findBoundaryOverlaps(polyA, [
      {
        municipalityId: 'm3',
        name: 'Far',
        code: 'F',
        geojson: polyFar,
      },
    ]);
    expect(hits).toHaveLength(0);
  });
});
