import {
  GeoJsonBoundaryValidationError,
  normalizeBoundaryGeoJson,
  validateBufferMeters,
} from './geojson-boundary.util';

describe('normalizeBoundaryGeoJson', () => {
  const poly = {
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

  it('accepts Polygon', () => {
    const g = normalizeBoundaryGeoJson(poly);
    expect(g.type).toBe('Polygon');
  });

  it('accepts Feature wrapping Polygon', () => {
    const g = normalizeBoundaryGeoJson({ type: 'Feature', geometry: poly });
    expect(g.type).toBe('Polygon');
  });

  it('rejects unclosed ring', () => {
    expect(() =>
      normalizeBoundaryGeoJson({
        type: 'Polygon',
        coordinates: [
          [
            [35.4, 33.8],
            [35.6, 33.8],
            [35.6, 34.0],
            [35.4, 34.0],
          ],
        ],
      }),
    ).toThrow(GeoJsonBoundaryValidationError);
  });

  it('rejects invalid latitude', () => {
    expect(() =>
      normalizeBoundaryGeoJson({
        type: 'Polygon',
        coordinates: [
          [
            [35.4, 95],
            [35.6, 33.8],
            [35.6, 34.0],
            [35.4, 34.0],
            [35.4, 95],
          ],
        ],
      }),
    ).toThrow(GeoJsonBoundaryValidationError);
  });

  it('rejects unsupported type', () => {
    expect(() =>
      normalizeBoundaryGeoJson({ type: 'Point', coordinates: [35.5, 33.9] }),
    ).toThrow(GeoJsonBoundaryValidationError);
  });
});

describe('validateBufferMeters', () => {
  it('defaults to 0', () => {
    expect(validateBufferMeters(undefined)).toBe(0);
  });

  it('rejects out of range', () => {
    expect(() => validateBufferMeters(1001)).toThrow(GeoJsonBoundaryValidationError);
  });
});
