import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from './super-admin.guard';
import { PlatformAnnouncementsService } from './platform-announcements.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CreatePlatformAnnouncementDto } from './dto/create-platform-announcement.dto';
import { UpdatePlatformAnnouncementDto } from './dto/update-platform-announcement.dto';
import {
  PlatformAnnouncementPublicQueryDto,
  PlatformAnnouncementQueryDto,
} from './dto/platform-announcement-query.dto';
import { imageOnlyMulterConfig } from '../../core/storage/multer.config';

const MANAGE_PERMS = [
  PERMISSIONS.PLATFORM_MANAGE_ANNOUNCEMENTS,
  PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES,
];

@ApiTags('Platform Announcements')
@Controller('platform/announcements')
export class PlatformAnnouncementsController {
  constructor(
    private readonly announcementsService: PlatformAnnouncementsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('public')
  @Public()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List published platform announcements (public)' })
  async listPublic(@Query() query: PlatformAnnouncementPublicQueryDto) {
    return this.announcementsService.findPublic(query);
  }

  @Get('public/:id')
  @Public()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get published platform announcement (public)' })
  async getPublic(@Param('id') id: string) {
    return this.announcementsService.findPublicOne(id);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'List all platform announcements (super admin)' })
  async listAdmin(@Query() query: PlatformAnnouncementQueryDto) {
    return this.announcementsService.findAdmin(query);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Get platform announcement (super admin)' })
  async getAdmin(@Param('id') id: string) {
    return this.announcementsService.findAdminOne(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Create platform announcement draft' })
  async create(
    @Body() dto: CreatePlatformAnnouncementDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.announcementsService.create(user.id, dto);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_CREATED',
      metadata: { announcementId: result.id, title: result.title },
    });
    return result;
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Update platform announcement' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformAnnouncementDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.announcementsService.update(id, dto);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_UPDATED',
      metadata: { announcementId: id, fields: Object.keys(dto) },
    });
    return result;
  }

  @Post(':id/publish')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Publish platform announcement' })
  async publish(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const result = await this.announcementsService.publish(id);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_PUBLISHED',
      metadata: { announcementId: id },
    });
    return result;
  }

  @Post(':id/unpublish')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Unpublish platform announcement (back to draft)' })
  async unpublish(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const result = await this.announcementsService.unpublish(id);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_UNPUBLISHED',
      metadata: { announcementId: id },
    });
    return result;
  }

  @Post(':id/archive')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiOperation({ summary: 'Archive platform announcement' })
  async archive(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const result = await this.announcementsService.archive(id);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_ARCHIVED',
      metadata: { announcementId: id },
    });
    return result;
  }

  @Post(':id/image')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(SuperAdminGuard)
  @RequirePermissions(...MANAGE_PERMS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload announcement image' })
  @UseInterceptors(FileInterceptor('image', imageOnlyMulterConfig))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.announcementsService.uploadImage(id, file);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_ANNOUNCEMENT_IMAGE_UPLOADED',
      metadata: { announcementId: id },
    });
    return result;
  }
}
