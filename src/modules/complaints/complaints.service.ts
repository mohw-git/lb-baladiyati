import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { generateReferenceCode } from '../../core/common/utils/reference-code.util';
import { paginate } from '../../core/common/dto/pagination.dto';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { StatusService } from './status.service';
import { AssignmentsService } from './assignments.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ComplaintStatus, AttachmentStage, AttachmentType, ComplaintPriority, RejectionReason, VerificationStatus, NotificationType } from '@prisma/client';

function friendlyStatus(status: ComplaintStatus, locale: 'EN' | 'AR' | 'FR'): string {
  const map: Record<'EN' | 'AR' | 'FR', Record<ComplaintStatus, string>> = {
    EN: {
      SUBMITTED: 'submitted',
      UNDER_REVIEW: 'under review',
      ASSIGNED: 'assigned',
      IN_PROGRESS: 'in progress',
      PENDING_APPROVAL: 'pending approval',
      COMPLETED: 'completed',
      CLOSED: 'closed',
      REJECTED: 'rejected',
    } as any,
    AR: {
      SUBMITTED: 'مُقدَّمة',
      UNDER_REVIEW: 'قيد المراجعة',
      ASSIGNED: 'تم تعيينها',
      IN_PROGRESS: 'قيد التنفيذ',
      PENDING_APPROVAL: 'بانتظار الموافقة',
      COMPLETED: 'مكتملة',
      CLOSED: 'مُغلقة',
      REJECTED: 'مرفوضة',
    } as any,
    FR: {
      SUBMITTED: 'soumise',
      UNDER_REVIEW: 'en revue',
      ASSIGNED: 'assignée',
      IN_PROGRESS: 'en cours',
      PENDING_APPROVAL: "en attente d'approbation",
      COMPLETED: 'résolue',
      CLOSED: 'clôturée',
      REJECTED: 'rejetée',
    } as any,
  };
  return map[locale][status] ?? status;
}

// Default SLA hours by priority
const PRIORITY_SLA_HOURS: Record<ComplaintPriority, number> = {
  LOW: 168,      // 7 days
  MEDIUM: 72,    // 3 days
  HIGH: 24,      // 1 day
  URGENT: 4,     // 4 hours
};

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private permissionsResolver: PermissionsResolver,
    private statusService: StatusService,
    private assignmentsService: AssignmentsService,
    private audit: AuditService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  /**
   * Citizen-facing notification for a complaint status change.
   * Title/body are in the user's preferred locale; the assignee identity
   * is intentionally NOT mentioned so we don't leak it via push.
   */
  private async notifyCitizenOfStatusChange(
    complaint: { id: string; createdById: string; municipalityId: string; referenceCode?: string | null },
    newStatus: ComplaintStatus,
  ) {
    try {
      const creator = await this.prisma.user.findUnique({
        where: { id: complaint.createdById },
        select: { locale: true, email: true, firstName: true },
      });
      const locale = (creator?.locale ?? 'EN') as 'EN' | 'AR' | 'FR';
      const ref = complaint.referenceCode ?? complaint.id;
      const titles: Record<'EN' | 'AR' | 'FR', string> = {
        EN: 'Complaint update',
        AR: 'تحديث الشكوى',
        FR: 'Mise à jour de la réclamation',
      };
      const bodies: Record<'EN' | 'AR' | 'FR', string> = {
        EN: `Your complaint ${ref} is now ${friendlyStatus(newStatus, 'EN')}.`,
        AR: `الشكوى ${ref} حالتها الآن ${friendlyStatus(newStatus, 'AR')}.`,
        FR: `Votre réclamation ${ref} est maintenant ${friendlyStatus(newStatus, 'FR')}.`,
      };
      await this.notifications.createAndSend(
        complaint.municipalityId,
        [complaint.createdById],
        NotificationType.COMPLAINT_STATUS_CHANGED,
        titles[locale],
        bodies[locale],
        {
          complaintId: complaint.id,
          referenceCode: ref,
          status: newStatus,
          deepLink: `/complaints/${complaint.id}`,
        },
      );

      // Best-effort email notification — never break the business event.
      // Citizen-facing only: no staff identity, no internal notes, only the
      // reference code, the localized status, and a link they can reach.
      if (creator?.email) {
        const baseUrl =
          this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3001';
        const tpl = this.mail.complaintStatusChanged(locale, {
          referenceCode: String(ref),
          localizedStatus: friendlyStatus(newStatus, locale),
          complaintUrl: `${baseUrl.replace(/\/$/, '')}/complaints/${complaint.id}`,
          firstName: creator.firstName,
        });
        await this.mail.send({ to: creator.email, ...tpl }).catch(() => undefined);
      }
    } catch (err) {
      // Notification failure must never break the underlying business event.
      console.warn(
        `Failed to send status notification for complaint ${complaint.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  async create(
    userId: string,
    municipalityId: string,
    dto: CreateComplaintDto,
    files?: Express.Multer.File[],
  ) {
    // Check KYC verification - citizens must be verified to submit complaints
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verificationStatus: true },
    });

    if (creator?.verificationStatus !== VerificationStatus.VERIFIED) {
      // Check if user has admin/staff permissions (staff bypass KYC)
      const permissions = await this.permissionsResolver.getUserPermissions(userId);
      const isStaff = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
                      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
                      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

      if (!isStaff) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'USER_NOT_VERIFIED',
          message: 'Identity verification required to submit complaints. Please complete KYC verification first.',
        });
      }
    }

    // Hard limit photo count even if multer was bypassed (defence in depth).
    if (files && files.length > 5) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'TOO_MANY_FILES',
        message: 'A maximum of 5 photos can be attached per complaint.',
      });
    }
    if (files) {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'FILE_TOO_LARGE',
            message: 'Each photo must be 10MB or smaller.',
          });
        }
      }
    }

    // Verify category exists
    const category = await this.prisma.complaintCategory.findFirst({
      where: {
        id: dto.categoryId,
        municipalityId,
        isActive: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Get municipality code for reference
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { code: true },
    });

    // Generate sequential reference code (BEI-CMP-2026-000001)
    const referenceCode = await generateReferenceCode(
      this.prisma,
      municipalityId,
      municipality!.code,
    );

    // Create complaint
    const complaint = await this.prisma.complaint.create({
      data: {
        municipalityId,
        categoryId: dto.categoryId,
        departmentId: category.departmentId,
        createdById: userId,
        referenceCode,
        title: dto.title,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        status: ComplaintStatus.SUBMITTED,
      },
    });

    // Create initial status log
    await this.prisma.complaintStatusLog.create({
      data: {
        complaintId: complaint.id,
        changedById: userId,
        fromStatus: null,
        toStatus: ComplaintStatus.SUBMITTED,
      },
    });

    // Save attachments
    const attachments = [];
    if (files?.length) {
      for (const file of files) {
        const url = await this.storageService.saveFile(file, 'complaints');
        const attachment = await this.prisma.complaintAttachment.create({
          data: {
            complaintId: complaint.id,
            type: this.storageService.getFileType(file.mimetype) as AttachmentType,
            stage: AttachmentStage.SUBMISSION,
            url,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
        });
        attachments.push({
          id: attachment.id,
          url: attachment.url,
          type: attachment.type,
          stage: attachment.stage,
        });
      }
    }

    // Audit (best-effort, never blocks)
    const creatorEmail = await this.prisma.user
      .findUnique({ where: { id: userId }, select: { email: true } })
      .then((u) => u?.email);
    await this.audit.log({
      actorId: userId,
      actorEmail: creatorEmail,
      municipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_CREATE,
      resourceType: 'Complaint',
      resourceId: complaint.id,
      metadata: {
        referenceCode: complaint.referenceCode,
        title: complaint.title,
        attachmentCount: attachments.length,
      },
    });

    // Realtime: tell HODs/Assigners/Admins in this muni a new complaint landed
    this.realtime.complaintCreated({
      id: complaint.id,
      municipalityId,
      departmentId: complaint.departmentId,
      createdById: userId,
    });

    return {
      id: complaint.id,
      referenceCode: complaint.referenceCode,
      title: complaint.title,
      status: complaint.status,
      attachments,
      createdAt: complaint.createdAt,
    };
  }

  async findAll(userId: string, municipalityId: string, query: ComplaintQueryDto) {
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    
    const where: any = {
      municipalityId,
      deletedAt: null,
    };

    // Initialize AND array for combining filters
    where.AND = where.AND || [];

    // Filter based on permissions (hierarchical)
    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      // Admin can see all - no additional filter
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) {
      // HOD/Supervisor sees their department + unassigned complaints
      if (user?.departmentId) {
        where.AND.push({
          OR: [
            { departmentId: user.departmentId },
            { departmentId: null },
          ],
        });
      }
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
      // Field workers always see their assigned complaints
      where.assignments = {
        some: { assignedToId: userId, isActive: true },
      };
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
      // Citizens see their own complaints
      where.createdById = userId;
    } else {
      // No view permission - return empty
      return paginate([], 0, query);
    }

    // Additional filters
    if (query.status?.length) {
      where.status = { in: query.status };
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // Only apply department filter if user has permission to view all
    if (query.departmentId && permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      where.departmentId = query.departmentId;
    }

    // Priority filter
    if (query.priority?.length) {
      where.priority = { in: query.priority };
    }

    // Overdue filter
    if (query.overdue !== undefined) {
      const now = new Date();
      if (query.overdue) {
        where.dueDate = { lt: now };
        where.status = { notIn: [ComplaintStatus.COMPLETED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] };
      } else {
        where.AND.push({
          OR: [
            { dueDate: null },
            { dueDate: { gte: now } },
          ],
        });
      }
    }

    if (query.search) {
      where.AND.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { referenceCode: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    // "Assigned to me" — narrows results to complaints where the caller has an
    // active assignment. Honoured for any user with at least view_assigned;
    // for view_all/view_department this layers on top of the permission scope.
    if (query.myAssignments) {
      where.AND.push({
        assignments: { some: { assignedToId: userId, isActive: true } },
      });
    }

    // "Unassigned inbox" — complaints with no active assignment yet. The
    // typical action queue for HOD/Supervisor: "what landed in my dept that
    // nobody owns yet?".
    if (query.unassigned) {
      where.AND.push({
        assignments: { none: { isActive: true } },
      });
    }

    // "Action queue" buckets (Needs attention, Overdue) only count open
    // complaints. The table needs the same filter so the count badge and the
    // visible rows agree — otherwise a completed/closed complaint with no
    // active assignment shows up in the table but isn't counted.
    if (query.openOnly) {
      where.AND.push({
        status: {
          notIn: [
            ComplaintStatus.COMPLETED,
            ComplaintStatus.CLOSED,
            ComplaintStatus.REJECTED,
          ],
        },
      });
    }

    // Clean up empty AND array
    if (where.AND.length === 0) {
      delete where.AND;
    }

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        select: {
          id: true,
          referenceCode: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          category: {
            select: { id: true, name: true },
          },
          department: {
            select: { id: true, name: true },
          },
          createdAt: true,
        },
        skip: query.skip,
        take: query.limit,
        orderBy: [
          // Prioritize by urgency, then due date
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.complaint.count({ where }),
    ]);

    // Add isOverdue flag
    const now = new Date();
    const complaintsWithOverdue = complaints.map((c) => ({
      ...c,
      isOverdue: c.dueDate ? c.dueDate < now && !['COMPLETED', 'CLOSED', 'REJECTED'].includes(c.status) : false,
    }));

    return paginate(complaintsWithOverdue, total, query);
  }

  /**
   * Same scoping rules as findAll, but returns up to `cap` flat rows suitable
   * for CSV/Excel export. Permission filters are NOT bypassed: a worker who
   * can only see assigned complaints still only exports their assigned ones.
   *
   * Cap exists to avoid pulling the entire municipality history into memory.
   */
  async exportAll(
    userId: string,
    municipalityId: string,
    query: ComplaintQueryDto,
    cap = 50_000,
  ) {
    // Reuse findAll's filtering by asking for the cap as the page size.
    const exportQuery = Object.assign(
      Object.create(Object.getPrototypeOf(query)),
      query,
      { page: 1, limit: cap },
    ) as ComplaintQueryDto;

    const { data } = await this.findAll(userId, municipalityId, exportQuery);

    // Flatten for CSV: no nested objects.
    return data.map((c: any) => ({
      referenceCode: c.referenceCode ?? '',
      title: c.title,
      status: c.status,
      priority: c.priority,
      category: c.category?.name ?? '',
      department: c.department?.name ?? '',
      dueDate: c.dueDate ? new Date(c.dueDate).toISOString() : '',
      isOverdue: c.isOverdue ? 'yes' : 'no',
      createdAt: new Date(c.createdAt).toISOString(),
    }));
  }

  async findOne(complaintId: string, userId: string, municipalityId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        attachments: {
          where: { deletedAt: null },
          select: {
            id: true,
            url: true,
            type: true,
            stage: true,
            filename: true,
          },
        },
        statusLogs: {
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            notes: true,
            changedBy: { select: { id: true, firstName: true, lastName: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        feedback: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            givenBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Get user info for department-based access
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);

    // Check access (hierarchical)
    const canViewAll = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const canViewDepartment = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT);
    const isOwner = complaint.createdById === userId;
    const isAssigned = await this.assignmentsService.isAssignedTo(complaintId, userId);
    // HOD/Supervisor can view complaints in their department OR unassigned complaints
    const isSameDepartment = user?.departmentId && complaint.departmentId === user.departmentId;
    const isUnassignedComplaint = complaint.departmentId === null;
    const canViewAsDepartmentHead = canViewDepartment && (isSameDepartment || isUnassignedComplaint);

    if (!canViewAll && !isOwner && !isAssigned && !canViewAsDepartmentHead) {
      throw new ForbiddenException('You do not have access to this complaint');
    }

    // Get current assignment
    const currentAssignment = await this.assignmentsService.getActiveAssignment(complaintId);

    // Calculate overdue status
    const now = new Date();
    const isOverdue = complaint.dueDate 
      ? complaint.dueDate < now && !['COMPLETED', 'CLOSED', 'REJECTED'].includes(complaint.status)
      : false;

    // ── Citizen privacy ────────────────────────────────────────────────
    // A user that is *only* the complaint owner (no staff permissions) must
    // never see the assigned employee's identity, internal notes, or the
    // identity of staff who changed the status. Strip those fields here so
    // the response cannot leak via DTO/serializer drift.
    const isCitizenOnly = isOwner && !canViewAll && !canViewAsDepartmentHead && !isAssigned;

    const safeStatusHistory = complaint.statusLogs.map((log: any) => ({
      id: log.id,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      // Hide staff notes from citizens — these are internal triage notes.
      notes: isCitizenOnly ? null : log.notes,
      changedBy: isCitizenOnly ? null : log.changedBy,
      createdAt: log.createdAt,
    }));

    const safeAssignment = currentAssignment
      ? isCitizenOnly
        ? {
            // Citizens see only that the complaint *is* assigned, not who.
            assignedAt: currentAssignment.createdAt,
            // Department is allowed (it's already on the complaint root).
            isAssigned: true,
          }
        : {
            assignedTo: currentAssignment.assignedTo,
            assignedBy: currentAssignment.assignedBy,
            notes: currentAssignment.notes,
            createdAt: currentAssignment.createdAt,
          }
      : null;

    return {
      id: complaint.id,
      referenceCode: complaint.referenceCode,
      title: complaint.title,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      dueDate: complaint.dueDate,
      isOverdue,
      rejectionReason: complaint.rejectionReason,
      rejectionNotes: complaint.rejectionNotes,
      resolvedAt: complaint.resolvedAt,
      escalatedAt: complaint.escalatedAt,
      latitude: complaint.latitude?.toString(),
      longitude: complaint.longitude?.toString(),
      address: complaint.address,
      category: complaint.category,
      department: complaint.department,
      createdBy: complaint.createdBy,
      attachments: complaint.attachments,
      currentAssignment: safeAssignment,
      statusHistory: safeStatusHistory,
      feedback: complaint.feedback,
      createdAt: complaint.createdAt,
    };
  }

  async changeStatus(
    complaintId: string,
    userId: string,
    municipalityId: string,
    dto: ChangeStatusDto,
    files?: Express.Multer.File[],
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Validate transition
    this.statusService.validateTransition(complaint.status, dto.status);

    // Get user permissions for role-based checks
    const permissions = await this.permissionsResolver.getUserPermissions(userId);

    // Check if worker transition requires being assigned
    if (this.statusService.isWorkerTransition(dto.status)) {
      const isAssigned = await this.assignmentsService.isAssignedTo(complaintId, userId);
      if (!isAssigned) {
        throw new ForbiddenException('You must be assigned to this complaint to perform this action');
      }
    }

    // Check if supervisor transition requires verify permission
    if (this.statusService.isSupervisorTransition(dto.status)) {
      if (!permissions.includes(PERMISSIONS.COMPLAINT_VERIFY) && 
          !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }

    // Check if approval transition requires approve permission
    if (this.statusService.isApprovalTransition(dto.status)) {
      if (!permissions.includes(PERMISSIONS.COMPLAINT_APPROVE) && 
          !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
        throw new ForbiddenException('You do not have approval authority');
      }
    }

    // Check if proof attachment is required (for PENDING_APPROVAL)
    if (this.statusService.requiresProofAttachment(dto.status)) {
      if (!files?.length) {
        throw new BadRequestException('Proof photos are required to submit for approval');
      }

      // Save proof attachments
      for (const file of files) {
        const url = await this.storageService.saveFile(file, 'complaints');
        await this.prisma.complaintAttachment.create({
          data: {
            complaintId,
            type: this.storageService.getFileType(file.mimetype) as AttachmentType,
            stage: AttachmentStage.PROOF,
            url,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
        });
      }
    }

    // Build update data
    const updateData: any = { status: dto.status };

    // Mark resolved time for completion
    if (dto.status === ComplaintStatus.COMPLETED) {
      updateData.resolvedAt = new Date();
    }

    // Update status
    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // Log status change
    await this.prisma.complaintStatusLog.create({
      data: {
        complaintId,
        changedById: userId,
        fromStatus: complaint.status,
        toStatus: dto.status,
        notes: dto.notes,
      },
    });

    // Audit (separate from per-complaint status_log → cross-tenant searchable)
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.audit.log({
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_STATUS_CHANGE,
      resourceType: 'Complaint',
      resourceId: complaintId,
      metadata: {
        from: complaint.status,
        to: dto.status,
        notes: dto.notes,
      },
    });

    // Realtime notify everyone watching this complaint (creator, assignees, dept, muni)
    const assignedUserIds = await this.prisma.complaintAssignment
      .findMany({
        where: { complaintId, isActive: true },
        select: { assignedToId: true },
      })
      .then((rows) => rows.map((r) => r.assignedToId));
    this.realtime.complaintUpdated({
      id: complaintId,
      municipalityId,
      departmentId: complaint.departmentId,
      createdById: complaint.createdById,
      assignedUserIds,
    });

    // Send in-app + push notification to the citizen who created the
    // complaint. The push payload deliberately does NOT include staff
    // identity to preserve citizen privacy (see findOne()).
    await this.notifyCitizenOfStatusChange(
      {
        id: complaintId,
        createdById: complaint.createdById,
        municipalityId,
        referenceCode: complaint.referenceCode,
      },
      dto.status,
    );

    return {
      id: complaintId,
      previousStatus: complaint.status,
      newStatus: dto.status,
      notes: dto.notes,
    };
  }

  /**
   * Set priority and SLA for a complaint (HOD/Supervisor only)
   */
  async setPriority(
    complaintId: string,
    userId: string,
    municipalityId: string,
    priority: ComplaintPriority,
    customDueDate?: Date,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Check permission
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    if (!permissions.includes(PERMISSIONS.COMPLAINT_SET_PRIORITY) && 
        !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      throw new ForbiddenException('You do not have permission to set priority');
    }

    // Calculate due date based on priority or use custom
    const dueDate = customDueDate || new Date(
      Date.now() + PRIORITY_SLA_HOURS[priority] * 60 * 60 * 1000
    );

    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        priority,
        dueDate,
      },
    });

    return {
      id: complaintId,
      priority,
      dueDate,
    };
  }

  /**
   * Reject a complaint with reason (HOD/Supervisor only)
   */
  async rejectComplaint(
    complaintId: string,
    userId: string,
    municipalityId: string,
    reason: RejectionReason,
    notes?: string,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Check permission
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    if (!permissions.includes(PERMISSIONS.COMPLAINT_REJECT) && 
        !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      throw new ForbiddenException('You do not have permission to reject complaints');
    }

    // Validate transition
    this.statusService.validateTransition(complaint.status, ComplaintStatus.REJECTED);

    // Update complaint
    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: ComplaintStatus.REJECTED,
        rejectionReason: reason,
        rejectionNotes: notes,
      },
    });

    // Log status change
    await this.prisma.complaintStatusLog.create({
      data: {
        complaintId,
        changedById: userId,
        fromStatus: complaint.status,
        toStatus: ComplaintStatus.REJECTED,
        notes: notes || `Rejected: ${reason}`,
      },
    });

    // Audit
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.audit.log({
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_REJECT,
      resourceType: 'Complaint',
      resourceId: complaintId,
      metadata: { reason, notes },
    });

    return {
      id: complaintId,
      status: ComplaintStatus.REJECTED,
      rejectionReason: reason,
      rejectionNotes: notes,
    };
  }

  /**
   * Submit feedback for a completed complaint (Citizen only)
   */
  async submitFeedback(
    complaintId: string,
    userId: string,
    municipalityId: string,
    rating: number,
    comment?: string,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Only the complaint creator can submit feedback
    if (complaint.createdById !== userId) {
      throw new ForbiddenException('Only the complaint creator can submit feedback');
    }

    // Can only submit feedback for completed/closed complaints
    if (!['COMPLETED', 'CLOSED'].includes(complaint.status)) {
      throw new BadRequestException('Feedback can only be submitted for completed complaints');
    }

    // Check if feedback already exists
    const existingFeedback = await this.prisma.complaintFeedback.findUnique({
      where: { complaintId },
    });

    if (existingFeedback) {
      throw new BadRequestException('Feedback has already been submitted for this complaint');
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const feedback = await this.prisma.complaintFeedback.create({
      data: {
        complaintId,
        givenById: userId,
        rating,
        comment,
      },
    });

    return {
      id: feedback.id,
      complaintId,
      rating,
      comment,
      createdAt: feedback.createdAt,
    };
  }

  /**
   * Get statistics for dashboard (role-based)
   */
  async getStats(userId: string, municipalityId: string) {
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);

    const baseWhere: any = { municipalityId, deletedAt: null };

    // Apply department filter for non-admins
    if (!permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) && user?.departmentId) {
        // Show complaints in their department OR unassigned complaints
        baseWhere.OR = [
          { departmentId: user.departmentId },
          { departmentId: null },
        ];
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
        baseWhere.assignments = { some: { assignedToId: userId, isActive: true } };
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
        baseWhere.createdById = userId;
      } else {
        return { total: 0, byStatus: {}, byPriority: {}, overdue: 0 };
      }
    }

    const now = new Date();

    const [total, byStatus, byPriority, overdue] = await Promise.all([
      this.prisma.complaint.count({ where: baseWhere }),
      this.prisma.complaint.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.complaint.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.complaint.count({
        where: {
          ...baseWhere,
          dueDate: { lt: now },
          status: { notIn: [ComplaintStatus.COMPLETED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] },
        },
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count])),
      overdue,
    };
  }

  /**
   * Bucket counts for the staff "Inbox" UX — answers "what should I work on?".
   * Each count is scoped to what the caller is allowed to see, so HOD/Worker
   * never get inflated numbers from outside their slice. The frontend uses
   * this to render tab badges so the user can pick the smallest pile first.
   */
  async getBuckets(userId: string, municipalityId: string) {
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);

    // Permission-scoped base: identical to findAll's permission branch.
    const scopedWhere: any = { municipalityId, deletedAt: null };
    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      // no extra filter
    } else if (
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
      user?.departmentId
    ) {
      scopedWhere.OR = [
        { departmentId: user.departmentId },
        { departmentId: null },
      ];
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
      scopedWhere.assignments = {
        some: { assignedToId: userId, isActive: true },
      };
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
      scopedWhere.createdById = userId;
    } else {
      return {
        needsAttention: 0,
        assignedToMe: 0,
        myDepartment: 0,
        all: 0,
        overdue: 0,
        myReports: 0,
      };
    }

    const now = new Date();
    const openStatuses = {
      notIn: [
        ComplaintStatus.COMPLETED,
        ComplaintStatus.CLOSED,
        ComplaintStatus.REJECTED,
      ],
    };

    // Build the per-bucket where clauses. Each bucket layers extra filters on
    // top of the permission-scoped base so the backend never leaks beyond the
    // caller's authority.
    const needsAttentionWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
        ? {
            ...scopedWhere,
            assignments: { none: { isActive: true } },
            status: openStatuses,
            ...(user?.departmentId &&
            !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
              ? { departmentId: user.departmentId }
              : {}),
          }
        : null;

    const assignedToMeWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
        ? {
            municipalityId,
            deletedAt: null,
            assignments: { some: { assignedToId: userId, isActive: true } },
          }
        : null;

    const myDepartmentWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
      user?.departmentId
        ? {
            municipalityId,
            deletedAt: null,
            departmentId: user.departmentId,
          }
        : null;

    const allWhere = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
      ? { municipalityId, deletedAt: null }
      : null;

    const overdueWhere = {
      ...scopedWhere,
      dueDate: { lt: now },
      status: openStatuses,
    };

    const myReportsWhere = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)
      ? { municipalityId, deletedAt: null, createdById: userId }
      : null;

    const [
      needsAttention,
      assignedToMe,
      myDepartment,
      all,
      overdue,
      myReports,
    ] = await Promise.all([
      needsAttentionWhere
        ? this.prisma.complaint.count({ where: needsAttentionWhere })
        : Promise.resolve(0),
      assignedToMeWhere
        ? this.prisma.complaint.count({ where: assignedToMeWhere })
        : Promise.resolve(0),
      myDepartmentWhere
        ? this.prisma.complaint.count({ where: myDepartmentWhere })
        : Promise.resolve(0),
      allWhere
        ? this.prisma.complaint.count({ where: allWhere })
        : Promise.resolve(0),
      this.prisma.complaint.count({ where: overdueWhere }),
      myReportsWhere
        ? this.prisma.complaint.count({ where: myReportsWhere })
        : Promise.resolve(0),
    ]);

    return {
      needsAttention,
      assignedToMe,
      myDepartment,
      all,
      overdue,
      myReports,
    };
  }

  /**
   * Dashboard charts data — complaints over time, category breakdown, priority distribution
   */
  async getDashboardCharts(userId: string, municipalityId: string) {
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);

    const baseWhere: any = { municipalityId, deletedAt: null };
    if (!permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) && user?.departmentId) {
        baseWhere.OR = [{ departmentId: user.departmentId }, { departmentId: null }];
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
        baseWhere.assignments = { some: { assignedToId: userId, isActive: true } };
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
        baseWhere.createdById = userId;
      } else {
        return { complaintsPerDay: [], byCategory: [], byPriority: [], avgResolutionHours: 0 };
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [recentComplaints, byCategory, byPriority, resolved] = await Promise.all([
      this.prisma.complaint.findMany({
        where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, status: true },
      }),
      this.prisma.complaint.groupBy({
        by: ['categoryId'],
        where: baseWhere,
        _count: true,
        orderBy: { _count: { categoryId: 'desc' } },
        take: 8,
      }),
      this.prisma.complaint.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.complaint.findMany({
        where: { ...baseWhere, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 200,
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    // Daily count
    const dailyMap = new Map<string, number>();
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of recentComplaints) {
      const day = c.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const complaintsPerDay = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Category names
    const catIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.complaintCategory.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    // Average resolution time
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalHours = resolved.reduce((acc, c) => {
        const diff = (c.resolvedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
        return acc + diff;
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolved.length);
    }

    return {
      complaintsPerDay,
      byCategory: byCategory.map((c) => ({
        name: catMap.get(c.categoryId ?? '') ?? 'Uncategorized',
        count: c._count,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority ?? 'NONE',
        count: p._count,
      })),
      avgResolutionHours,
    };
  }

  async addAttachments(
    complaintId: string,
    userId: string,
    municipalityId: string,
    stage: AttachmentStage,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    if (files.length > 5) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'TOO_MANY_FILES',
        message: 'A maximum of 5 photos can be attached at once.',
      });
    }
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'FILE_TOO_LARGE',
          message: 'Each photo must be 10MB or smaller.',
        });
      }
    }
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const attachments = [];
    for (const file of files) {
      const url = await this.storageService.saveFile(file, 'complaints');
      const attachment = await this.prisma.complaintAttachment.create({
        data: {
          complaintId,
          type: this.storageService.getFileType(file.mimetype) as AttachmentType,
          stage,
          url,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });
      attachments.push({
        id: attachment.id,
        url: attachment.url,
        type: attachment.type,
        stage: attachment.stage,
      });
    }

    return { attachments };
  }

  async remove(complaintId: string, municipalityId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Soft delete
    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Complaint deleted successfully' };
  }
}
