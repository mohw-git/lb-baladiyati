import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { WebOnly } from '../../core/auth/decorators/web-only.decorator';
import { toCsv } from '../../core/common/utils/csv';
import { SkipTransform } from '../../core/common/interceptors/transform-response.interceptor';

const MAX_EXPORT_ROWS = 50_000;

function parseDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${v}`);
  }
  return d;
}

/**
 * Tenant-scoped audit log. Results are ALWAYS hard-restricted to the caller's
 * municipality — there is no escape hatch. Super admins use /platform/audit
 * for cross-tenant visibility.
 */
@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@WebOnly()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit events for the caller’s municipality',
    description:
      'Returns paginated audit events filtered to the caller’s municipality. ' +
      'Optional filters: action (substring match), actorId, resourceType, resourceId, from, to.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 'uuid',
              actorId: 'uuid',
              actorEmail: 'admin@beirut.gov.lb',
              action: 'complaint.assign',
              resourceType: 'Complaint',
              resourceId: 'uuid',
              ipAddress: '127.0.0.1',
              userAgent: 'Mozilla/5.0 ...',
              metadata: { reason: 'manual override' },
              createdAt: '2026-05-20T03:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 50, total: 312, totalPages: 7 },
        },
      },
    },
  })
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!user.municipalityId) {
      throw new BadRequestException('User is not bound to a municipality');
    }
    return this.auditService.query({
      municipalityId: user.municipalityId,
      action,
      actorId,
      resourceType,
      resourceId,
      from: parseDate(from),
      to: parseDate(to),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  /**
   * CSV export of the same filtered view. Capped at MAX_EXPORT_ROWS rows to
   * avoid pulling the entire history into memory; if more is needed, narrow
   * the date range.
   */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @SkipTransform()
  @ApiOperation({
    summary: 'Export audit events as CSV',
    description: `Capped at ${MAX_EXPORT_ROWS} rows. Narrow with from/to/action to stay under the cap.`,
  })
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async exportCsv(
    @CurrentUser() user: CurrentUserData,
    @Res({ passthrough: true }) res: Response,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<string> {
    if (!user.municipalityId) {
      throw new BadRequestException('User is not bound to a municipality');
    }
    const { items } = await this.auditService.query({
      municipalityId: user.municipalityId,
      action,
      actorId,
      resourceType,
      resourceId,
      from: parseDate(from),
      to: parseDate(to),
      page: 1,
      limit: MAX_EXPORT_ROWS,
    });

    const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return toCsv(
      ['createdAt', 'action', 'actorEmail', 'resourceType', 'resourceId', 'ipAddress', 'metadata'],
      items.map((row) => ({
        createdAt: row.createdAt.toISOString(),
        action: row.action,
        actorEmail: row.actorEmail ?? '',
        resourceType: row.resourceType ?? '',
        resourceId: row.resourceId ?? '',
        ipAddress: row.ipAddress ?? '',
        metadata: row.metadata ? JSON.stringify(row.metadata) : '',
      })),
    );
  }
}
