import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FcmService } from '../../core/fcm/fcm.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { paginate } from '../../core/common/dto/pagination.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationType, Platform } from '@prisma/client';
import type { NotificationSendOptions } from './notification-send.options';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
    private realtime: RealtimeService,
  ) {}

  async findAll(userId: string, query: NotificationQueryDto) {
    const where: any = {
      userId,
    };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.userNotification.findMany({
        where,
        include: {
          notification: true,
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userNotification.count({ where }),
    ]);

    const data = notifications.map((un) => ({
      id: un.id,
      type: un.notification.type,
      title: un.notification.title,
      body: un.notification.body,
      data: un.notification.data,
      isRead: un.isRead,
      createdAt: un.createdAt,
    }));

    return paginate(data, total, query);
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.userNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return { unreadCount: count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.userNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'All notifications marked as read' };
  }

  async createAndSend(
    municipalityId: string,
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: NotificationSendOptions,
  ) {
    const sendPush = options?.push !== false;
    // Create notification record. We persist the title/body in the
    // canonical (English) language so the in-app feed reads naturally
    // even if the user later switches locales. The push payload uses
    // the same strings — translation per device would require a
    // user-locale-aware fan-out which we can layer on later via the
    // `data` channel.
    const notification = await this.prisma.notification.create({
      data: {
        municipalityId,
        type,
        title,
        body,
        data: data ?? undefined,
      },
    });

    // Create user notification rows. `skipDuplicates` guards against
    // accidental double-fan-out (the unique index on (userId, notifId)
    // would otherwise blow up the whole transaction).
    const recipientIds = Array.from(new Set(userIds.filter(Boolean)));

    if (recipientIds.length > 0) {
      await this.prisma.userNotification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          notificationId: notification.id,
        })),
        skipDuplicates: true,
      });

      // Realtime: per-recipient so clients invalidate inbox + unread badge.
      try {
        const rows = await this.prisma.userNotification.findMany({
          where: {
            notificationId: notification.id,
            userId: { in: recipientIds },
          },
          select: { id: true, userId: true },
        });
        for (const row of rows) {
          this.realtime.notificationNew({ id: row.id, userId: row.userId });
        }
      } catch (err) {
        this.logger.warn(
          `Realtime notification:new emit failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Send FCM push. Failures are swallowed by the FcmService so they
    // never break the underlying business event.
    const stringData: Record<string, string> = { type };
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        stringData[key] = String(value);
      });
    }
    if (sendPush) {
      await this.fcmService.sendToUsers(recipientIds, title, body, stringData);
    }

    return notification;
  }

  // Device token management
  async registerToken(userId: string, token: string, platform: Platform) {
    // Upsert to handle token updates
    const existing = await this.prisma.deviceToken.findFirst({
      where: { userId, token },
    });

    if (existing) {
      return this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: { platform },
      });
    }

    return this.prisma.deviceToken.create({
      data: { userId, token, platform },
    });
  }

  async removeToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
    return { message: 'Token removed successfully' };
  }
}
