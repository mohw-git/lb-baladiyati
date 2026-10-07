import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformBroadcastAudience, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  isProtectedCitizenAccount,
  type UserGovernanceSnapshot,
} from '../../../core/users/user-governance';

export type PlatformBroadcastAudienceConfig = {
  municipalityIds?: string[];
  roleIds?: string[];
  userIds?: string[];
};

const userSelect = {
  id: true,
  municipalityId: true,
  createdVia: true,
  isSuperAdmin: true,
  userRoles: {
    select: {
      role: { select: { name: true, isSystemManaged: true } },
    },
  },
} as const;

@Injectable()
export class PlatformBroadcastAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve active recipients grouped by municipality (required for createAndSend).
   * Super admins and users without a municipality are excluded.
   */
  async resolveRecipientsByMunicipality(
    audience: PlatformBroadcastAudience,
    config?: PlatformBroadcastAudienceConfig | null,
  ): Promise<Map<string, string[]>> {
    const users = await this.findUsers(audience, config);
    const grouped = new Map<string, string[]>();

    for (const user of users) {
      if (!user.municipalityId) continue;
      const list = grouped.get(user.municipalityId) ?? [];
      list.push(user.id);
      grouped.set(user.municipalityId, list);
    }

    for (const [muniId, ids] of grouped) {
      grouped.set(muniId, Array.from(new Set(ids)));
    }

    return grouped;
  }

  async countRecipients(
    audience: PlatformBroadcastAudience,
    config?: PlatformBroadcastAudienceConfig | null,
  ): Promise<number> {
    const grouped = await this.resolveRecipientsByMunicipality(audience, config);
    let total = 0;
    for (const ids of grouped.values()) {
      total += ids.length;
    }
    return total;
  }

  private async findUsers(
    audience: PlatformBroadcastAudience,
    config?: PlatformBroadcastAudienceConfig | null,
  ) {
    const baseWhere: Prisma.UserWhereInput = {
      isActive: true,
      isSuperAdmin: false,
      municipalityId: { not: null },
    };

    switch (audience) {
      case PlatformBroadcastAudience.ALL_USERS:
        return this.prisma.user.findMany({ where: baseWhere, select: userSelect });

      case PlatformBroadcastAudience.CITIZENS: {
        const users = await this.prisma.user.findMany({ where: baseWhere, select: userSelect });
        return users.filter((u) =>
          isProtectedCitizenAccount(u as UserGovernanceSnapshot),
        );
      }

      case PlatformBroadcastAudience.STAFF: {
        const users = await this.prisma.user.findMany({ where: baseWhere, select: userSelect });
        return users.filter(
          (u) => !isProtectedCitizenAccount(u as UserGovernanceSnapshot),
        );
      }

      case PlatformBroadcastAudience.MUNICIPALITIES: {
        const municipalityIds = config?.municipalityIds?.filter(Boolean) ?? [];
        if (!municipalityIds.length) {
          throw new BadRequestException('municipalityIds is required for MUNICIPALITIES audience');
        }
        return this.prisma.user.findMany({
          where: { ...baseWhere, municipalityId: { in: municipalityIds } },
          select: userSelect,
        });
      }

      case PlatformBroadcastAudience.ROLES: {
        const roleIds = config?.roleIds?.filter(Boolean) ?? [];
        if (!roleIds.length) {
          throw new BadRequestException('roleIds is required for ROLES audience');
        }
        return this.prisma.user.findMany({
          where: {
            ...baseWhere,
            userRoles: { some: { roleId: { in: roleIds } } },
          },
          select: userSelect,
        });
      }

      case PlatformBroadcastAudience.USERS: {
        const userIds = config?.userIds?.filter(Boolean) ?? [];
        if (!userIds.length) {
          throw new BadRequestException('userIds is required for USERS audience');
        }
        return this.prisma.user.findMany({
          where: { ...baseWhere, id: { in: userIds } },
          select: userSelect,
        });
      }

      default:
        throw new BadRequestException(`Unknown audience: ${audience}`);
    }
  }
}
