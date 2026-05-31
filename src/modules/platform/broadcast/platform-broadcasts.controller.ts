import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SuperAdminGuard } from '../super-admin.guard';
import { RequirePermissions } from '../../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../../core/rbac/permissions.constants';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../../core/auth/types/jwt-payload';
import { AuditService, AUDIT_ACTIONS } from '../../audit/audit.service';
import { PlatformBroadcastsService } from './platform-broadcasts.service';
import { PlatformBroadcastPreviewDto } from './dto/platform-broadcast-preview.dto';
import { PlatformBroadcastSendDto } from './dto/platform-broadcast-send.dto';
import { PlatformBroadcastQueryDto } from './dto/platform-broadcast-query.dto';

@ApiTags('Platform Broadcasts')
@ApiBearerAuth()
@Controller('platform/notifications/broadcasts')
@UseGuards(SuperAdminGuard)
@RequirePermissions(PERMISSIONS.PLATFORM_SEND_NOTIFICATIONS)
export class PlatformBroadcastsController {
  constructor(
    private readonly broadcastsService: PlatformBroadcastsService,
    private readonly auditService: AuditService,
  ) {}

  @Post('preview')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Preview broadcast recipient count' })
  preview(@Body() dto: PlatformBroadcastPreviewDto) {
    return this.broadcastsService.preview(dto);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Create and send (or schedule) a platform broadcast' })
  async send(
    @Body() dto: PlatformBroadcastSendDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const result = await this.broadcastsService.create(user.id, dto);

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.PLATFORM_BROADCAST_SEND,
      resourceType: 'platform_broadcast',
      resourceId: result.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        audience: dto.audience,
        channels: dto.channels,
        recipientCount: result.recipientCount,
        scheduledAt: result.scheduledAt,
        status: result.status,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
    });

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List platform broadcast history' })
  list(@Query() query: PlatformBroadcastQueryDto) {
    return this.broadcastsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get platform broadcast by id' })
  getOne(@Param('id') id: string) {
    return this.broadcastsService.findOne(id);
  }
}
