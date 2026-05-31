import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { generateReferenceCode } from '../../core/common/utils/reference-code.util';
import { paginate } from '../../core/common/dto/pagination.dto';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { ComplaintMapPointsQueryDto } from './dto/complaint-map-points-query.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { StatusService } from './status.service';
import { AssignmentsService } from './assignments.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationRecipientsService } from '../notifications/notification-recipients.service';
import { excludeRecipientIds } from '../notifications/notification-recipient.util';
import { shouldNotifyCitizenOfStatusChange } from '../notifications/complaint-notification-policy';
import { MunicipalityResolutionService } from '../municipalities/municipality-resolution.service';
import { MunicipalityResolutionError } from '../municipalities/municipality-resolution.error';
import type { MunicipalityResolutionResult } from '../municipalities/municipality-resolution.types';
import { MailService } from '../../core/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import {
  ComplaintStatus,
  AttachmentStage,
  AttachmentType,
  ComplaintPriority,
  RejectionReason,
  VerificationStatus,
  NotificationType,
  TransferStatus,
  Prisma,
} from '@prisma/client';
import { deriveDepartmentHealth } from '@shared/utils/department-health';
import {
  TERMINAL_COMPLAINT_STATUSES,
  activeStatusWhere,
  resolveQueryFromBucket,
  buildMyDepartmentActiveWhere,
  buildAllActiveWhere,
  buildOverdueWhere,
  buildNeedsAttentionWhere,
} from './complaint-filters';
import { isCitizenOnlyViewer as checkCitizenOnlyViewer } from './complaints-access.util';
import { classificationConflictsWithAssignment } from './complaints-classification.util';
import { boundaryBounds } from '../../core/geo/geojson-boundary.util';
import type { GeoJsonGeometry } from '../../core/geo/geojson-location.util';

export { TERMINAL_COMPLAINT_STATUSES } from './complaint-filters';

/** Canonical "active complaint" filter — opposite of terminal + not soft-deleted. */
export function activeComplaintFilter() {
  return {
    deletedAt: null,
    status: { notIn: TERMINAL_COMPLAINT_STATUSES },
  } as const;
}

function isTerminal(status: ComplaintStatus) {
  return TERMINAL_COMPLAINT_STATUSES.includes(status);
}

function isPrismaRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
  );
}

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

const PLATFORM_KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS =
  'complaints.allow_unverified_citizen_complaints';

export const COMPLAINT_RISK_REASONS = {
  UNVERIFIED_EMAIL: 'UNVERIFIED_EMAIL',
  UNVERIFIED_KYC: 'UNVERIFIED_KYC',
} as const;

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
    private notificationRecipients: NotificationRecipientsService,
    private municipalityResolution: MunicipalityResolutionService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private isCitizenOnlyViewer(permissions: string[]): boolean {
    return checkCitizenOnlyViewer(permissions);
  }

  private buildStaffRoutingInfo(complaint: {
    municipalityId: string;
    reporterRegisteredMunicipalityId: string | null;
    municipalityResolutionMethod: string | null;
    municipalityResolutionCandidates: unknown;
    municipality?: { id: string; name: string; code: string } | null;
    reporterRegisteredMunicipality?: { id: string; name: string; code: string } | null;
    createdBy?: { verificationStatus: VerificationStatus } | null;
  }) {
    const isExternalCitizenReport = !!(
      complaint.reporterRegisteredMunicipalityId &&
      complaint.reporterRegisteredMunicipalityId !== complaint.municipalityId
    );
    return {
      isExternalCitizenReport,
      operationalMunicipality: complaint.municipality
        ? {
            id: complaint.municipality.id,
            name: complaint.municipality.name,
            code: complaint.municipality.code,
          }
        : null,
      reporterRegisteredMunicipality: complaint.reporterRegisteredMunicipality
        ? {
            id: complaint.reporterRegisteredMunicipality.id,
            name: complaint.reporterRegisteredMunicipality.name,
            code: complaint.reporterRegisteredMunicipality.code,
          }
        : null,
      municipalityResolutionMethod: complaint.municipalityResolutionMethod,
      municipalityResolutionCandidates: complaint.municipalityResolutionCandidates,
      reporterVerificationStatus: complaint.createdBy?.verificationStatus ?? null,
    };
  }

  async resolveIncidentLocation(
    latitude: number,
    longitude: number,
    userMunicipalityId: string | null,
  ): Promise<MunicipalityResolutionResult> {
    return this.municipalityResolution.resolveFromCoordinates(
      latitude,
      longitude,
      userMunicipalityId || null,
    );
  }

  private async isAllowUnverifiedCitizenComplaints(): Promise<boolean> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: PLATFORM_KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS },
    });
    return row?.value === 'true';
  }

  private canSeeRiskMetadata(permissions: string[]): boolean {
    return (
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)
    );
  }

  private mapRiskForStaff(complaint: {
    isRiskySubmission: boolean;
    riskReasons: unknown;
    submittedByEmailVerified: boolean | null;
    submittedByKycVerified: boolean | null;
  }) {
    if (!complaint.isRiskySubmission) {
      return {
        isRiskySubmission: false as const,
        riskReasons: [] as string[],
        submittedByEmailVerified: complaint.submittedByEmailVerified,
        submittedByKycVerified: complaint.submittedByKycVerified,
      };
    }
    const reasons = Array.isArray(complaint.riskReasons)
      ? (complaint.riskReasons as string[])
      : [];
    return {
      isRiskySubmission: true as const,
      riskReasons: reasons,
      submittedByEmailVerified: complaint.submittedByEmailVerified,
      submittedByKycVerified: complaint.submittedByKycVerified,
    };
  }

  /**
   * Citizen-facing notification for a complaint status change.
   * Title/body are in the user's preferred locale; the assignee identity
   * is intentionally NOT mentioned so we don't leak it via push.
   */
  private async notifyCitizenOfStatusChange(
    complaint: { id: string; createdById: string; municipalityId: string; referenceCode?: string | null },
    newStatus: ComplaintStatus,
  ) {
    if (!shouldNotifyCitizenOfStatusChange(newStatus)) {
      return;
    }
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

  /** Staff triage + optional department oversight when a complaint is filed. */
  private async notifyComplaintCreated(
    complaint: {
      id: string;
      municipalityId: string;
      referenceCode: string;
      departmentId: string | null;
    },
    departmentName: string | null,
  ) {
    try {
      const triageIds =
        await this.notificationRecipients.findComplaintTriageRecipientIds(
          complaint.municipalityId,
        );

      if (triageIds.length) {
        await this.notifications.createAndSend(
          complaint.municipalityId,
          triageIds,
          NotificationType.COMPLAINT_SUBMITTED,
          'New complaint submitted',
          `Complaint ${complaint.referenceCode} needs review.`,
          {
            complaintId: complaint.id,
            referenceCode: complaint.referenceCode,
            deepLink: `/complaints/${complaint.id}`,
          },
        );
      }

      if (complaint.departmentId) {
        const deptIds =
          await this.notificationRecipients.findDepartmentComplaintRecipientIds(
            complaint.municipalityId,
            complaint.departmentId,
          );
        const deptOnly = excludeRecipientIds(deptIds, triageIds);
        if (deptOnly.length) {
          const deptLabel = departmentName ?? 'your department';
          await this.notifications.createAndSend(
            complaint.municipalityId,
            deptOnly,
            NotificationType.COMPLAINT_SUBMITTED,
            'New complaint for your department',
            `Complaint ${complaint.referenceCode} was routed to ${deptLabel}.`,
            {
              complaintId: complaint.id,
              referenceCode: complaint.referenceCode,
              departmentId: complaint.departmentId,
              departmentName: departmentName ?? undefined,
              deepLink: `/complaints/${complaint.id}`,
            },
          );
        }
      }
    } catch (err) {
      console.warn(
        `Failed to send complaint-created notifications for ${complaint.id}:`,
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
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    const isStaff =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        verificationStatus: true,
        emailVerifiedAt: true,
        createdVia: true,
      },
    });

    const emailVerified = !!creator?.emailVerifiedAt;
    const kycVerified =
      creator?.verificationStatus === VerificationStatus.VERIFIED;
    const allowUnverifiedPolicy = await this.isAllowUnverifiedCitizenComplaints();

    const riskReasons: string[] = [];
    if (!emailVerified) riskReasons.push(COMPLAINT_RISK_REASONS.UNVERIFIED_EMAIL);
    if (!kycVerified) riskReasons.push(COMPLAINT_RISK_REASONS.UNVERIFIED_KYC);
    const isRiskySubmission = !isStaff && riskReasons.length > 0;

    if (!isStaff) {
      if (isRiskySubmission && !allowUnverifiedPolicy) {
        if (!kycVerified) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'USER_NOT_VERIFIED',
            message:
              'Identity verification required to submit complaints. Please complete KYC verification first.',
          });
        }
        if (!emailVerified) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EMAIL_NOT_VERIFIED',
            message:
              'Email verification is required before you can submit complaints.',
          });
        }
      }
    }

    const riskyDueDate = isRiskySubmission
      ? new Date(Date.now() + PRIORITY_SLA_HOURS.LOW * 60 * 60 * 1000)
      : undefined;

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

    const reporterRegisteredMunicipalityId = municipalityId || null;

    let routing: Awaited<
      ReturnType<MunicipalityResolutionService['resolveForComplaintCreate']>
    >;
    try {
      routing = await this.municipalityResolution.resolveForComplaintCreate(
        dto.latitude,
        dto.longitude,
        reporterRegisteredMunicipalityId,
        dto.selectedMunicipalityId,
      );
    } catch (err: unknown) {
      if (err instanceof MunicipalityResolutionError) {
        throw new BadRequestException({
          statusCode: 400,
          code: err.code,
          message: err.message,
          ...(err.candidates.length ? { candidates: err.candidates } : {}),
        });
      }
      throw new BadRequestException({
        statusCode: 400,
        code: 'LOCATION_RESOLUTION_FAILED',
        message: 'Unable to resolve municipality for this location.',
      });
    }

    const operationalMunicipalityId = routing.operationalMunicipalityId;

    // Verify category exists in the operational municipality
    const category = await this.prisma.complaintCategory.findFirst({
      where: {
        id: dto.categoryId,
        municipalityId: operationalMunicipalityId,
        isActive: true,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!category) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CATEGORY_MUNICIPALITY_MISMATCH',
        message:
          'The selected category does not belong to the municipality for this incident location.',
      });
    }

    // Get municipality code for reference
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: operationalMunicipalityId },
      select: { code: true },
    });

    if (!municipality) {
      throw new NotFoundException('Municipality not found');
    }

    // Generate sequential reference code (BEI-CMP-2026-000001)
    const referenceCode = await generateReferenceCode(
      this.prisma,
      operationalMunicipalityId,
      municipality.code,
    );

    const resolutionCandidatesJson =
      routing.candidates.length > 0
        ? (routing.candidates as Prisma.InputJsonValue)
        : undefined;

    // Create complaint
    const complaint = await this.prisma.complaint.create({
      data: {
        municipalityId: operationalMunicipalityId,
        reporterRegisteredMunicipalityId,
        municipalityResolutionMethod: routing.method,
        municipalityResolutionCandidates: resolutionCandidatesJson,
        locationResolvedAt: routing.locationResolvedAt,
        categoryId: dto.categoryId,
        departmentId: category.departmentId,
        createdById: userId,
        referenceCode,
        title: dto.title.trim(),
        description: dto.description.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        status: ComplaintStatus.SUBMITTED,
        ...(isRiskySubmission
          ? {
              priority: ComplaintPriority.LOW,
              dueDate: riskyDueDate,
              isRiskySubmission: true,
              riskReasons,
              submittedByEmailVerified: emailVerified,
              submittedByKycVerified: kycVerified,
            }
          : {}),
      },
    });

    // Create initial status log
    await this.prisma.complaintStatusLog.create({
      data: {
        complaintId: complaint.id,
        changedById: userId,
        fromStatus: null,
        toStatus: ComplaintStatus.SUBMITTED,
        notes: isRiskySubmission
          ? 'Submitted by unverified citizen'
          : undefined,
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
      municipalityId: operationalMunicipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_CREATE,
      resourceType: 'Complaint',
      resourceId: complaint.id,
      metadata: {
        referenceCode: complaint.referenceCode,
        title: complaint.title,
        attachmentCount: attachments.length,
        isRiskySubmission,
        riskReasons: isRiskySubmission ? riskReasons : undefined,
        reporterRegisteredMunicipalityId,
        municipalityResolutionMethod: routing.method,
        municipalityResolutionStatus: routing.status,
      },
    });

    if (isRiskySubmission) {
      await this.audit.log({
        actorId: userId,
        actorEmail: creatorEmail,
        municipalityId: operationalMunicipalityId,
        action: AUDIT_ACTIONS.COMPLAINT_RISKY_ACCEPTED,
        resourceType: 'Complaint',
        resourceId: complaint.id,
        metadata: {
          referenceCode: complaint.referenceCode,
          riskReasons,
          policy: PLATFORM_KEY_ALLOW_UNVERIFIED_CITIZEN_COMPLAINTS,
          forcedPriority: ComplaintPriority.LOW,
        },
      });
    }

    // Realtime: tell HODs/Assigners/Admins in the operational muni a new complaint landed
    this.realtime.complaintCreated({
      id: complaint.id,
      municipalityId: operationalMunicipalityId,
      departmentId: complaint.departmentId,
      createdById: userId,
    });

    void this.notifyComplaintCreated(
      {
        id: complaint.id,
        municipalityId: operationalMunicipalityId,
        referenceCode: complaint.referenceCode ?? complaint.id,
        departmentId: complaint.departmentId,
      },
      category.department?.name ?? null,
    );

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
    const effectiveQuery = resolveQueryFromBucket(query);
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    const citizenOnly = this.isCitizenOnlyViewer(permissions);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    const where: any = {
      deletedAt: null,
    };

    if (!citizenOnly) {
      where.municipalityId = municipalityId;
    }

    // Initialize AND array for combining filters
    where.AND = where.AND || [];

    // Filter based on permissions (hierarchical)
    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      // Admin / Assigner can see all complaints in the municipality, including
      // unrouted ones (departmentId === null). The Assigner queue is exactly
      // this set; admins use it for oversight.
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) {
      // HOD/Supervisor sees ONLY their department's complaints. Unrouted
      // complaints (departmentId=null) belong to the Assigner queue, not
      // to an arbitrary HOD — showing them would leak cross-dept work the
      // HOD has no authority over and would also break the bucket count
      // (which is scoped to own dept) vs list (which previously included
      // null-dept) match.
      if (user?.departmentId) {
        where.AND.push({ departmentId: user.departmentId });
      } else {
        return paginate([], 0, query);
      }
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
      // Field workers: active assignment by default. History views can opt
      // into including past assignments so completed/rejected work the worker
      // touched is still visible in their History tab.
      if (effectiveQuery.includeAssignmentHistory) {
        const histFilters: any[] = [
          { assignments: { some: { assignedToId: userId } } },
        ];
        if (user?.departmentId) {
          histFilters.push({
            OR: [
              { departmentId: user.departmentId },
              { departmentId: null },
            ],
          });
        }
        where.AND.push(histFilters.length === 1 ? histFilters[0] : { AND: histFilters });
      } else {
        where.AND.push(
          this.assignmentsService.buildActiveAssignmentVisibilityFilter(
            userId,
            user?.departmentId,
          ),
        );
      }
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
      // Citizens see all complaints they created, including cross-municipality reports.
      where.createdById = userId;
    } else {
      // No view permission - return empty
      return paginate([], 0, effectiveQuery);
    }

    // Additional filters
    if (effectiveQuery.status?.length) {
      where.status = { in: effectiveQuery.status };
    }

    if (effectiveQuery.categoryId) {
      where.categoryId = effectiveQuery.categoryId;
    }

    // Only apply department filter if user has permission to view all
    if (effectiveQuery.departmentId && permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      where.departmentId = effectiveQuery.departmentId;
    }

    if (effectiveQuery.unrouted) {
      if (!permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
        throw new ForbiddenException(
          'You do not have permission to filter unrouted complaints',
        );
      }
      if (effectiveQuery.departmentId) {
        throw new BadRequestException(
          'Cannot combine departmentId filter with unrouted=true',
        );
      }
      where.departmentId = null;
    }

    // Priority filter
    if (effectiveQuery.priority?.length) {
      where.priority = { in: effectiveQuery.priority };
    }

    // Overdue filter
    if (effectiveQuery.overdue !== undefined) {
      const now = new Date();
      if (effectiveQuery.overdue) {
        Object.assign(where, buildOverdueWhere(now));
      } else {
        where.AND.push({
          OR: [
            { dueDate: null },
            { dueDate: { gte: now } },
          ],
        });
      }
    }

    if (effectiveQuery.search) {
      where.AND.push({
        OR: [
          { title: { contains: effectiveQuery.search, mode: 'insensitive' } },
          { referenceCode: { contains: effectiveQuery.search, mode: 'insensitive' } },
        ],
      });
    }

    // "Assigned to me" — narrows results to complaints where the caller has an
    // active assignment. Honoured for any user with at least view_assigned;
    // for view_all/view_department this layers on top of the permission scope.
    if (effectiveQuery.myAssignments) {
      where.AND.push(
        this.assignmentsService.buildActiveAssignmentVisibilityFilter(
          userId,
          user?.departmentId,
        ),
      );
    }

    // "Unassigned inbox" — complaints with no active assignment yet. The
    // typical action queue for HOD/Supervisor: "what landed in my dept that
    // nobody owns yet?".
    if (effectiveQuery.unassigned) {
      where.AND.push({
        assignments: { none: { isActive: true } },
      });
    }

    // Active operational queues — never mix terminal statuses into the table.
    if (effectiveQuery.openOnly) {
      where.AND.push({ status: activeStatusWhere() });
    }

    // "History" buckets — terminal complaints only. If a specific status was
    // also supplied (e.g. COMPLETED), it intersects via the query.status path
    // above so a Completed/Resolved tab still filters down to one status.
    if (effectiveQuery.terminalOnly) {
      where.AND.push({ status: { in: TERMINAL_COMPLAINT_STATUSES } });
    }

    if (effectiveQuery.riskyOnly) {
      if (!this.canSeeRiskMetadata(permissions)) {
        throw new ForbiddenException(
          'You do not have permission to filter risky submissions',
        );
      }
      where.AND.push({ isRiskySubmission: true });
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
          isRiskySubmission: true,
          riskReasons: true,
          submittedByEmailVerified: true,
          submittedByKycVerified: true,
          municipalityId: true,
          reporterRegisteredMunicipalityId: true,
          municipalityResolutionMethod: true,
          municipalityResolutionCandidates: true,
          category: {
            select: { id: true, name: true },
          },
          department: {
            select: { id: true, name: true },
          },
          municipality: { select: { id: true, name: true, code: true } },
          reporterRegisteredMunicipality: {
            select: { id: true, name: true, code: true },
          },
          createdBy: { select: { verificationStatus: true } },
          createdAt: true,
        },
        skip: effectiveQuery.skip,
        take: effectiveQuery.limit,
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
    const showRisk = this.canSeeRiskMetadata(permissions);
    const complaintsWithOverdue = complaints.map((c) => {
      const base = {
        id: c.id,
        referenceCode: c.referenceCode,
        title: c.title,
        status: c.status,
        priority: c.priority,
        dueDate: c.dueDate,
        category: c.category,
        department: c.department,
        createdAt: c.createdAt,
        isOverdue: c.dueDate
          ? c.dueDate < now &&
            !['COMPLETED', 'CLOSED', 'REJECTED'].includes(c.status)
          : false,
      };
      if (!showRisk) return base;
      return {
        ...base,
        ...this.mapRiskForStaff(c),
        ...this.buildStaffRoutingInfo(c),
      };
    });

    return paginate(complaintsWithOverdue, total, effectiveQuery);
  }

  /**
   * Lightweight geolocated complaints for the staff dashboard map.
   * Uses the same visibility rules as findAll; citizens cannot access.
   */
  async findMapPoints(
    userId: string,
    municipalityId: string,
    query: ComplaintMapPointsQueryDto,
  ) {
    const permissions = await this.permissionsResolver.getUserPermissions(userId);
    if (this.isCitizenOnlyViewer(permissions)) {
      throw new ForbiddenException('Complaint map is not available for citizen accounts');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    const where: Prisma.ComplaintWhereInput = {
      deletedAt: null,
      municipalityId,
      latitude: { not: null },
      longitude: { not: null },
      AND: [],
    };

    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      // full municipality scope
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) {
      if (!user?.departmentId) {
        return this.buildMapPointsResponse(municipalityId, []);
      }
      (where.AND as Prisma.ComplaintWhereInput[]).push({
        departmentId: user.departmentId,
      });
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
      (where.AND as Prisma.ComplaintWhereInput[]).push(
        this.assignmentsService.buildActiveAssignmentVisibilityFilter(
          userId,
          user?.departmentId,
        ),
      );
    } else {
      throw new ForbiddenException('You do not have permission to view complaint map data');
    }

    if (query.status?.length) {
      where.status = { in: query.status };
    }
    if (query.priority?.length) {
      where.priority = { in: query.priority };
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.departmentId) {
      if (!permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
        throw new ForbiddenException(
          'You do not have permission to filter by department',
        );
      }
      where.departmentId = query.departmentId;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.search?.trim()) {
      (where.AND as Prisma.ComplaintWhereInput[]).push({
        OR: [
          { title: { contains: query.search.trim(), mode: 'insensitive' } },
          {
            referenceCode: {
              contains: query.search.trim(),
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if ((where.AND as Prisma.ComplaintWhereInput[]).length === 0) {
      delete where.AND;
    }

    const rows = await this.prisma.complaint.findMany({
      where,
      select: {
        id: true,
        referenceCode: true,
        title: true,
        latitude: true,
        longitude: true,
        status: true,
        priority: true,
        address: true,
        createdAt: true,
        category: { select: { id: true, name: true, nameAr: true, nameFr: true } },
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    const points = rows.map((c) => ({
      id: c.id,
      referenceCode: c.referenceCode,
      title: c.title,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      status: c.status,
      priority: c.priority,
      category: c.category,
      department: c.department,
      address: c.address,
      createdAt: c.createdAt,
    }));

    return this.buildMapPointsResponse(municipalityId, points);
  }

  private async buildMapPointsResponse(
    municipalityId: string,
    points: {
      id: string;
      referenceCode: string | null;
      title: string;
      latitude: number;
      longitude: number;
      status: ComplaintStatus;
      priority: ComplaintPriority;
      category: { id: string; name: string; nameAr: string | null; nameFr: string | null };
      department: {
        id: string;
        name: string;
        nameAr: string | null;
        nameFr: string | null;
      } | null;
      address: string | null;
      createdAt: Date;
    }[],
  ) {
    const DEFAULT_CENTER = { latitude: 33.8938, longitude: 35.5018 };

    const [municipality, boundaryRow] = await Promise.all([
      this.prisma.municipality.findUnique({
        where: { id: municipalityId },
        select: { latitude: true, longitude: true },
      }),
      this.prisma.municipalityBoundary.findFirst({
        where: { municipalityId, isActive: true },
        select: { geojson: true },
      }),
    ]);

    let boundary: {
      geojson: GeoJsonGeometry;
      bounds: [number, number, number, number];
    } | null = null;

    if (boundaryRow?.geojson) {
      try {
        const geojson = boundaryRow.geojson as GeoJsonGeometry;
        const bounds = boundaryBounds(geojson);
        boundary = { geojson, bounds };
      } catch {
        // Invalid stored boundary must not break map-points for staff dashboards.
        boundary = null;
      }
    }

    const muniLat =
      municipality?.latitude != null ? Number(municipality.latitude) : null;
    const muniLng =
      municipality?.longitude != null ? Number(municipality.longitude) : null;

    let center = DEFAULT_CENTER;
    if (boundary) {
      const [minLat, minLng, maxLat, maxLng] = boundary.bounds;
      center = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
      };
    } else if (muniLat != null && muniLng != null) {
      center = { latitude: muniLat, longitude: muniLng };
    } else if (points.length > 0) {
      const sum = points.reduce(
        (acc, p) => ({
          lat: acc.lat + p.latitude,
          lng: acc.lng + p.longitude,
        }),
        { lat: 0, lng: 0 },
      );
      center = {
        latitude: sum.lat / points.length,
        longitude: sum.lng / points.length,
      };
    }

    return {
      points,
      center,
      boundary,
      total: points.length,
    };
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
        deletedAt: null,
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        municipality: { select: { id: true, name: true, code: true } },
        reporterRegisteredMunicipality: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verificationStatus: true,
          },
        },
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
            eventKind: true,
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
    const citizenOnly = this.isCitizenOnlyViewer(permissions);
    const isAssigned = await this.assignmentsService.isAssignedTo(complaintId, userId);

    if (
      !isOwner &&
      !citizenOnly &&
      municipalityId &&
      complaint.municipalityId !== municipalityId
    ) {
      throw new NotFoundException('Complaint not found');
    }
    // HOD/Supervisor can ONLY view complaints in their own department.
    // Unrouted complaints (departmentId=null) are the Assigner's queue —
    // HOD has no operational authority there and shouldn't read them.
    const isSameDepartment =
      !!user?.departmentId && complaint.departmentId === user.departmentId;
    const canViewAsDepartmentHead = canViewDepartment && isSameDepartment;

    // PREVIEW ACCESS: a HOD/Supervisor of a department that has an OPEN
    // transfer/help request targeting their department can read a sanitized
    // version of the complaint so they can make an informed decision. They
    // do NOT see internal staff notes, assignee identity, or status logs.
    const canPreviewAsReceiver =
      !canViewAll &&
      !isOwner &&
      !isAssigned &&
      !canViewAsDepartmentHead &&
      canViewDepartment &&
      user?.departmentId
        ? await this.hasPendingInboundRequest(complaintId, user.departmentId)
        : false;

    if (
      !canViewAll &&
      !isOwner &&
      !isAssigned &&
      !canViewAsDepartmentHead &&
      !canPreviewAsReceiver
    ) {
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
    // Receiver-preview viewers (HOD/Supervisor of a dept with a pending
    // inbound transfer/help) need enough to decide but NOT internal notes,
    // status history, current assignee, or the citizen reporter's identity.
    const isPreviewOnly = canPreviewAsReceiver;

    const safeStatusHistory = isPreviewOnly
      ? []
      : complaint.statusLogs
          .filter((log: any) => {
            // Citizens never see internal help/transfer event noise on
            // their own complaint. Real status transitions remain visible
            // so they still see the workflow progress in plain terms.
            if (!isCitizenOnly) return true;
            return !log.eventKind;
          })
          .map((log: any) => ({
            id: log.id,
            fromStatus: log.fromStatus,
            toStatus: log.toStatus,
            notes: isCitizenOnly ? null : log.notes,
            eventKind: isCitizenOnly ? null : log.eventKind,
            changedBy: isCitizenOnly ? null : log.changedBy,
            createdAt: log.createdAt,
          }));

    const safeAssignment = currentAssignment
      ? isCitizenOnly || isPreviewOnly
        ? {
            // Citizens / preview-mode see only that the complaint IS assigned.
            assignedAt: currentAssignment.createdAt,
            isAssigned: true,
          }
        : {
            assignedTo: currentAssignment.assignedTo,
            assignedBy: currentAssignment.assignedBy,
            notes: currentAssignment.notes,
            createdAt: currentAssignment.createdAt,
          }
      : null;

    // Strip citizen reporter PII from preview mode — the receiver doesn't
    // need the citizen's name/email to decide on a transfer or help request.
    const safeCreatedBy = isPreviewOnly
      ? null
      : complaint.createdBy;

    return {
      id: complaint.id,
      referenceCode: complaint.referenceCode,
      title: complaint.title,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      dueDate: complaint.dueDate,
      isOverdue,
      rejectionReason: isPreviewOnly ? null : complaint.rejectionReason,
      rejectionNotes: isPreviewOnly ? null : complaint.rejectionNotes,
      resolvedAt: complaint.resolvedAt,
      escalatedAt: complaint.escalatedAt,
      latitude: complaint.latitude?.toString(),
      longitude: complaint.longitude?.toString(),
      address: complaint.address,
      category: complaint.category,
      department: complaint.department,
      createdBy: safeCreatedBy,
      // Submission photos are operationally needed to evaluate a transfer/
      // help request. Proof photos belong to the source dept's worker and
      // are stripped in preview mode.
      attachments: isPreviewOnly
        ? complaint.attachments.filter((a) => a.stage === AttachmentStage.SUBMISSION)
        : complaint.attachments,
      currentAssignment: safeAssignment,
      statusHistory: safeStatusHistory,
      feedback: isPreviewOnly ? null : complaint.feedback,
      createdAt: complaint.createdAt,
      // Surface preview mode to the frontend so the UI can show a banner
      // ("Read-only preview for transfer/help decision") and hide actions
      // that would fail backend authz anyway.
      previewOnly: isPreviewOnly,
      ...(!isCitizenOnly && !isPreviewOnly
        ? {
            ...this.mapRiskForStaff(complaint),
            ...this.buildStaffRoutingInfo(complaint),
          }
        : {}),
    };
  }

  /**
   * Returns true if the given department currently has a pending transfer or
   * help request targeting it for this complaint. Used to grant preview
   * access on the complaint detail page so the receiver HOD can make an
   * informed decision before accepting/rejecting.
   */
  /**
   * Enforce who may approve completion or return work for more fixes while a
   * complaint sits in PENDING_APPROVAL.
   */
  private async assertCanReviewPendingApproval(
    complaintId: string,
    userId: string,
    complaintDepartmentId: string | null,
    permissions: string[],
    dto: ChangeStatusDto,
  ): Promise<void> {
    const canViewAll = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL);
    const canApprove = permissions.includes(PERMISSIONS.COMPLAINT_APPROVE);

    if (!canViewAll && !canApprove) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'APPROVAL_NOT_PERMITTED',
        message:
          'You do not have permission to approve or return work on this complaint.',
      });
    }

    if (!canViewAll) {
      const reviewer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });

      if (
        !complaintDepartmentId ||
        reviewer?.departmentId !== complaintDepartmentId
      ) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'APPROVAL_WRONG_DEPARTMENT',
          message:
            'Only the Head of Department or supervisors for this complaint\'s department can approve or return work.',
        });
      }

      const isAssignee = await this.assignmentsService.isAssignedTo(
        complaintId,
        userId,
      );
      if (isAssignee) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'CANNOT_APPROVE_OWN_WORK',
          message:
            'You cannot approve or return work on a complaint you submitted for approval.',
        });
      }
    }

    if (dto.status === ComplaintStatus.IN_PROGRESS) {
      const notes = dto.notes?.trim() ?? '';
      if (notes.length < 5) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'RETURN_REASON_REQUIRED',
          message:
            'A note of at least 5 characters is required when returning work to the field worker.',
        });
      }
    }
  }

  private async hasPendingInboundRequest(
    complaintId: string,
    receiverDepartmentId: string,
  ): Promise<boolean> {
    const [openHelp, openTransfer] = await Promise.all([
      this.prisma.complaintHelpRequest.findFirst({
        where: {
          complaintId,
          toDepartmentId: receiverDepartmentId,
          status: { in: ['PENDING'] as any },
        },
        select: { id: true },
      }),
      this.prisma.transferRequest.findFirst({
        where: {
          targetType: 'COMPLAINT' as any,
          targetId: complaintId,
          toDepartmentId: receiverDepartmentId,
          status: 'PENDING' as any,
        },
        select: { id: true },
      }),
    ]);
    return !!openHelp || !!openTransfer;
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

    // PENDING_APPROVAL → COMPLETED / IN_PROGRESS: department-scoped review
    if (
      this.statusService.isPendingApprovalReviewTransition(
        complaint.status,
        dto.status,
      )
    ) {
      await this.assertCanReviewPendingApproval(
        complaintId,
        userId,
        complaint.departmentId,
        permissions,
        dto,
      );
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

    // Atomic, idempotent transition. We bind the update on the expected
    // previous status so two concurrent clicks can't both "succeed" and
    // write duplicate status logs / fire duplicate notifications. On race
    // loss Prisma raises P2025 → we surface a clean 409.
    //
    // Terminal transitions ALSO deactivate active assignments in the same
    // transaction so worker workload counts / "Assigned to me" stay sane.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.complaint.update({
          where: {
            id: complaintId,
            status: complaint.status,
            deletedAt: null,
          },
          data: updateData,
        });

        await tx.complaintStatusLog.create({
          data: {
            complaintId,
            changedById: userId,
            fromStatus: complaint.status,
            toStatus: dto.status,
            notes: dto.notes,
          },
        });

        if (isTerminal(dto.status)) {
          await this.assignmentsService.deactivateActiveAssignments(
            complaintId,
            tx,
          );
        }
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'COMPLAINT_STATE_CONFLICT',
          message:
            'This complaint has already been updated. Refresh and try again.',
        });
      }
      throw err;
    }

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
   * Reclassify a complaint (category + derived department).
   * Used when citizens pick "Other" or the wrong category, or for unrouted queue triage.
   *
   * Future: COMPLAINT_ACTION_REQUIRED notifications / offline draft completion flows
   * may call this after citizen selects a category on a pending report.
   */
  async classifyComplaint(
    complaintId: string,
    userId: string,
    municipalityId: string,
    categoryId: string,
  ) {
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        municipalityId,
        deletedAt: null,
      },
      include: {
        assignments: {
          where: { isActive: true },
          take: 1,
          include: {
            assignedTo: { select: { departmentId: true } },
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const category = await this.prisma.complaintCategory.findFirst({
      where: {
        id: categoryId,
        municipalityId: complaint.municipalityId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departmentId: true,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Category not found or does not belong to this municipality',
      );
    }

    const newDepartmentId = category.departmentId;
    const previousCategoryId = complaint.categoryId;
    const previousDepartmentId = complaint.departmentId;

    if (
      previousCategoryId === categoryId &&
      previousDepartmentId === newDepartmentId
    ) {
      return {
        id: complaintId,
        categoryId,
        departmentId: newDepartmentId,
        category: { id: category.id, name: category.name },
      };
    }

    const activeAssignment = complaint.assignments[0];
    const assigneeDepartmentId =
      activeAssignment?.assignedTo?.departmentId ?? null;

    if (
      activeAssignment &&
      classificationConflictsWithAssignment(newDepartmentId, assigneeDepartmentId)
    ) {
      throw new ConflictException({
        statusCode: 409,
        code: 'CLASSIFICATION_ASSIGNMENT_CONFLICT',
        message:
          'Cannot change category while an active assignment conflicts with the new department. Remove or reassign the worker first.',
      });
    }

    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        categoryId,
        departmentId: newDepartmentId,
      },
    });

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.audit.log({
      actorId: userId,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.COMPLAINT_CLASSIFY,
      resourceType: 'Complaint',
      resourceId: complaintId,
      metadata: {
        fromCategoryId: previousCategoryId,
        toCategoryId: categoryId,
        fromDepartmentId: previousDepartmentId,
        toDepartmentId: newDepartmentId,
      },
    });

    const assignedUserIds = complaint.assignments.map((a) => a.assignedToId);
    this.realtime.complaintUpdated({
      id: complaintId,
      municipalityId,
      departmentId: newDepartmentId,
      createdById: complaint.createdById,
      assignedUserIds,
    });

    return {
      id: complaintId,
      categoryId,
      departmentId: newDepartmentId,
      category: { id: category.id, name: category.name },
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

    // Atomic transition with assignment deactivation in the same txn.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.complaint.update({
          where: {
            id: complaintId,
            status: complaint.status,
            deletedAt: null,
          },
          data: {
            status: ComplaintStatus.REJECTED,
            rejectionReason: reason,
            rejectionNotes: notes,
          },
        });

        await tx.complaintStatusLog.create({
          data: {
            complaintId,
            changedById: userId,
            fromStatus: complaint.status,
            toStatus: ComplaintStatus.REJECTED,
            notes: notes || `Rejected: ${reason}`,
          },
        });

        await this.assignmentsService.deactivateActiveAssignments(
          complaintId,
          tx,
        );
      });
    } catch (err) {
      if (isPrismaRecordNotFound(err)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'COMPLAINT_STATE_CONFLICT',
          message:
            'This complaint has already been updated. Refresh and try again.',
        });
      }
      throw err;
    }

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

    // Realtime so HOD inbox / worker queues update without polling.
    const assignedUserIds = await this.prisma.complaintAssignment
      .findMany({
        where: { complaintId },
        select: { assignedToId: true },
      })
      .then((rows) => Array.from(new Set(rows.map((r) => r.assignedToId))));
    this.realtime.complaintUpdated({
      id: complaintId,
      municipalityId,
      departmentId: complaint.departmentId,
      createdById: complaint.createdById,
      assignedUserIds,
    });

    await this.notifyCitizenOfStatusChange(
      {
        id: complaintId,
        createdById: complaint.createdById,
        municipalityId,
        referenceCode: complaint.referenceCode,
      },
      ComplaintStatus.REJECTED,
    );

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

    // Apply department filter for non-admins. Mirrors findAll() exactly so
    // tab counts and the list always agree.
    if (!permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) && user?.departmentId) {
        baseWhere.departmentId = user.departmentId;
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
        Object.assign(
          baseWhere,
          this.assignmentsService.buildActiveAssignmentVisibilityFilter(
            userId,
            user?.departmentId,
          ),
        );
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

    const citizenOnly = this.isCitizenOnlyViewer(permissions);

    // Permission-scoped base: identical to findAll's permission branch.
    const scopedWhere: any = { deletedAt: null };
    const historyScopedWhere: any = { deletedAt: null };
    if (!citizenOnly) {
      scopedWhere.municipalityId = municipalityId;
      historyScopedWhere.municipalityId = municipalityId;
    }

    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      // no extra filter
    } else if (
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
      user?.departmentId
    ) {
      scopedWhere.departmentId = user.departmentId;
      historyScopedWhere.departmentId = user.departmentId;
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
      Object.assign(
        scopedWhere,
        this.assignmentsService.buildActiveAssignmentVisibilityFilter(
          userId,
          user?.departmentId,
        ),
      );
      // History scope: any complaint the worker was ever assigned to.
      // We intentionally drop the strict same-department check here so a
      // worker who transferred departments still sees their past work.
      historyScopedWhere.assignments = {
        some: { assignedToId: userId },
      };
    } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)) {
      scopedWhere.createdById = userId;
      historyScopedWhere.createdById = userId;
      delete scopedWhere.municipalityId;
      delete historyScopedWhere.municipalityId;
    } else {
      return {
        needsAttention: 0,
        assignedToMe: 0,
        myDepartment: 0,
        all: 0,
        overdue: 0,
        myReports: 0,
        completed: 0,
        rejected: 0,
        closed: 0,
        history: 0,
      };
    }

    const now = new Date();

    const needsAttentionWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
        ? buildNeedsAttentionWhere(scopedWhere)
        : null;

    const assignedToMeWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
        ? {
            municipalityId,
            deletedAt: null,
            status: activeStatusWhere(),
            ...this.assignmentsService.buildActiveAssignmentVisibilityFilter(
              userId,
              user?.departmentId,
            ),
          }
        : null;

    const myDepartmentWhere =
      permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
      user?.departmentId
        ? buildMyDepartmentActiveWhere(user.departmentId, municipalityId)
        : null;

    const allWhere = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
      ? buildAllActiveWhere(municipalityId)
      : null;

    const overdueWhere: Prisma.ComplaintWhereInput = {
      AND: [scopedWhere, buildOverdueWhere(now)],
    };

    const myReportsWhere = permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN)
      ? { deletedAt: null, createdById: userId }
      : null;

    // History buckets — terminal complaints scoped to what the caller may
    // see. For workers we expand to past assignments so completed work
    // doesn't visually vanish.
    const completedWhere = {
      ...historyScopedWhere,
      status: ComplaintStatus.COMPLETED,
    };
    const rejectedWhere = {
      ...historyScopedWhere,
      status: ComplaintStatus.REJECTED,
    };
    const closedWhere = {
      ...historyScopedWhere,
      status: ComplaintStatus.CLOSED,
    };
    const historyWhere = {
      ...historyScopedWhere,
      status: { in: TERMINAL_COMPLAINT_STATUSES },
    };

    const [
      needsAttention,
      assignedToMe,
      myDepartment,
      all,
      overdue,
      myReports,
      completed,
      rejected,
      closed,
      history,
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
      this.prisma.complaint.count({ where: completedWhere }),
      this.prisma.complaint.count({ where: rejectedWhere }),
      this.prisma.complaint.count({ where: closedWhere }),
      this.prisma.complaint.count({ where: historyWhere }),
    ]);

    return {
      needsAttention,
      assignedToMe,
      myDepartment,
      all,
      overdue,
      myReports,
      completed,
      rejected,
      closed,
      history,
    };
  }

  /**
   * Active operational workload per department for the dashboard panel.
   * Counts only non-terminal complaints currently owned by each department.
   */
  async getDepartmentWorkload(userId: string, municipalityId: string) {
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);

    if (
      !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) &&
      !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)
    ) {
      throw new ForbiddenException(
        'You do not have permission to view department workload',
      );
    }

    let departmentIdFilter: string | undefined;
    if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) {
      departmentIdFilter = undefined;
    } else if (user?.departmentId) {
      departmentIdFilter = user.departmentId;
    } else {
      return [];
    }

    const departments = await this.prisma.department.findMany({
      where: {
        municipalityId,
        deletedAt: null,
        ...(departmentIdFilter ? { id: departmentIdFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        headUserId: true,
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const includeTransferOutbound =
      permissions.includes(PERMISSIONS.DEPARTMENT_CREATE) ||
      permissions.includes(PERMISSIONS.DEPARTMENT_UPDATE);

    const [activeByDept, overdueByDept, transfersIn, transfersOut] =
      await Promise.all([
        this.prisma.complaint.groupBy({
          by: ['departmentId'],
          where: {
            municipalityId,
            deletedAt: null,
            departmentId: { not: null },
            status: activeStatusWhere(),
          },
          _count: { _all: true },
        }),
        this.prisma.complaint.groupBy({
          by: ['departmentId'],
          where: {
            municipalityId,
            deletedAt: null,
            departmentId: { not: null },
            AND: [buildOverdueWhere(now)],
          },
          _count: { _all: true },
        }),
        this.prisma.transferRequest.groupBy({
          by: ['toDepartmentId'],
          where: {
            municipalityId,
            status: TransferStatus.PENDING,
          },
          _count: { _all: true },
        }),
        includeTransferOutbound
          ? this.prisma.transferRequest.groupBy({
              by: ['fromDepartmentId'],
              where: {
                municipalityId,
                status: TransferStatus.PENDING,
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
      ]);

    const activeMap = new Map(
      activeByDept.map((row) => [row.departmentId, row._count._all]),
    );
    const overdueMap = new Map(
      overdueByDept.map((row) => [row.departmentId, row._count._all]),
    );
    const transfersInMap = new Map(
      transfersIn.map((row) => [row.toDepartmentId, row._count._all]),
    );
    const transfersOutMap = new Map(
      transfersOut.map((row) => [row.fromDepartmentId, row._count._all]),
    );

    return departments.map((dept) => {
      const activeComplaints = activeMap.get(dept.id) ?? 0;
      const overdueComplaints = overdueMap.get(dept.id) ?? 0;
      const { healthScore, health } = deriveDepartmentHealth(
        activeComplaints,
        overdueComplaints,
      );
      return {
        id: dept.id,
        name: dept.name,
        nameAr: dept.nameAr,
        nameFr: dept.nameFr,
        head: dept.head,
        staffCount: dept._count.users,
        activeComplaints,
        overdueComplaints,
        pendingTransfersIn: transfersInMap.get(dept.id) ?? 0,
        ...(includeTransferOutbound
          ? {
              pendingTransfersOut: transfersOutMap.get(dept.id) ?? 0,
            }
          : {}),
        healthScore,
        health,
      };
    });
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
        baseWhere.departmentId = user.departmentId;
      } else if (permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)) {
        Object.assign(
          baseWhere,
          this.assignmentsService.buildActiveAssignmentVisibilityFilter(
            userId,
            user?.departmentId,
          ),
        );
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

    const assignedUserIds = await this.prisma.complaintAssignment
      .findMany({
        where: { complaintId },
        select: { assignedToId: true },
      })
      .then((rows) => rows.map((r) => r.assignedToId));

    this.realtime.complaintDeleted({
      id: complaintId,
      municipalityId,
      departmentId: complaint.departmentId,
      createdById: complaint.createdById,
      assignedUserIds,
    });

    return { message: 'Complaint deleted successfully' };
  }
}
