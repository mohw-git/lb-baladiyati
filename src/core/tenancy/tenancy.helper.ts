/**
 * Helper for municipality (tenant) scoping.
 * municipalityId is extracted from JWT payload via CurrentUser decorator.
 *
 * Usage in services:
 * - Always include municipalityId in where clauses
 * - Use ensureTenantAccess() to verify resource belongs to tenant
 */

import { ForbiddenException } from '@nestjs/common';

export function ensureTenantAccess(
  resourceMunicipalityId: string | null | undefined,
  userMunicipalityId: string,
): void {
  if (resourceMunicipalityId !== userMunicipalityId) {
    throw new ForbiddenException('Access denied to this resource');
  }
}

export function tenantWhere(municipalityId: string) {
  return { municipalityId };
}
