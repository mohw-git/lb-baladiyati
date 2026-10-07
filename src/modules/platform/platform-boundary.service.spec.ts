import { NotFoundException } from '@nestjs/common';
import { PlatformBoundaryService } from './platform-boundary.service';

describe('PlatformBoundaryService', () => {
  const prisma = {
    municipality: { findUnique: jest.fn() },
    municipalityBoundary: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };

  let service: PlatformBoundaryService;

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
    service = new PlatformBoundaryService(prisma as any, audit as any);
    prisma.municipality.findUnique.mockResolvedValue({
      id: 'm1',
      name: 'Test',
      code: 'TST',
    });
  });

  it('returns not configured when no boundary row', async () => {
    prisma.municipalityBoundary.findUnique.mockResolvedValue(null);
    const res = await service.getBoundary('m1');
    expect(res.configured).toBe(false);
    expect(res.geojson).toBeNull();
  });

  it('upserts boundary and audits create', async () => {
    prisma.municipalityBoundary.findUnique.mockResolvedValue(null);
    prisma.municipalityBoundary.upsert.mockResolvedValue({
      id: 'b1',
      municipalityId: 'm1',
      geojson: poly,
      bufferMeters: 50,
      isActive: true,
      updatedAt: new Date('2026-01-01'),
    });

    const res = await service.upsertBoundary(
      'm1',
      { geojson: poly, bufferMeters: 50 },
      'actor-1',
      'admin@test.com',
    );

    expect(res.configured).toBe(true);
    expect(res.isActive).toBe(true);
    expect(res.bufferMeters).toBe(50);
    expect(audit.log).toHaveBeenCalled();
  });

  it('deactivates boundary', async () => {
    prisma.municipalityBoundary.findUnique.mockResolvedValue({
      id: 'b1',
      geojson: poly,
      bufferMeters: 0,
      isActive: true,
      updatedAt: new Date(),
    });
    prisma.municipalityBoundary.update.mockResolvedValue({
      id: 'b1',
      municipalityId: 'm1',
      geojson: poly,
      bufferMeters: 0,
      isActive: false,
      updatedAt: new Date('2026-01-02'),
    });

    const res = await service.deactivateBoundary('m1', 'actor-1');
    expect(res.isActive).toBe(false);
    expect(prisma.municipalityBoundary.update).toHaveBeenCalledWith({
      where: { municipalityId: 'm1' },
      data: { isActive: false },
    });
  });

  it('throws when municipality missing', async () => {
    prisma.municipality.findUnique.mockResolvedValue(null);
    await expect(service.getBoundary('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
