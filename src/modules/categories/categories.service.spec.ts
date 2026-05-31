import { ForbiddenException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { AUDIT_ACTIONS } from '../audit/audit.service';

describe('CategoriesService access control', () => {
  const municipalityId = 'muni-1';
  const actor = { id: 'user-hod', email: 'hod@test.gov' };

  const hodPermissions = [
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,
  ];

  const assignerPermissions = [
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,
    PERMISSIONS.CATEGORY_DELETE,
  ];

  let prisma: any;
  let permissionsResolver: any;
  let audit: any;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      department: { findFirst: jest.fn() },
      complaintCategory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    permissionsResolver = {
      getUserPermissions: jest.fn(),
    };
    audit = { logFromRequest: jest.fn() };
    service = new CategoriesService(prisma, permissionsResolver, audit);
  });

  function mockHod(departmentId = 'dept-a') {
    permissionsResolver.getUserPermissions.mockResolvedValue(hodPermissions);
    prisma.user.findUnique.mockResolvedValue({ departmentId });
  }

  it('filters admin list to HOD department only', async () => {
    mockHod('dept-a');
    prisma.complaintCategory.findMany.mockResolvedValue([]);

    await service.findAll(municipalityId, true, actor.id);

    expect(prisma.complaintCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          municipalityId,
          departmentId: 'dept-a',
        }),
      }),
    );
  });

  it('rejects HOD creating a category for another department', async () => {
    mockHod('dept-a');

    await expect(
      service.create(
        municipalityId,
        { name: 'Test', departmentId: 'dept-b' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects HOD updating another department category', async () => {
    mockHod('dept-a');
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      name: 'Roads',
      departmentId: 'dept-b',
      icon: null,
      isActive: true,
    });

    await expect(
      service.update('cat-1', municipalityId, { name: 'Updated' }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects HOD moving a category between departments', async () => {
    mockHod('dept-a');
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      name: 'Roads',
      departmentId: 'dept-a',
      icon: null,
      isActive: true,
    });

    await expect(
      service.update(
        'cat-1',
        municipalityId,
        { departmentId: 'dept-b' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects HOD managing municipality-wide (null department) categories', async () => {
    mockHod('dept-a');
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: 'cat-other',
      name: 'Other',
      departmentId: null,
      icon: null,
      isActive: true,
    });

    await expect(
      service.toggleActive('cat-other', municipalityId, false, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows Assigner to create municipality-wide categories', async () => {
    permissionsResolver.getUserPermissions.mockResolvedValue(assignerPermissions);
    prisma.user.findUnique.mockResolvedValue({ departmentId: null });
    prisma.complaintCategory.findFirst.mockResolvedValue(null);
    prisma.complaintCategory.create.mockResolvedValue({
      id: 'cat-new',
      name: 'Other',
      departmentId: null,
      department: null,
    });

    await service.create(municipalityId, { name: 'Other' }, actor);

    expect(prisma.complaintCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ departmentId: null }),
      }),
    );
    expect(audit.logFromRequest).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ action: AUDIT_ACTIONS.CATEGORY_CREATE }),
    );
  });

  it('soft-deletes categories without removing rows', async () => {
    permissionsResolver.getUserPermissions.mockResolvedValue(assignerPermissions);
    prisma.user.findUnique.mockResolvedValue({ departmentId: null });
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      name: 'Roads',
      departmentId: 'dept-a',
      icon: null,
      isActive: true,
    });
    prisma.complaintCategory.update.mockResolvedValue({});

    await service.remove('cat-1', municipalityId, actor);

    expect(prisma.complaintCategory.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { isActive: false },
    });
    expect(audit.logFromRequest).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        action: AUDIT_ACTIONS.CATEGORY_DELETE,
        metadata: expect.objectContaining({ softDelete: true }),
      }),
    );
  });
});
