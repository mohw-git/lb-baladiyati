import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List categories.
   * @param includeInactive - if true, return all categories (for admin management)
   */
  async findAll(municipalityId: string, includeInactive = false) {
    const where: any = { municipalityId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const categories = await this.prisma.complaintCategory.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        icon: true,
        isActive: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
        createdAt: true,
        _count: {
          select: { complaints: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { data: categories };
  }

  async findOne(id: string, municipalityId: string) {
    const category = await this.prisma.complaintCategory.findFirst({
      where: {
        id,
        municipalityId,
      },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(municipalityId: string, dto: CreateCategoryDto) {
    // Check for duplicate name (among active categories)
    const existing = await this.prisma.complaintCategory.findFirst({
      where: {
        municipalityId,
        name: dto.name,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.complaintCategory.create({
      data: {
        municipalityId,
        name: dto.name,
        nameAr: dto.nameAr,
        nameFr: dto.nameFr,
        departmentId: dto.departmentId,
        icon: dto.icon,
      },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });
  }

  async update(id: string, municipalityId: string, dto: UpdateCategoryDto) {
    await this.findOne(id, municipalityId);

    // Check for duplicate name (among active categories, excluding self)
    if (dto.name) {
      const existing = await this.prisma.complaintCategory.findFirst({
        where: {
          municipalityId,
          name: dto.name,
          id: { not: id },
          isActive: true,
        },
      });

      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    return this.prisma.complaintCategory.update({
      where: { id },
      data: dto,
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });
  }

  async toggleActive(id: string, municipalityId: string, isActive: boolean) {
    const category = await this.findOne(id, municipalityId);

    return this.prisma.complaintCategory.update({
      where: { id },
      data: { isActive },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });
  }

  async remove(id: string, municipalityId: string) {
    await this.findOne(id, municipalityId);

    // Deactivate instead of hard delete
    await this.prisma.complaintCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Category deactivated successfully' };
  }
}
