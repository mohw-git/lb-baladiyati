import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { AUDIT_ACTIONS } from '../audit/audit.service';

describe('ComplaintsService.classifyComplaint', () => {
  const prisma = {
    complaint: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    complaintCategory: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const audit = { log: jest.fn() };
  const realtime = { complaintUpdated: jest.fn() };
  const permissionsResolver = { getUserPermissions: jest.fn() };
  const statusService = {};
  const assignmentsService = {};
  const notificationsService = {};
  const notificationRecipients = {};
  const municipalityResolution = {};
  const mail = {};
  const config = {};
  const storageService = {};

  let service: ComplaintsService;

  const complaintId = 'c1';
  const municipalityId = 'm1';
  const userId = 'u1';
  const categoryId = 'cat-new';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplaintsService(
      prisma as any,
      storageService as any,
      permissionsResolver as any,
      statusService as any,
      assignmentsService as any,
      audit as any,
      realtime as any,
      notificationsService as any,
      notificationRecipients as any,
      municipalityResolution as any,
      mail as any,
      config as any,
    );
    prisma.user.findUnique.mockResolvedValue({ email: 'admin@test.com' });
    prisma.complaint.update.mockResolvedValue({});
  });

  it('updates category and department from category', async () => {
    prisma.complaint.findFirst.mockResolvedValue({
      id: complaintId,
      municipalityId,
      categoryId: 'cat-old',
      departmentId: null,
      createdById: 'citizen-1',
      assignments: [],
    });
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: categoryId,
      name: 'Roads',
      departmentId: 'dept-roads',
    });

    const result = await service.classifyComplaint(
      complaintId,
      userId,
      municipalityId,
      categoryId,
    );

    expect(prisma.complaint.update).toHaveBeenCalledWith({
      where: { id: complaintId },
      data: { categoryId, departmentId: 'dept-roads' },
    });
    expect(result.departmentId).toBe('dept-roads');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.COMPLAINT_CLASSIFY }),
    );
    expect(realtime.complaintUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: complaintId,
        departmentId: 'dept-roads',
      }),
    );
  });

  it('rejects category from another municipality', async () => {
    prisma.complaint.findFirst.mockResolvedValue({
      id: complaintId,
      municipalityId,
      categoryId: 'cat-old',
      departmentId: null,
      createdById: 'citizen-1',
      assignments: [],
    });
    prisma.complaintCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.classifyComplaint(complaintId, userId, municipalityId, categoryId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.complaint.update).not.toHaveBeenCalled();
  });

  it('throws when complaint is missing', async () => {
    prisma.complaint.findFirst.mockResolvedValue(null);
    await expect(
      service.classifyComplaint(complaintId, userId, municipalityId, categoryId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks when active assignment conflicts with new department', async () => {
    prisma.complaint.findFirst.mockResolvedValue({
      id: complaintId,
      municipalityId,
      categoryId: 'cat-old',
      departmentId: 'dept-sanitation',
      createdById: 'citizen-1',
      assignments: [
        {
          assignedToId: 'worker-1',
          assignedTo: { departmentId: 'dept-sanitation' },
        },
      ],
    });
    prisma.complaintCategory.findFirst.mockResolvedValue({
      id: categoryId,
      name: 'Roads',
      departmentId: 'dept-roads',
    });

    await expect(
      service.classifyComplaint(complaintId, userId, municipalityId, categoryId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.complaint.update).not.toHaveBeenCalled();
    expect(realtime.complaintUpdated).not.toHaveBeenCalled();
  });
});
