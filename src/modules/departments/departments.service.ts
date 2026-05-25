import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import {
  isProtectedCitizenAccount,
  staffMemberWhere,
} from '../../core/users/user-governance';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(municipalityId: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        municipalityId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        description: true,
        descriptionAr: true,
        descriptionFr: true,
        createdAt: true,
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
        _count: {
          select: { users: true, complaints: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { data: departments };
  }

  async findOne(id: string, municipalityId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id,
        municipalityId,
        deletedAt: null,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async create(municipalityId: string, dto: CreateDepartmentDto) {
    // Check for duplicate name
    const existing = await this.prisma.department.findFirst({
      where: {
        municipalityId,
        name: dto.name,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Department with this name already exists');
    }

    return this.prisma.department.create({
      data: {
        municipalityId,
        name: dto.name,
        nameAr: dto.nameAr,
        nameFr: dto.nameFr,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        descriptionFr: dto.descriptionFr,
      },
    });
  }

  async update(id: string, municipalityId: string, dto: UpdateDepartmentDto) {
    const department = await this.findOne(id, municipalityId);

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== department.name) {
      const existing = await this.prisma.department.findFirst({
        where: {
          municipalityId,
          name: dto.name,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Department with this name already exists');
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, municipalityId: string) {
    await this.findOne(id, municipalityId);

    // Soft delete
    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Department deleted successfully' };
  }

  // ============================================================
  // POSITIONAL SLOT: Head of Department (HOD)
  // ============================================================

  /**
   * Promote a user to be Head of Department for the given dept.
   * Atomic: updates the slot, grants HOD role to the new head, revokes HOD
   * from the previous holder, and ensures the user is a member of the dept.
   *
   * Caller must have user.assign_role permission (Admin only by default).
   */
  async setHead(
    departmentId: string,
    municipalityId: string,
    newHeadUserId: string,
    actor: { id: string; email: string },
    req?: Request,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const newHead = await this.prisma.user.findFirst({
      where: { id: newHeadUserId, municipalityId, isActive: true },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!newHead) {
      throw new NotFoundException(
        'Target user not found in this municipality (or is inactive)',
      );
    }
    if (isProtectedCitizenAccount(newHead)) {
      throw new BadRequestException(
        'Citizen accounts cannot be promoted to staff positions. ' +
          'Create a separate staff account instead.',
      );
    }

    // Make sure they're a member of THIS department (membership ≠ position)
    if (newHead.departmentId && newHead.departmentId !== departmentId) {
      throw new BadRequestException(
        'Target user belongs to another department. Move them to this ' +
          'department first, then promote.',
      );
    }

    const hodRole = await this.prisma.role.findFirst({
      where: { municipalityId, name: 'Head of Department', deletedAt: null },
    });
    if (!hodRole) {
      throw new NotFoundException('Head of Department role is missing for this municipality');
    }

    // Slot is globally unique — bail out if the user already holds another HOD slot
    const otherSlot = await this.prisma.department.findFirst({
      where: {
        headUserId: newHeadUserId,
        id: { not: departmentId },
      },
      select: { id: true, name: true },
    });
    if (otherSlot) {
      throw new ConflictException(
        `${newHead.firstName} ${newHead.lastName} is already Head of "${otherSlot.name}". ` +
          'A user can only lead one department at a time.',
      );
    }

    const previousHeadId = dept.headUserId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Move the slot
      await tx.department.update({
        where: { id: departmentId },
        data: { headUserId: newHeadUserId },
      });

      // 2. Make sure they're a department member
      if (newHead.departmentId !== departmentId) {
        await tx.user.update({
          where: { id: newHeadUserId },
          data: { departmentId },
        });
      }

      // 3. Grant HOD role (idempotent)
      const exists = await tx.userRole.findUnique({
        where: {
          userId_roleId: { userId: newHeadUserId, roleId: hodRole.id },
        },
      });
      if (!exists) {
        await tx.userRole.create({
          data: { userId: newHeadUserId, roleId: hodRole.id },
        });
      }

      // 4. Revoke HOD from previous holder
      if (previousHeadId && previousHeadId !== newHeadUserId) {
        await tx.userRole.deleteMany({
          where: { userId: previousHeadId, roleId: hodRole.id },
        });
      }
    });

    await this.audit.logFromRequest(req, {
      actorId: actor.id,
      actorEmail: actor.email,
      municipalityId,
      action: 'tenant.department.transfer_head',
      resourceType: 'Department',
      resourceId: departmentId,
      metadata: {
        departmentName: dept.name,
        newHeadId: newHeadUserId,
        newHeadEmail: newHead.email,
        previousHeadId,
      },
    });

    return { ok: true, newHeadEmail: newHead.email };
  }

  /**
   * Clear the Head of Department slot. Revokes the HOD role from the current
   * holder and leaves the slot vacant. UI will show a warning banner.
   */
  async vacateHead(
    departmentId: string,
    municipalityId: string,
    actor: { id: string; email: string },
    req?: Request,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (!dept.headUserId) {
      return { ok: true, alreadyVacant: true };
    }

    const hodRole = await this.prisma.role.findFirst({
      where: { municipalityId, name: 'Head of Department', deletedAt: null },
    });

    const previousHeadId = dept.headUserId;
    await this.prisma.$transaction([
      this.prisma.department.update({
        where: { id: departmentId },
        data: { headUserId: null },
      }),
      ...(hodRole
        ? [
            this.prisma.userRole.deleteMany({
              where: { userId: previousHeadId, roleId: hodRole.id },
            }),
          ]
        : []),
    ]);

    await this.audit.logFromRequest(req, {
      actorId: actor.id,
      actorEmail: actor.email,
      municipalityId,
      action: 'tenant.department.vacate_head',
      resourceType: 'Department',
      resourceId: departmentId,
      metadata: { departmentName: dept.name, previousHeadId },
    });

    return { ok: true };
  }

  /**
   * List the staff members of a department (excludes self-registered citizens).
   * The Head of Department appears in the list and is flagged with `isHead: true`.
   */
  async listMembers(departmentId: string, municipalityId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
      select: { id: true, name: true, headUserId: true },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const members = await this.prisma.user.findMany({
      where: staffMemberWhere({
        municipalityId,
        departmentId,
      }),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        userRoles: {
          select: { role: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return {
      department: dept,
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        avatarUrl: m.avatarUrl,
        isActive: m.isActive,
        roles: m.userRoles.map((ur) => ur.role.name),
        isHead: m.id === dept.headUserId,
      })),
    };
  }

  /**
   * Add a member to a department by email.
   * The user must already exist in the same municipality and must NOT be a
   * self-registered citizen. If they belong to another department, that
   * membership is overwritten (a user can only belong to one department).
   */
  async addMemberByEmail(
    departmentId: string,
    municipalityId: string,
    email: string,
    actor: { id: string; email: string },
    req?: Request,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: trimmed, municipalityId },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException(
        `No user with email "${email}" found in this municipality. ` +
          'The user must already be provisioned as a staff member of this municipality.',
      );
    }
    if (isProtectedCitizenAccount(user)) {
      throw new BadRequestException(
        'Citizen accounts cannot be assigned to a department. ' +
          'Create a separate staff account instead.',
      );
    }
    if (!user.isActive) {
      throw new BadRequestException('Target user is inactive');
    }
    if (user.departmentId === departmentId) {
      return { ok: true, alreadyMember: true, userId: user.id, email: user.email };
    }

    // If they currently lead another department, refuse — they need to be
    // vacated as HOD first to keep the slot model consistent.
    const otherHod = await this.prisma.department.findFirst({
      where: { headUserId: user.id, id: { not: departmentId } },
      select: { name: true },
    });
    if (otherHod) {
      throw new BadRequestException(
        `${user.firstName} ${user.lastName} is currently Head of "${otherHod.name}". ` +
          'Vacate that HOD slot before moving them to a different department.',
      );
    }

    const previousDepartmentId = user.departmentId;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { departmentId },
    });

    await this.audit.logFromRequest(req, {
      actorId: actor.id,
      actorEmail: actor.email,
      municipalityId,
      action: 'tenant.department.add_member',
      resourceType: 'Department',
      resourceId: departmentId,
      metadata: {
        departmentName: dept.name,
        userId: user.id,
        userEmail: user.email,
        previousDepartmentId,
      },
    });

    return { ok: true, userId: user.id, email: user.email };
  }

  /**
   * Remove a member from a department. Refuses to remove the current Head of
   * Department — vacate the HOD slot first.
   */
  async removeMember(
    departmentId: string,
    municipalityId: string,
    userId: string,
    actor: { id: string; email: string },
    req?: Request,
  ) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, municipalityId, deletedAt: null },
      select: { id: true, name: true, headUserId: true },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, municipalityId, departmentId },
    });
    if (!user) {
      throw new NotFoundException(
        'User is not a member of this department',
      );
    }

    if (dept.headUserId === userId) {
      throw new BadRequestException(
        'Cannot remove the current Head of Department. ' +
          'Vacate the HOD slot first, then remove the member.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { departmentId: null },
    });

    await this.audit.logFromRequest(req, {
      actorId: actor.id,
      actorEmail: actor.email,
      municipalityId,
      action: 'tenant.department.remove_member',
      resourceType: 'Department',
      resourceId: departmentId,
      metadata: {
        departmentName: dept.name,
        userId,
        userEmail: user.email,
      },
    });

    return { ok: true };
  }
}
