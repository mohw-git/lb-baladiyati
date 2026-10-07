import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PlatformBroadcastAudience,
  PlatformBroadcastChannel,
  PlatformBroadcastStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlatformBroadcastAudienceService } from './platform-broadcast-audience.service';
import { PLATFORM_BROADCAST_ALL_USERS_CONFIRM_PHRASE } from './platform-broadcast.constants';
import type { PlatformBroadcastPreviewDto } from './dto/platform-broadcast-preview.dto';
import type { PlatformBroadcastSendDto } from './dto/platform-broadcast-send.dto';
import type { PlatformBroadcastQueryDto } from './dto/platform-broadcast-query.dto';

@Injectable()
export class PlatformBroadcastsService {
  private readonly logger = new Logger(PlatformBroadcastsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audienceService: PlatformBroadcastAudienceService,
    private readonly notifications: NotificationsService,
  ) {}

  async preview(dto: PlatformBroadcastPreviewDto) {
    this.validateAudienceConfig(dto.audience, dto.audienceConfig);
    const recipientCount = await this.audienceService.countRecipients(
      dto.audience,
      dto.audienceConfig,
    );
    return {
      recipientCount,
      audience: dto.audience,
      audienceConfig: dto.audienceConfig ?? null,
    };
  }

  async create(
    actorId: string,
    dto: PlatformBroadcastSendDto,
  ) {
    if (dto.idempotencyKey?.trim()) {
      const existing = await this.prisma.platformBroadcast.findUnique({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
        include: { createdBy: { select: this.createdBySelect } },
      });
      if (existing) {
        return this.toResponse(existing);
      }
    }

    this.validateAudienceConfig(dto.audience, dto.audienceConfig);
    this.assertAllUsersConfirmation(dto.audience, dto.confirmPhrase);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt is invalid');
    }
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const recipientCount = await this.audienceService.countRecipients(
      dto.audience,
      dto.audienceConfig,
    );
    if (recipientCount === 0) {
      throw new BadRequestException('No recipients match this audience');
    }

    const record = await this.prisma.platformBroadcast.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        deepLink: dto.deepLink?.trim() || null,
        audience: dto.audience,
        audienceConfig: (dto.audienceConfig ?? undefined) as Prisma.InputJsonValue,
        channels: dto.channels,
        status: PlatformBroadcastStatus.SCHEDULED,
        scheduledAt: scheduledAt ?? new Date(),
        recipientCount,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
        createdById: actorId,
      },
      include: { createdBy: { select: this.createdBySelect } },
    });

    if (!scheduledAt) {
      await this.dispatch(record.id);
      return this.findOne(record.id);
    }

    return this.toResponse(record);
  }

  async findAll(query: PlatformBroadcastQueryDto) {
    const where: Prisma.PlatformBroadcastWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.platformBroadcast.findMany({
        where,
        include: { createdBy: { select: this.createdBySelect } },
        skip: query.skip,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.platformBroadcast.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toResponse(r)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / (query.limit ?? 20)) || 1,
      },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.platformBroadcast.findUnique({
      where: { id },
      include: { createdBy: { select: this.createdBySelect } },
    });
    if (!row) {
      throw new NotFoundException('Broadcast not found');
    }
    return this.toResponse(row);
  }

  /** Claim and send a scheduled broadcast (cron or immediate). */
  async dispatch(id: string): Promise<void> {
    const claimed = await this.prisma.platformBroadcast.updateMany({
      where: {
        id,
        status: PlatformBroadcastStatus.SCHEDULED,
      },
      data: { status: PlatformBroadcastStatus.SENDING },
    });
    if (claimed.count === 0) {
      return;
    }

    const broadcast = await this.prisma.platformBroadcast.findUnique({ where: { id } });
    if (!broadcast) {
      return;
    }

    try {
      const grouped = await this.audienceService.resolveRecipientsByMunicipality(
        broadcast.audience,
        broadcast.audienceConfig as { municipalityIds?: string[]; roleIds?: string[]; userIds?: string[] } | null,
      );

      const sendPush =
        broadcast.channels === PlatformBroadcastChannel.PUSH ||
        broadcast.channels === PlatformBroadcastChannel.BOTH;

      const payload: Record<string, string> = {
        broadcastId: broadcast.id,
      };
      if (broadcast.deepLink) {
        payload.deepLink = broadcast.deepLink;
      }

      for (const [municipalityId, userIds] of grouped) {
        if (!userIds.length) continue;
        await this.notifications.createAndSend(
          municipalityId,
          userIds,
          NotificationType.PLATFORM_BROADCAST,
          broadcast.title,
          broadcast.body,
          payload,
          { push: sendPush },
        );
      }

      await this.prisma.platformBroadcast.update({
        where: { id },
        data: {
          status: PlatformBroadcastStatus.SENT,
          sentAt: new Date(),
          recipientCount: Array.from(grouped.values()).reduce((n, ids) => n + ids.length, 0),
          failureReason: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Platform broadcast ${id} failed: ${message}`);
      await this.prisma.platformBroadcast.update({
        where: { id },
        data: {
          status: PlatformBroadcastStatus.FAILED,
          failureReason: message.slice(0, 2000),
        },
      });
    }
  }

  async processDueScheduled(): Promise<number> {
    const due = await this.prisma.platformBroadcast.findMany({
      where: {
        status: PlatformBroadcastStatus.SCHEDULED,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: { id: true },
    });

    for (const row of due) {
      await this.dispatch(row.id);
    }
    return due.length;
  }

  private assertAllUsersConfirmation(
    audience: PlatformBroadcastAudience,
    confirmPhrase?: string,
  ) {
    if (audience !== PlatformBroadcastAudience.ALL_USERS) {
      return;
    }
    if (confirmPhrase?.trim() !== PLATFORM_BROADCAST_ALL_USERS_CONFIRM_PHRASE) {
      throw new BadRequestException(
        `ALL_USERS broadcasts require confirmPhrase "${PLATFORM_BROADCAST_ALL_USERS_CONFIRM_PHRASE}"`,
      );
    }
  }

  private validateAudienceConfig(
    audience: PlatformBroadcastAudience,
    config?: { municipalityIds?: string[]; roleIds?: string[]; userIds?: string[] } | null,
  ) {
    if (audience === PlatformBroadcastAudience.MUNICIPALITIES && !config?.municipalityIds?.length) {
      throw new BadRequestException('municipalityIds is required for MUNICIPALITIES audience');
    }
    if (audience === PlatformBroadcastAudience.ROLES && !config?.roleIds?.length) {
      throw new BadRequestException('roleIds is required for ROLES audience');
    }
    if (audience === PlatformBroadcastAudience.USERS && !config?.userIds?.length) {
      throw new BadRequestException('userIds is required for USERS audience');
    }
  }

  private readonly createdBySelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  } as const;

  private toResponse(row: {
    id: string;
    title: string;
    body: string;
    deepLink: string | null;
    audience: PlatformBroadcastAudience;
    audienceConfig: unknown;
    channels: PlatformBroadcastChannel;
    status: PlatformBroadcastStatus;
    scheduledAt: Date | null;
    sentAt: Date | null;
    recipientCount: number | null;
    failureReason: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      deepLink: row.deepLink,
      audience: row.audience,
      audienceConfig: row.audienceConfig,
      channels: row.channels,
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      recipientCount: row.recipientCount,
      failureReason: row.failureReason,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy,
    };
  }
}
