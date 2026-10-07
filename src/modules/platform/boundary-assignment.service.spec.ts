import { ConflictException, NotFoundException } from '@nestjs/common';
import { MunicipalityBoundarySourceType } from '@prisma/client';
import { BoundaryAssignmentService } from './boundary-assignment.service';

describe('BoundaryAssignmentService', () => {
  const prisma = {
    municipality: { findUnique: jest.fn(), findMany: jest.fn() },
    boundarySourceImport: { findFirst: jest.fn() },
    boundarySourceAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    boundarySourceFeature: { findMany: jest.fn(), count: jest.fn() },
    municipalityBoundary: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        boundarySourceAssignment: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          create: jest.fn(),
        },
      }),
    ),
  };

  const importService = {
    getActiveImport: jest.fn(),
    getPendingImport: jest.fn(),
  };

  const boundaryService = {
    detectOverlaps: jest.fn().mockResolvedValue([]),
  };

  let service: BoundaryAssignmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BoundaryAssignmentService(
      prisma as any,
      importService as any,
      boundaryService as any,
    );
    prisma.municipality.findMany.mockResolvedValue([]);
    prisma.boundarySourceAssignment.groupBy.mockResolvedValue([]);
  });

  it('getWorkspace returns stats when no active import', async () => {
    importService.getActiveImport.mockResolvedValue(null);
    importService.getPendingImport.mockResolvedValue(null);
    prisma.municipality.findMany.mockResolvedValue([
      { id: 'm1', name: 'A', code: 'A', boundaryColor: null, boundary: null },
    ]);
    const ws = await service.getWorkspace();
    expect(ws.stats.missing).toBe(1);
    expect(ws.activeImport).toBeNull();
  });

  it('regenerateFromSource rejects manual boundary without switch', async () => {
    importService.getActiveImport.mockResolvedValue({ id: 'imp1' });
    prisma.municipality.findUnique.mockResolvedValue({
      id: 'm1',
      boundary: {
        isActive: true,
        sourceType: MunicipalityBoundarySourceType.MANUAL_GEOJSON,
        bufferMeters: 0,
      },
    });
    await expect(service.regenerateFromSource('m1', 'actor')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('clearMunicipalityAssignments requires confirmation', async () => {
    await expect(
      service.clearMunicipalityAssignments('m1', 'actor', false),
    ).rejects.toThrow();
  });

  it('updateBoundaryColor throws when municipality missing', async () => {
    prisma.municipality.findUnique.mockResolvedValue(null);
    await expect(
      service.updateBoundaryColor('missing', '#fff'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
