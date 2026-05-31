import { MunicipalityResolutionService } from './municipality-resolution.service';

describe('MunicipalityResolutionService', () => {
  const prisma = {
    municipalityBoundary: { findMany: jest.fn() },
    municipality: { findMany: jest.fn() },
  };

  let service: MunicipalityResolutionService;

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MunicipalityResolutionService(prisma as any);
  });

  it('returns EXACT when point is inside one boundary', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: {
          id: 'muni-b',
          name: 'Municipality B',
          code: 'B',
          nameAr: null,
          nameFr: null,
        },
      },
    ]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a');
    expect(result.status).toBe('EXACT');
    expect(result.municipalityId).toBe('muni-b');
    expect(result.method).toBe('BOUNDARY_EXACT');
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('returns AMBIGUOUS when multiple boundaries match', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm1', name: 'One', code: 'O1', nameAr: null, nameFr: null },
      },
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm2', name: 'Two', code: 'O2', nameAr: null, nameFr: null },
      },
    ]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a');
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.candidates).toHaveLength(2);
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('returns AMBIGUOUS when multiple buffer zones match', async () => {
    const distantPoly = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 0.01],
          [0.01, 0.01],
          [0.01, 0],
          [0, 0],
        ],
      ],
    };
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: distantPoly,
        bufferMeters: 999_999_999,
        municipality: { id: 'm1', name: 'One', code: 'O1', nameAr: null, nameFr: null },
      },
      {
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [1, 0],
              [1, 0.01],
              [1.01, 0.01],
              [1.01, 0],
              [1, 0],
            ],
          ],
        },
        bufferMeters: 999_999_999,
        municipality: { id: 'm2', name: 'Two', code: 'O2', nameAr: null, nameFr: null },
      },
    ]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a');
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.candidates).toHaveLength(2);
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('accepts selectedMunicipalityId when ambiguous', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm1', name: 'One', code: 'O1', nameAr: null, nameFr: null },
      },
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm2', name: 'Two', code: 'O2', nameAr: null, nameFr: null },
      },
    ]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a', 'm2');
    expect(result.municipalityId).toBe('m2');
    expect(result.method).toBe('USER_SELECTED_AMBIGUOUS');
  });

  it('returns OUT_OF_COVERAGE when no boundary match', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [36.0, 34.0],
              [36.2, 34.0],
              [36.2, 34.2],
              [36.0, 34.2],
              [36.0, 34.0],
            ],
          ],
        },
        bufferMeters: 0,
        municipality: { id: 'm-far', name: 'Far', code: 'F', nameAr: null, nameFr: null },
      },
    ]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a');
    expect(result.status).toBe('OUT_OF_COVERAGE');
    expect(result.municipalityId).toBeNull();
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('returns OUT_OF_COVERAGE when no boundaries configured', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([]);

    const result = await service.resolveFromCoordinates(33.9, 35.5, 'muni-a');
    expect(result.status).toBe('OUT_OF_COVERAGE');
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('throws LOCATION_REQUIRED when no coordinates on create', async () => {
    await expect(
      service.resolveForComplaintCreate(undefined, undefined, 'muni-a'),
    ).rejects.toMatchObject({ code: 'LOCATION_REQUIRED' });
  });

  it('throws OUT_OF_COVERAGE when no boundary match on create', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([]);

    await expect(
      service.resolveForComplaintCreate(33.9, 35.5, 'muni-a'),
    ).rejects.toMatchObject({ code: 'OUT_OF_COVERAGE' });
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });

  it('throws MUNICIPALITY_AMBIGUOUS when overlapping and no selection', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm1', name: 'One', code: 'O1', nameAr: null, nameFr: null },
      },
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm2', name: 'Two', code: 'O2', nameAr: null, nameFr: null },
      },
    ]);

    await expect(
      service.resolveForComplaintCreate(33.9, 35.5, 'muni-a'),
    ).rejects.toMatchObject({ code: 'MUNICIPALITY_AMBIGUOUS' });
  });

  it('throws INVALID_MUNICIPALITY_SELECTION for candidate not in list', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm1', name: 'One', code: 'O1', nameAr: null, nameFr: null },
      },
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: { id: 'm2', name: 'Two', code: 'O2', nameAr: null, nameFr: null },
      },
    ]);

    await expect(
      service.resolveForComplaintCreate(33.9, 35.5, 'muni-a', 'not-a-candidate'),
    ).rejects.toMatchObject({ code: 'INVALID_MUNICIPALITY_SELECTION' });
  });

  it('succeeds on create with exact boundary match', async () => {
    prisma.municipalityBoundary.findMany.mockResolvedValue([
      {
        geojson: poly,
        bufferMeters: 0,
        municipality: {
          id: 'muni-b',
          name: 'Municipality B',
          code: 'B',
          nameAr: null,
          nameFr: null,
        },
      },
    ]);

    const routing = await service.resolveForComplaintCreate(33.9, 35.5, 'muni-a');
    expect(routing.operationalMunicipalityId).toBe('muni-b');
    expect(routing.method).toBe('BOUNDARY_EXACT');
    expect(routing.locationResolvedAt).toBeInstanceOf(Date);
  });
});
