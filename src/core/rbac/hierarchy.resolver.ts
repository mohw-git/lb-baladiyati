import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Discord-style role hierarchy.
 *
 * Each role has a numeric `priority`. A user's *effective rank* is the maximum
 * priority across all the roles they hold. Multiple roles may share a level.
 *
 * Policy (composes on top of RBAC permission checks — both must pass):
 *   - You can only assign / remove a role with `priority < yourRank`.
 *   - You can only manage another user (edit, delete, change roles, etc.) when
 *     their effective rank is strictly below yours. Editing yourself is always allowed.
 *   - You can only edit a role with `priority < yourRank`, and you cannot set its
 *     priority to a value `>= yourRank`.
 *   - Super Admin bypasses all of these checks (handled via `isSuperAdmin`).
 *
 * Rank `-Infinity` means "no roles at all" (e.g. a freshly self-registered citizen
 * before role assignment is run); we expose this as `Number.NEGATIVE_INFINITY`.
 */
@Injectable()
export class HierarchyResolver {
  constructor(private prisma: PrismaService) {}

  /**
   * Maximum role priority across this user's active roles.
   * Returns Number.NEGATIVE_INFINITY for users with no roles.
   * Returns Number.POSITIVE_INFINITY for super admins.
   */
  async getEffectiveRank(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user) return Number.NEGATIVE_INFINITY;
    if (user.isSuperAdmin) return Number.POSITIVE_INFINITY;

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { priority: true, deletedAt: true },
        },
      },
    });

    let max = Number.NEGATIVE_INFINITY;
    for (const ur of userRoles) {
      if (ur.role.deletedAt) continue;
      if ((ur.role.priority ?? 0) > max) {
        max = ur.role.priority ?? 0;
      }
    }
    return max;
  }

  /** Returns true iff actor's rank is strictly greater than target user's rank. */
  async canManageUser(actorId: string, targetUserId: string): Promise<boolean> {
    if (actorId === targetUserId) return true;
    const [actorRank, targetRank] = await Promise.all([
      this.getEffectiveRank(actorId),
      this.getEffectiveRank(targetUserId),
    ]);
    return actorRank > targetRank;
  }

  async assertCanManageUser(actorId: string, targetUserId: string): Promise<void> {
    const ok = await this.canManageUser(actorId, targetUserId);
    if (!ok) {
      throw new ForbiddenException(
        'You cannot manage a user with the same or higher role priority than your own.',
      );
    }
  }

  /** Returns true iff actor can grant or revoke `roleId` (its priority is strictly below actor's rank). */
  async canManageRole(actorId: string, roleId: string): Promise<boolean> {
    const [actorRank, role] = await Promise.all([
      this.getEffectiveRank(actorId),
      this.prisma.role.findUnique({
        where: { id: roleId },
        select: { priority: true },
      }),
    ]);
    if (!role) return false;
    return actorRank > (role.priority ?? 0);
  }

  async assertCanManageRole(actorId: string, roleId: string): Promise<void> {
    const ok = await this.canManageRole(actorId, roleId);
    if (!ok) {
      throw new ForbiddenException(
        'You cannot manage a role with the same or higher priority than your own.',
      );
    }
  }

  /** Returns true iff actor can set / change a role's priority to `targetPriority`. */
  async canSetPriority(actorId: string, targetPriority: number): Promise<boolean> {
    const actorRank = await this.getEffectiveRank(actorId);
    return targetPriority < actorRank;
  }

  async assertCanSetPriority(actorId: string, targetPriority: number): Promise<void> {
    if (!(await this.canSetPriority(actorId, targetPriority))) {
      throw new ForbiddenException(
        'You cannot create or set a role with priority greater than or equal to your own.',
      );
    }
  }
}
