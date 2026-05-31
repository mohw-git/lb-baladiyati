import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  assertCanManageCategory,
  assertDepartmentChangeAllowed,
  CategoryAccessContext,
  CategoryAccessError,
  isDepartmentScopedCategoryManager,
  resolveCategoryDepartmentId,
} from '@shared/utils/category-access';

type CategoryActor = { id: string; email: string };

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private permissionsResolver: PermissionsResolver,
    private audit: AuditService,
  ) {}

  private async accessContext(userId: string): Promise<CategoryAccessContext> {
    const [permissions, user] = await Promise.all([
      this.permissionsResolver.getUserPermissions(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      }),
    ]);
    return {
      permissions,
      userDepartmentId: user?.departmentId ?? null,
    };
  }

  private toForbidden(err: CategoryAccessError): ForbiddenException {
    return new ForbiddenException(err.message);
  }

  private async assertDepartmentInMunicipality(
    municipalityId: string,
    departmentId: string,
  ): Promise<void> {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!dept) {
      throw new BadRequestException(
        'Department not found in this municipality',
      );
    }
  }

  private async logCategoryAudit(
    req: Request | undefined,
    actor: CategoryActor,
    municipalityId: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.logFromRequest(req, {
      actorId: actor.id,
      actorEmail: actor.email,
      municipalityId,
      action,
      resourceType: 'ComplaintCategory',
      resourceId,
      metadata,
    });
  }

  async assertActiveMunicipality(municipalityId: string) {
    const muni = await this.prisma.municipality.findFirst({
      where: { id: municipalityId, isActive: true },
      select: { id: true },
    });
    if (!muni) {
      throw new NotFoundException('Municipality not found');
    }
    return muni;
  }

  /**
   * List categories.
   * @param includeInactive - if true, return all categories (for admin management)
   */
  async findAll(
    municipalityId: string,
    includeInactive = false,
    userId?: string,
  ) {
    const where: Record<string, unknown> = { municipalityId };
    if (!includeInactive) {
      where.isActive = true;
    }

    if (includeInactive && userId) {
      const ctx = await this.accessContext(userId);
      if (isDepartmentScopedCategoryManager(ctx)) {
        if (!ctx.userDepartmentId) {
          return { data: [] };
        }
        where.departmentId = ctx.userDepartmentId;
      }
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

  private async findOneForManagement(
    id: string,
    municipalityId: string,
    ctx: CategoryAccessContext,
  ) {
    const category = await this.findOne(id, municipalityId);
    try {
      assertCanManageCategory(ctx, { departmentId: category.departmentId });
    } catch (err) {
      if (err instanceof CategoryAccessError) {
        throw this.toForbidden(err);
      }
      throw err;
    }
    return category;
  }

  async create(
    municipalityId: string,
    dto: CreateCategoryDto,
    actor: CategoryActor,
    req?: Request,
  ) {
    const ctx = await this.accessContext(actor.id);

    let departmentId: string | null;
    try {
      departmentId = resolveCategoryDepartmentId(ctx, dto.departmentId);
    } catch (err) {
      if (err instanceof CategoryAccessError) {
        throw this.toForbidden(err);
      }
      throw err;
    }

    if (departmentId) {
      await this.assertDepartmentInMunicipality(municipalityId, departmentId);
    }

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

    const category = await this.prisma.complaintCategory.create({
      data: {
        municipalityId,
        name: dto.name,
        nameAr: dto.nameAr,
        nameFr: dto.nameFr,
        departmentId,
        icon: dto.icon,
      },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });

    await this.logCategoryAudit(req, actor, municipalityId, AUDIT_ACTIONS.CATEGORY_CREATE, category.id, {
      name: category.name,
      departmentId: category.departmentId,
      departmentName: category.department?.name ?? null,
    });

    return category;
  }

  async update(
    id: string,
    municipalityId: string,
    dto: UpdateCategoryDto,
    actor: CategoryActor,
    req?: Request,
  ) {
    const ctx = await this.accessContext(actor.id);
    const category = await this.findOneForManagement(id, municipalityId, ctx);

    try {
      assertDepartmentChangeAllowed(
        ctx,
        category.departmentId,
        dto.departmentId,
      );
    } catch (err) {
      if (err instanceof CategoryAccessError) {
        throw this.toForbidden(err);
      }
      throw err;
    }

    let nextDepartmentId = category.departmentId;
    if (dto.departmentId !== undefined) {
      nextDepartmentId = dto.departmentId;
      if (nextDepartmentId) {
        await this.assertDepartmentInMunicipality(
          municipalityId,
          nextDepartmentId,
        );
      }
    }

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

    const updated = await this.prisma.complaintCategory.update({
      where: { id },
      data: {
        ...dto,
        departmentId: dto.departmentId !== undefined ? nextDepartmentId : undefined,
      },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });

    const changedFields = Object.keys(dto).filter(
      (key) => dto[key as keyof UpdateCategoryDto] !== undefined,
    );

    if (
      dto.departmentId !== undefined &&
      dto.departmentId !== category.departmentId
    ) {
      await this.logCategoryAudit(
        req,
        actor,
        municipalityId,
        AUDIT_ACTIONS.CATEGORY_MOVE_DEPARTMENT,
        id,
        {
          name: updated.name,
          previousDepartmentId: category.departmentId,
          newDepartmentId: updated.departmentId,
        },
      );
    }

    const nonMoveChanges = changedFields.filter((f) => f !== 'departmentId');
    if (nonMoveChanges.length > 0) {
      await this.logCategoryAudit(req, actor, municipalityId, AUDIT_ACTIONS.CATEGORY_UPDATE, id, {
        name: updated.name,
        changedFields: nonMoveChanges,
        previous: {
          name: category.name,
          icon: category.icon,
          isActive: category.isActive,
        },
        next: {
          name: updated.name,
          icon: updated.icon,
          isActive: updated.isActive,
        },
      });
    }

    return updated;
  }

  async toggleActive(
    id: string,
    municipalityId: string,
    isActive: boolean,
    actor: CategoryActor,
    req?: Request,
  ) {
    const ctx = await this.accessContext(actor.id);
    const category = await this.findOneForManagement(id, municipalityId, ctx);

    const updated = await this.prisma.complaintCategory.update({
      where: { id },
      data: { isActive },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, nameFr: true },
        },
      },
    });

    await this.logCategoryAudit(
      req,
      actor,
      municipalityId,
      isActive ? AUDIT_ACTIONS.CATEGORY_ACTIVATE : AUDIT_ACTIONS.CATEGORY_DEACTIVATE,
      id,
      {
        name: updated.name,
        departmentId: updated.departmentId,
        isActive,
      },
    );

    return updated;
  }

  async remove(
    id: string,
    municipalityId: string,
    actor: CategoryActor,
    req?: Request,
  ) {
    const ctx = await this.accessContext(actor.id);
    const category = await this.findOneForManagement(id, municipalityId, ctx);

    // Soft delete only — preserve historical complaint references.
    await this.prisma.complaintCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await this.logCategoryAudit(req, actor, municipalityId, AUDIT_ACTIONS.CATEGORY_DELETE, id, {
      name: category.name,
      departmentId: category.departmentId,
      softDelete: true,
    });

    return { message: 'Category deactivated successfully' };
  }
}
