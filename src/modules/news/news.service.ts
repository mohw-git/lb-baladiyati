import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../core/common/dto/pagination.dto';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsQueryDto } from './dto/news-query.dto';
import { NotificationType } from '@prisma/client';
import { MailService } from '../../core/mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private permissionsResolver: PermissionsResolver,
    private notifications: NotificationsService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  /**
   * Push an in-app + FCM notification to all citizens of the municipality
   * announcing a newly-published post. Best-effort — failures are logged.
   */
  private async announceNewsToCitizens(news: {
    id: string;
    municipalityId: string;
    title: string;
    titleAr?: string | null;
    titleFr?: string | null;
  }) {
    try {
      // Recipients: all active users in the municipality, citizens or staff.
      // We pull email + locale to fan-out emails alongside in-app notifs.
      const recipients = await this.prisma.user.findMany({
        where: { municipalityId: news.municipalityId, isActive: true },
        select: { id: true, email: true, locale: true },
      });
      if (!recipients.length) return;

      const userIds = recipients.map((r) => r.id);

      // Use the locale-neutral title that we have on every post; FCM
      // payload also carries the deep link so the mobile app can open
      // the announcement directly.
      await this.notifications.createAndSend(
        news.municipalityId,
        userIds,
        NotificationType.NEWS_PUBLISHED,
        news.title,
        news.title,
        {
          newsId: news.id,
          titleAr: news.titleAr ?? null,
          titleFr: news.titleFr ?? null,
          deepLink: `/announcements/${news.id}`,
        },
      );

      // Look up municipality name for the email subject. Best-effort.
      const muni = await this.prisma.municipality.findUnique({
        where: { id: news.municipalityId },
        select: { name: true, nameAr: true, nameFr: true },
      });
      const baseUrl =
        this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3001';
      const announcementUrl = `${baseUrl.replace(/\/$/, '')}/announcements/${news.id}`;

      // Email fan-out, capped + concurrency-light. Failures are logged
      // but never escalate — publishing must not depend on email delivery.
      await Promise.all(
        recipients.slice(0, 5000).map(async (r) => {
          if (!r.email) return;
          const locale = (r.locale ?? 'EN') as 'EN' | 'AR' | 'FR';
          const localizedTitle =
            locale === 'AR'
              ? news.titleAr ?? news.title
              : locale === 'FR'
                ? news.titleFr ?? news.title
                : news.title;
          const muniName =
            locale === 'AR'
              ? muni?.nameAr ?? muni?.name ?? ''
              : locale === 'FR'
                ? muni?.nameFr ?? muni?.name ?? ''
                : muni?.name ?? '';
          const tpl = this.mail.newsPublished(locale, {
            title: localizedTitle,
            municipalityName: muniName,
            announcementUrl,
          });
          return this.mail
            .send({ to: r.email, ...tpl })
            .catch(() => undefined);
        }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to announce news ${news.id}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async findAll(
    userId: string | null,
    municipalityId: string,
    query: NewsQueryDto,
  ) {
    const where: any = {
      municipalityId,
      deletedAt: null,
    };

    // Check permissions for viewing drafts
    let canViewAllDrafts = false;
    let canCreateNews = false;
    if (userId) {
      const permissions = await this.permissionsResolver.getUserPermissions(userId);
      canViewAllDrafts = permissions.includes(PERMISSIONS.NEWS_VIEW_ALL);
      canCreateNews = permissions.includes(PERMISSIONS.NEWS_CREATE);
    }

    // Determine what news items to show
    if (query.published === true) {
      // Explicitly requesting published only
      where.isPublished = true;
    } else if (canViewAllDrafts) {
      // Admin can see all (published + drafts)
      if (query.published === false) {
        where.isPublished = false;
      }
      // else show all
    } else if (canCreateNews && userId) {
      // Non-admin with create permission: show published + their own drafts
      where.OR = [
        { isPublished: true },
        { isPublished: false, authorId: userId },
      ];
    } else {
      // Public/no permissions: only published
      where.isPublished = true;
    }

    const [news, total] = await Promise.all([
      this.prisma.newsPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.newsPost.count({ where }),
    ]);

    return paginate(news, total, query);
  }

  async findOne(id: string, userId: string | null, municipalityId: string) {
    const news = await this.prisma.newsPost.findFirst({
      where: {
        id,
        municipalityId,
        deletedAt: null,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!news) {
      throw new NotFoundException('News post not found');
    }

    // Check if can view drafts
    if (!news.isPublished) {
      if (!userId) {
        throw new NotFoundException('News post not found');
      }
      
      // Allow viewing if: admin with VIEW_ALL, or it's their own draft
      const isOwnDraft = news.authorId === userId;
      if (!isOwnDraft) {
        const permissions = await this.permissionsResolver.getUserPermissions(userId);
        if (!permissions.includes(PERMISSIONS.NEWS_VIEW_ALL)) {
          throw new NotFoundException('News post not found');
        }
      }
    }

    return news;
  }

  async create(
    userId: string,
    municipalityId: string,
    dto: CreateNewsDto,
    coverImage?: Express.Multer.File,
  ) {
    let coverImageUrl: string | undefined;

    if (coverImage) {
      coverImageUrl = await this.storageService.saveFile(coverImage, 'news');
    }

    const news = await this.prisma.newsPost.create({
      data: {
        municipalityId,
        authorId: userId,
        title: dto.title,
        content: dto.content,
        coverImageUrl,
        isPublished: false,
      },
    });

    return {
      id: news.id,
      title: news.title,
      content: news.content,
      coverImageUrl: news.coverImageUrl,
      isPublished: news.isPublished,
      createdAt: news.createdAt,
    };
  }

  async update(
    id: string,
    municipalityId: string,
    dto: UpdateNewsDto,
    coverImage?: Express.Multer.File,
  ) {
    const news = await this.prisma.newsPost.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!news) {
      throw new NotFoundException('News post not found');
    }

    let coverImageUrl = news.coverImageUrl;
    if (coverImage) {
      // Delete old image if exists
      if (news.coverImageUrl) {
        await this.storageService.deleteFile(news.coverImageUrl);
      }
      coverImageUrl = await this.storageService.saveFile(coverImage, 'news');
    }

    return this.prisma.newsPost.update({
      where: { id },
      data: {
        ...dto,
        coverImageUrl,
      },
    });
  }

  async publish(id: string, municipalityId: string) {
    const news = await this.prisma.newsPost.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!news) {
      throw new NotFoundException('News post not found');
    }

    const updated = await this.prisma.newsPost.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Fan-out to citizens. Don't await — keep the publish endpoint snappy
    // and don't fail if FCM/notification fan-out has issues.
    this.announceNewsToCitizens({
      id: updated.id,
      municipalityId,
      title: updated.title,
      titleAr: (updated as any).titleAr,
      titleFr: (updated as any).titleFr,
    }).catch(() => undefined);

    return updated;
  }

  async unpublish(id: string, municipalityId: string) {
    const news = await this.prisma.newsPost.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!news) {
      throw new NotFoundException('News post not found');
    }

    return this.prisma.newsPost.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  async remove(id: string, municipalityId: string) {
    const news = await this.prisma.newsPost.findFirst({
      where: { id, municipalityId, deletedAt: null },
    });

    if (!news) {
      throw new NotFoundException('News post not found');
    }

    await this.prisma.newsPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'News post deleted successfully' };
  }
}
