import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FcmService } from '../../core/fcm/fcm.service';
import { paginate } from '../../core/common/dto/pagination.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationType, Platform } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
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
    return { count };
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
  ) {
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
    if (userIds.length > 0) {
      await this.prisma.userNotification.createMany({
        data: userIds.map((userId) => ({
          userId,
          notificationId: notification.id,
        })),
        skipDuplicates: true,
      });
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
    await this.fcmService.sendToUsers(userIds, title, body, stringData);

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
