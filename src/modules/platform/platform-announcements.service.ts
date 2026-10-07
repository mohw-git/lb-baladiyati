import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlatformAnnouncementStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { paginate } from '../../core/common/dto/pagination.dto';
import { CreatePlatformAnnouncementDto } from './dto/create-platform-announcement.dto';
import { UpdatePlatformAnnouncementDto } from './dto/update-platform-announcement.dto';
import {
  PlatformAnnouncementPublicQueryDto,
  PlatformAnnouncementQueryDto,
} from './dto/platform-announcement-query.dto';

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class PlatformAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private now() {
    return new Date();
  }

  /** Published, within schedule, not expired — for public portal. */
  private publishedPublicWhere(now = this.now()): Prisma.PlatformAnnouncementWhereInput {
    return {
      deletedAt: null,
      status: PlatformAnnouncementStatus.PUBLISHED,
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    };
  }

  private mapRow(row: any) {
    return {
      ...row,
      publishAt: row.publishAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findPublic(query: PlatformAnnouncementPublicQueryDto) {
    const now = this.now();
    const where: Prisma.PlatformAnnouncementWhereInput = {
      ...this.publishedPublicWhere(now),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { summary: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.platformAnnouncement.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { priority: 'desc' },
          { publishAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: query.skip,
        take: query.limit,
        include: { createdBy: { select: authorSelect } },
      }),
      this.prisma.platformAnnouncement.count({ where }),
    ]);

    return paginate(items.map((r) => this.mapRow(r)), total, query);
  }

  async findPublicOne(id: string) {
    const row = await this.prisma.platformAnnouncement.findFirst({
      where: { id, ...this.publishedPublicWhere() },
      include: { createdBy: { select: authorSelect } },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return this.mapRow(row);
  }

  async findAdmin(query: PlatformAnnouncementQueryDto) {
    const now = this.now();
    const where: Prisma.PlatformAnnouncementWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.expired === true
        ? { expiresAt: { lt: now } }
        : query.expired === false
          ? { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }
          : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { summary: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.platformAnnouncement.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
        include: { createdBy: { select: authorSelect } },
      }),
      this.prisma.platformAnnouncement.count({ where }),
    ]);

    return paginate(items.map((r) => this.mapRow(r)), total, query);
  }

  async findAdminOne(id: string) {
    const row = await this.prisma.platformAnnouncement.findFirst({
      where: { id, deletedAt: null },
      include: { createdBy: { select: authorSelect } },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return this.mapRow(row);
  }

  async create(createdById: string, dto: CreatePlatformAnnouncementDto) {
    const row = await this.prisma.platformAnnouncement.create({
      data: {
        title: dto.title.trim(),
        titleAr: dto.titleAr?.trim() || null,
        titleFr: dto.titleFr?.trim() || null,
        summary: dto.summary.trim(),
        summaryAr: dto.summaryAr?.trim() || null,
        summaryFr: dto.summaryFr?.trim() || null,
        content: dto.content.trim(),
        contentAr: dto.contentAr?.trim() || null,
        contentFr: dto.contentFr?.trim() || null,
        isPinned: dto.isPinned ?? false,
        priority: dto.priority ?? 0,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById,
        status: PlatformAnnouncementStatus.DRAFT,
      },
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  async update(id: string, dto: UpdatePlatformAnnouncementDto) {
    await this.ensureExists(id);
    const data: Prisma.PlatformAnnouncementUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.titleAr !== undefined) data.titleAr = dto.titleAr?.trim() || null;
    if (dto.titleFr !== undefined) data.titleFr = dto.titleFr?.trim() || null;
    if (dto.summary !== undefined) data.summary = dto.summary.trim();
    if (dto.summaryAr !== undefined) data.summaryAr = dto.summaryAr?.trim() || null;
    if (dto.summaryFr !== undefined) data.summaryFr = dto.summaryFr?.trim() || null;
    if (dto.content !== undefined) data.content = dto.content.trim();
    if (dto.contentAr !== undefined) data.contentAr = dto.contentAr?.trim() || null;
    if (dto.contentFr !== undefined) data.contentFr = dto.contentFr?.trim() || null;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.publishAt !== undefined) {
      data.publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const row = await this.prisma.platformAnnouncement.update({
      where: { id },
      data,
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Image must be an image file');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be smaller than 5MB');
    }
    await this.ensureExists(id);
    const url = await this.storage.saveFile(file, 'platform/announcements');
    const row = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { imageUrl: url },
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  async publish(id: string) {
    const existing = await this.ensureExists(id);
    if (existing.status === PlatformAnnouncementStatus.ARCHIVED) {
      throw new BadRequestException('Archived announcements cannot be published');
    }
    const now = this.now();
    const publishAt =
      existing.publishAt && existing.publishAt > now ? existing.publishAt : now;
    const row = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: {
        status: PlatformAnnouncementStatus.PUBLISHED,
        publishAt,
      },
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  async unpublish(id: string) {
    await this.ensureExists(id);
    const row = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { status: PlatformAnnouncementStatus.DRAFT },
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  async archive(id: string) {
    await this.ensureExists(id);
    const row = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { status: PlatformAnnouncementStatus.ARCHIVED },
      include: { createdBy: { select: authorSelect } },
    });
    return this.mapRow(row);
  }

  private async ensureExists(id: string) {
    const row = await this.prisma.platformAnnouncement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }
}
