import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BoundarySourceImportStatus } from '@prisma/client';
import { BoundarySourceImportService } from './boundary-source-import.service';

describe('BoundarySourceImportService', () => {
  const prisma = {
    boundarySourceImport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    boundarySourceFeature: {
      createMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  let service: BoundarySourceImportService;

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
    service = new BoundarySourceImportService(prisma as any);
  });

  it('createImport sets IMPORTING status', async () => {
    prisma.boundarySourceImport.deleteMany.mockResolvedValue({ count: 0 });
    prisma.boundarySourceImport.create.mockResolvedValue({
      id: 'i1',
      status: BoundarySourceImportStatus.IMPORTING,
    });
    const imp = await service.createImport({ fileName: 'test.geojson' }, 'u1');
    expect(imp.id).toBe('i1');
  });

  it('addFeatures rejects archived import', async () => {
    prisma.boundarySourceImport.findUnique.mockResolvedValue({
      id: 'i1',
      status: BoundarySourceImportStatus.ARCHIVED,
    });
    await expect(
      service.addFeatures('i1', {
        features: [
          {
            featureKey: 'k1',
            adm3Name: 'A',
            adm3Pcode: 'LB001',
            adm2Name: 'B',
            adm1Name: 'C',
            geometry: poly,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activateImport requires features', async () => {
    prisma.boundarySourceImport.findUnique.mockResolvedValue({
      id: 'i1',
      status: BoundarySourceImportStatus.IMPORTING,
    });
    prisma.boundarySourceFeature.count.mockResolvedValue(0);
    await expect(service.activateImport('i1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activateImport throws when import missing', async () => {
    prisma.boundarySourceImport.findUnique.mockResolvedValue(null);
    await expect(service.activateImport('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('importDefaultSource refuses when active source exists and replace=false', async () => {
    prisma.boundarySourceImport.findFirst.mockResolvedValue({
      id: 'active1',
      status: BoundarySourceImportStatus.ACTIVE,
    });
    await expect(service.importDefaultSource('u1', { replace: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cancelImport deletes IMPORTING import', async () => {
    prisma.boundarySourceImport.findUnique.mockResolvedValue({
      id: 'i1',
      status: BoundarySourceImportStatus.IMPORTING,
    });
    prisma.boundarySourceImport.delete.mockResolvedValue({ id: 'i1' });
    const res = await service.cancelImport('i1');
    expect(res.cancelled).toBe(true);
  });
});
