import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { MailService } from '../../core/mail/mail.service';
import { StorageService } from '../../core/storage/storage.service';
import { toUploadUrlPath } from '../../core/storage/upload-path.util';
import { KycDocType, KycAction, VerificationStatus, NotificationType } from '@prisma/client';
import { ReviewAction } from './dto/review-kyc.dto';
import { KycQueryDto } from './dto/kyc-query.dto';
import { paginate } from '../../core/common/dto/pagination.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

const ALLOWED_KYC_MIMES = ['image/jpeg', 'image/png'];
const MAX_KYC_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private permissionsResolver: PermissionsResolver,
    private audit: AuditService,
    private realtime: RealtimeService,
    private mail: MailService,
    private storage: StorageService,
  ) {}

  /**
   * Submit KYC verification (citizen)
   */
  async submit(
    userId: string,
    municipalityId: string,
    files: {
      idFront: Express.Multer.File[];
      idBack: Express.Multer.File[];
      selfie: Express.Multer.File[];
    },
  ) {
    // Validate all 3 files are present
    if (!files.idFront?.[0] || !files.idBack?.[0] || !files.selfie?.[0]) {
      throw new BadRequestException(
        'All three documents are required: idFront, idBack, selfie',
      );
    }

    // Validate file types and sizes
    const allFiles = [files.idFront[0], files.idBack[0], files.selfie[0]];
    for (const file of allFiles) {
      if (!ALLOWED_KYC_MIMES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.mimetype}. Only JPEG and PNG are accepted.`,
        );
      }
      if (file.size > MAX_KYC_FILE_SIZE) {
        throw new BadRequestException(
          `File "${file.originalname}" exceeds the 10MB size limit`,
        );
      }
    }

    // Check for existing active submission
    const existingSubmission = await this.prisma.kycSubmission.findFirst({
      where: {
        userId,
        status: VerificationStatus.PENDING,
        deletedAt: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException(
        'You already have a pending KYC submission. Please wait for it to be reviewed.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verificationStatus: true, createdVia: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Self-service KYC is for citizens only; staff accounts are provisioned internally.
    if (user.createdVia !== 'SELF_REGISTRATION') {
      throw new ForbiddenException(
        'Identity verification submission is only available for citizen accounts',
      );
    }

    if (user.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Your identity is already verified');
    }

    // Create submission and save files in a transaction
    const submission = await this.prisma.$transaction(async (tx) => {
      // Create the submission
      const sub = await tx.kycSubmission.create({
        data: {
          userId,
          municipalityId,
          status: VerificationStatus.PENDING,
        },
      });

      // Save files to disk
      const submissionDir = this.storage.getKycSubmissionDir(sub.id);

      const docTypes: { file: Express.Multer.File; type: KycDocType }[] = [
        { file: files.idFront[0], type: KycDocType.ID_FRONT },
        { file: files.idBack[0], type: KycDocType.ID_BACK },
        { file: files.selfie[0], type: KycDocType.SELFIE },
      ];

      for (const { file, type } of docTypes) {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const filename = `${type.toLowerCase()}_${uuid()}${ext}`;
        const storageKey = path.join('kyc', sub.id, filename).replace(/\\/g, '/');
        const fullPath = this.storage.resolveDiskPath(storageKey);

        fs.writeFileSync(fullPath, file.buffer);

        await tx.kycAttachment.create({
          data: {
            submissionId: sub.id,
            docType: type,
            storageKey: storageKey.replace(/\\/g, '/'),
            mimeType: file.mimetype,
            size: file.size,
          },
        });
      }

      // Update user verification status to PENDING
      await tx.user.update({
        where: { id: userId },
        data: { verificationStatus: VerificationStatus.PENDING },
      });

      // Set selfie as avatar
      const selfieAttachment = await tx.kycAttachment.findFirst({
        where: { submissionId: sub.id, docType: KycDocType.SELFIE },
      });
      if (selfieAttachment) {
        await tx.user.update({
          where: { id: userId },
          data: { avatarUrl: toUploadUrlPath(selfieAttachment.storageKey) },
        });
      }

      // Create audit log
      await tx.kycReviewLog.create({
        data: {
          submissionId: sub.id,
          action: KycAction.SUBMITTED,
          performedById: userId,
        },
      });

      return sub;
    });

    // Notify verifiers (async, don't block)
    this.notifyVerifiers(municipalityId, submission.id).catch((err) =>
      this.logger.error('Failed to notify verifiers', err),
    );

    // Realtime: tell verifiers + the citizen their status went to PENDING
    this.realtime.kycUpdated({
      userId,
      municipalityId,
      status: VerificationStatus.PENDING,
    });

    // Audit
    const submitter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.audit.log({
      actorId: userId,
      actorEmail: submitter?.email,
      municipalityId,
      action: AUDIT_ACTIONS.KYC_SUBMIT,
      resourceType: 'KycSubmission',
      resourceId: submission.id,
    });

    // Return submission with attachments
    return this.prisma.kycSubmission.findUnique({
      where: { id: submission.id },
      include: {
        attachments: {
          select: {
            id: true,
            docType: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  /**
   * Get current user's KYC status
   */
  async getMyStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verificationStatus: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestSubmission = await this.prisma.kycSubmission.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectionReason: true,
      },
    });

    return {
      verificationStatus: user.verificationStatus,
      submittedAt: latestSubmission?.submittedAt || null,
      reviewedAt: latestSubmission?.reviewedAt || null,
      rejectionReason: latestSubmission?.rejectionReason || null,
      hasActiveSubmission: latestSubmission?.status === VerificationStatus.PENDING,
    };
  }

  /**
   * List KYC submissions (admin/verifier)
   */
  async findAll(municipalityId: string, query: KycQueryDto) {
    const where: any = {
      municipalityId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [submissions, total] = await Promise.all([
      this.prisma.kycSubmission.findMany({
        where,
        include: {
          attachments: {
            select: {
              id: true,
              docType: true,
              mimeType: true,
              size: true,
              createdAt: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.kycSubmission.count({ where }),
    ]);

    return paginate(submissions, total, query);
  }

  /**
   * Get single KYC submission detail (admin/verifier)
   */
  async findOne(submissionId: string, municipalityId: string) {
    const submission = await this.prisma.kycSubmission.findFirst({
      where: {
        id: submissionId,
        municipalityId,
        deletedAt: null,
      },
      include: {
        attachments: {
          select: {
            id: true,
            docType: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            verificationStatus: true,
          },
        },
        reviewLogs: {
          include: {
            performedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    return submission;
  }

  /**
   * Review a KYC submission (approve/reject)
   */
  async review(
    submissionId: string,
    reviewerId: string,
    municipalityId: string,
    action: ReviewAction,
    reason?: string,
  ) {
    const submission = await this.prisma.kycSubmission.findFirst({
      where: {
        id: submissionId,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    if (submission.status !== VerificationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot review a submission that is already ${submission.status}`,
      );
    }

    if (action === ReviewAction.REJECT && !reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const newStatus =
      action === ReviewAction.APPROVE
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED;

    const kycAction =
      action === ReviewAction.APPROVE
        ? KycAction.APPROVED
        : KycAction.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      // Update submission
      await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          rejectionReason: action === ReviewAction.REJECT ? reason : null,
        },
      });

      // Update user verification status
      const updateData: any = { verificationStatus: newStatus };
      if (newStatus === VerificationStatus.VERIFIED) {
        updateData.verifiedAt = new Date();
      }
      await tx.user.update({
        where: { id: submission.userId },
        data: updateData,
      });

      // Create audit log
      await tx.kycReviewLog.create({
        data: {
          submissionId,
          action: kycAction,
          performedById: reviewerId,
          reason: reason || null,
        },
      });
    });

    // Notify the citizen
    const notificationType =
      action === ReviewAction.APPROVE
        ? NotificationType.KYC_APPROVED
        : NotificationType.KYC_REJECTED;

    const title =
      action === ReviewAction.APPROVE
        ? 'Identity Verified'
        : 'Identity Verification Rejected';

    const body =
      action === ReviewAction.APPROVE
        ? 'Your identity has been verified. You can now submit complaints.'
        : `Your identity verification was rejected: ${reason}`;

    this.notifications
      .createAndSend(municipalityId, [submission.userId], notificationType, title, body, {
        submissionId,
      })
      .catch((err) => this.logger.error('Failed to notify citizen', err));

    // Email notification (best effort).
    this.prisma.user
      .findUnique({
        where: { id: submission.userId },
        select: { email: true, firstName: true, locale: true },
      })
      .then((u) => {
        if (!u?.email) return;
        const locale = (u.locale ?? 'EN') as 'EN' | 'AR' | 'FR';
        const tpl =
          action === ReviewAction.APPROVE
            ? this.mail.kycApproved(locale, u.firstName)
            : this.mail.kycRejected(locale, { firstName: u.firstName, reason });
        return this.mail.send({ to: u.email, ...tpl });
      })
      .catch((err) => this.logger.warn(`KYC email send failed: ${err?.message ?? err}`));

    // Audit
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { email: true },
    });
    await this.audit.log({
      actorId: reviewerId,
      actorEmail: reviewer?.email,
      municipalityId,
      action:
        action === ReviewAction.APPROVE
          ? AUDIT_ACTIONS.KYC_APPROVE
          : AUDIT_ACTIONS.KYC_REJECT,
      resourceType: 'KycSubmission',
      resourceId: submissionId,
      metadata: { targetUserId: submission.userId, reason },
    });

    // Realtime: instant update for the citizen + everyone watching the queue
    this.realtime.kycUpdated({
      userId: submission.userId,
      municipalityId,
      status: newStatus,
    });

    return this.findOne(submissionId, municipalityId);
  }

  /**
   * Manually override a user's KYC verification status (admin power-tool).
   * Use cases:
   *   - Walk-in identification (admin saw the citizen's ID in person)
   *   - Reverting a mistakenly verified user
   *   - Testing flows in dev/staging
   * Creates a synthetic submission + audit log so the action is fully traceable.
   */
  async manualOverride(
    targetUserId: string,
    actorId: string,
    municipalityId: string,
    newStatus: VerificationStatus,
    reason: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException(
        'A reason of at least 5 characters is required for manual KYC override',
      );
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, municipalityId },
      select: {
        id: true,
        email: true,
        verificationStatus: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found in your municipality');
    }

    if (target.verificationStatus === newStatus) {
      throw new BadRequestException(
        `User is already ${newStatus.toLowerCase()}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update the user
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          verificationStatus: newStatus,
          verifiedAt:
            newStatus === VerificationStatus.VERIFIED ? new Date() : null,
        },
      });

      // Auto-resolve any pending submission so it doesn't sit forever
      const pending = await tx.kycSubmission.findFirst({
        where: {
          userId: targetUserId,
          status: VerificationStatus.PENDING,
          deletedAt: null,
        },
      });
      if (pending) {
        await tx.kycSubmission.update({
          where: { id: pending.id },
          data: {
            status: newStatus,
            reviewedAt: new Date(),
            reviewedById: actorId,
            rejectionReason:
              newStatus === VerificationStatus.REJECTED ? reason : null,
          },
        });
        await tx.kycReviewLog.create({
          data: {
            submissionId: pending.id,
            action:
              newStatus === VerificationStatus.VERIFIED
                ? KycAction.APPROVED
                : KycAction.REJECTED,
            performedById: actorId,
            reason: `[Manual override] ${reason}`,
          },
        });
      }
    });

    // Notify the target user
    if (newStatus === VerificationStatus.VERIFIED) {
      this.notifications
        .createAndSend(
          municipalityId,
          [targetUserId],
          NotificationType.KYC_APPROVED,
          'Identity Verified',
          'An administrator has verified your identity.',
          {},
        )
        .catch((err) => this.logger.error('Notify failed', err));
    } else if (newStatus === VerificationStatus.UNVERIFIED) {
      this.notifications
        .createAndSend(
          municipalityId,
          [targetUserId],
          NotificationType.KYC_REJECTED,
          'Verification Reset',
          `Your verification status was reset by an administrator: ${reason}`,
          {},
        )
        .catch((err) => this.logger.error('Notify failed', err));
    }

    // Audit
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { email: true },
    });
    await this.audit.log({
      actorId,
      actorEmail: actor?.email,
      municipalityId,
      action: AUDIT_ACTIONS.KYC_OVERRIDE,
      resourceType: 'User',
      resourceId: targetUserId,
      metadata: {
        targetEmail: target.email,
        previousStatus: target.verificationStatus,
        newStatus,
        reason,
      },
    });

    this.realtime.kycUpdated({
      userId: targetUserId,
      municipalityId,
      status: newStatus,
    });

    return {
      userId: targetUserId,
      verificationStatus: newStatus,
      previousStatus: target.verificationStatus,
    };
  }

  /**
   * Get secure file path for a KYC attachment
   */
  async getAttachmentPath(
    submissionId: string,
    attachmentId: string,
    municipalityId: string,
  ): Promise<{ filePath: string; mimeType: string; filename: string }> {
    const attachment = await this.prisma.kycAttachment.findFirst({
      where: {
        id: attachmentId,
        submissionId,
        submission: {
          municipalityId,
          deletedAt: null,
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const fullPath = this.storage.resolveDiskPath(attachment.storageKey);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      filePath: fullPath,
      mimeType: attachment.mimeType,
      filename: `${attachment.docType.toLowerCase()}.${attachment.mimeType === 'image/png' ? 'png' : 'jpg'}`,
    };
  }

  /**
   * Notify users with KYC review permissions about a new submission
   */
  private async notifyVerifiers(municipalityId: string, submissionId: string) {
    // Find all users with kyc.review permission in this municipality
    const verifiers = await this.prisma.user.findMany({
      where: {
        municipalityId,
        isActive: true,
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: {
                  permission: { key: PERMISSIONS.KYC_REVIEW },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (verifiers.length > 0) {
      await this.notifications.createAndSend(
        municipalityId,
        verifiers.map((v) => v.id),
        NotificationType.KYC_SUBMITTED,
        'New KYC Submission',
        'A citizen has submitted identity verification documents for review.',
        { submissionId },
      );
    }
  }
}
