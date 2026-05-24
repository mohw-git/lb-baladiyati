import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { multerConfig } from '../../core/storage/multer.config';
import { SuperAdminGuard } from './super-admin.guard';
import { Request } from 'express';
import { PlatformService } from './platform.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { UpdatePlatformBrandingDto } from './dto/update-platform-branding.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { MailService } from '../../core/mail/mail.service';
import { TestEmailDto } from './dto/test-email.dto';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Platform (Super Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  // ============================================================
  // MUNICIPALITIES
  // ============================================================

  @Get('municipalities')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'List all municipalities (incl. inactive)' })
  async listMunicipalities(@Query('includeInactive') includeInactive?: string) {
    return this.platformService.listMunicipalities(includeInactive === 'true');
  }

  @Get('municipalities/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Get municipality details' })
  async getMunicipality(@Param('id') id: string) {
    return this.platformService.getMunicipality(id);
  }

  @Post('municipalities')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary: 'Create a new municipality',
    description:
      'Creates a municipality and bootstraps it with standard roles, default departments, and a first admin user.',
  })
  async createMunicipality(
    @Body() dto: CreateMunicipalityDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.createMunicipality(dto, user.id, user.email);
  }

  @Patch('municipalities/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Update or deactivate a municipality' })
  async updateMunicipality(
    @Param('id') id: string,
    @Body() dto: UpdateMunicipalityDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.updateMunicipality(id, dto, user.id, user.email);
  }

  // ============================================================
  // USERS
  // ============================================================

  @Get('users')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({ summary: 'List all users across all municipalities' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('municipalityId') municipalityId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.platformService.listAllUsers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      municipalityId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Patch('users/:id/active')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({ summary: 'Activate or deactivate a user (any municipality)' })
  async setUserActive(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.setUserActive(id, isActive, user.id, user.email);
  }

  @Post('users/:id/impersonate')
  @RequirePermissions(PERMISSIONS.PLATFORM_IMPERSONATE)
  @ApiOperation({
    summary: 'Impersonate a user (issue 15-min access token, no refresh)',
  })
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.platformService.impersonate(id, user.id, user.email, ip, ua);
  }

  @Post('users/:id/reset-password')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({ summary: 'Force-reset a user password (kicks them out of all sessions)' })
  async resetUserPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.resetUserPassword(id, newPassword, user.id, user.email);
  }

  @Post('users/:id/reset-2fa')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({ summary: 'Force-disable 2FA for a user (lost authenticator)' })
  async resetUser2FA(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.resetUser2FA(id, user.id, user.email);
  }

  @Post('users/:id/force-logout')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({ summary: 'Force-logout a user from all devices' })
  async forceLogout(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.forceLogout(id, user.id, user.email);
  }

  @Delete('users/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_USERS)
  @ApiOperation({
    summary: 'Permanently delete a user (refuses if user has authored data)',
  })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.deleteUser(id, user.id, user.email);
  }

  @Post('municipalities/:id/transfer-admin')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary: 'Transfer (or grant) the Admin role on a municipality to another user',
  })
  async transferMunicipalityAdmin(
    @Param('id') municipalityId: string,
    @Body('newAdminUserId') newAdminUserId: string | undefined,
    @Body('newAdminEmail') newAdminEmail: string | undefined,
    @Body('revokePrevious') revokePrevious: boolean | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.transferMunicipalityAdmin(
      municipalityId,
      { newAdminUserId, newAdminEmail },
      user.id,
      user.email,
      { revokePrevious: !!revokePrevious },
    );
  }

  @Delete('municipalities/:id/admin')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary: 'Vacate the municipality Admin slot (revokes Admin role from current holder)',
  })
  async vacateMunicipalityAdmin(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.vacateMunicipalityAdmin(id, user.id, user.email);
  }

  // ============================================================
  // PLATFORM SETTINGS — maintenance mode etc.
  // ============================================================

  @Get('settings')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_ALL)
  @ApiOperation({ summary: 'List all platform settings' })
  async listSettings() {
    return this.platformService.listSettings();
  }

  @Get('maintenance')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_ALL)
  @ApiOperation({ summary: 'Read maintenance-mode status' })
  async getMaintenance() {
    return this.platformService.getMaintenanceMode();
  }

  @Put('maintenance')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary:
      'Toggle maintenance mode (when on, all non-super-admin requests get HTTP 503)',
  })
  async setMaintenance(
    @Body('enabled', ParseBoolPipe) enabled: boolean,
    @Body('message') message: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.setMaintenanceMode(
      enabled,
      message,
      user.id,
      user.email,
    );
  }

  @Get('require-2fa')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_ALL)
  @ApiOperation({ summary: 'Read the platform-wide require-2FA-for-staff flag' })
  async getRequireTwoFactor() {
    const enabled = await this.platformService.getRequireTwoFactorForStaff();
    return { enabled };
  }

  @Put('require-2fa')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary:
      'Toggle the platform-wide require-2FA-for-staff flag — when on, all staff accounts must enrol in 2FA before they can use the app',
  })
  async setRequireTwoFactor(
    @Body('enabled', ParseBoolPipe) enabled: boolean,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.setRequireTwoFactorForStaff(
      enabled,
      user.id,
      user.email,
    );
  }

  @Get('require-email-verification')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_ALL)
  @ApiOperation({
    summary: 'Read the platform-wide require-email-verification flag',
  })
  async getRequireEmailVerification() {
    const enabled = await this.platformService.getRequireEmailVerification();
    return { enabled };
  }

  @Put('require-email-verification')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary:
      'Toggle the platform-wide require-email-verification flag — when on, /auth/login refuses to issue access tokens until the user has verified their email address',
  })
  async setRequireEmailVerification(
    @Body('enabled', ParseBoolPipe) enabled: boolean,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.setRequireEmailVerification(
      enabled,
      user.id,
      user.email,
    );
  }

  @Get('allow-unverified-citizen-complaints')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_ALL)
  @ApiOperation({
    summary: 'Read whether unverified citizens may submit complaints (risk-marked, LOW priority)',
  })
  async getAllowUnverifiedCitizenComplaints() {
    const enabled =
      await this.platformService.getAllowUnverifiedCitizenComplaints();
    return { enabled };
  }

  @Put('allow-unverified-citizen-complaints')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary:
      'Toggle allowing unverified citizens to submit complaints (internally risk-marked, LOW priority only)',
  })
  async setAllowUnverifiedCitizenComplaints(
    @Body('enabled', ParseBoolPipe) enabled: boolean,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.platformService.setAllowUnverifiedCitizenComplaints(
      enabled,
      user.id,
      user.email,
    );
  }

  // ============================================================
  // STATS
  // ============================================================

  @Get('stats')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_STATS)
  @ApiOperation({ summary: 'Cross-municipality platform statistics' })
  async stats() {
    return this.platformService.getPlatformStats();
  }

  // ============================================================
  // AUDIT LOG
  // ============================================================

  @Get('audit')
  @RequirePermissions(PERMISSIONS.PLATFORM_VIEW_AUDIT)
  @ApiOperation({ summary: 'Query system audit log' })
  async auditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('actorId') actorId?: string,
    @Query('municipalityId') municipalityId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.query({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      actorId,
      municipalityId,
      action,
      resourceType,
      resourceId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  // ============================================================
  // PLATFORM BRANDING
  // ============================================================

  /**
   * Public endpoint — no auth required — returns platform branding for the
   * public portal (homepage, login page, footer, contact section).
   */
  @Get('branding')
  @Public()
  @ApiOperation({ summary: 'Get platform branding (public)' })
  async getPlatformBranding() {
    return this.platformService.getPlatformBranding();
  }

  @Put('branding')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Update platform branding (super admin)' })
  async updatePlatformBranding(
    @Body() dto: UpdatePlatformBrandingDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.platformService.updatePlatformBranding(dto);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_BRANDING_UPDATED',
      metadata: { fields: Object.keys(dto) },
    });
    return result;
  }

  @Post('branding/logo')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload platform logo (super admin)' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadPlatformLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.platformService.uploadPlatformBrandingImage('logoUrl', file);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_BRANDING_LOGO_UPLOADED',
    });
    return result;
  }

  @Post('branding/banner')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload platform banner (super admin)' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadPlatformBanner(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.platformService.uploadPlatformBrandingImage('bannerImageUrl', file);
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PLATFORM_BRANDING_BANNER_UPLOADED',
    });
    return result;
  }

  // ============================================================
  // MAIL DIAGNOSTICS (super admin only)
  // ============================================================
  /**
   * Send a one-off test email through the MailService. Useful for
   * verifying Resend domain/DKIM/SPF configuration WITHOUT creating
   * a real user account. Returns the structured send result, including
   * the Resend message id, so operators can correlate with the Resend
   * dashboard.
   *
   * Guarded by SuperAdminGuard (the @UseGuards on the controller).
   */
  @Post('test-email')
  @ApiOperation({
    summary: 'Send a diagnostic test email (super admin)',
    description:
      'Sends the email-verification template to an arbitrary address through the configured mail provider. ' +
      'Returns the structured delivery result (provider, providerId, delivered, error).',
  })
  async sendTestEmail(
    @Body() dto: TestEmailDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!dto?.to) {
      throw new BadRequestException('to is required');
    }
    const locale = (dto.locale ?? 'EN') as 'EN' | 'AR' | 'FR';
    const verifyUrl =
      (process.env.APP_PUBLIC_URL ?? 'https://lb-baladiyati.com').replace(/\/$/, '') +
      '/verify-email?token=test-diagnostic';
    const tpl = this.mailService.emailVerification(locale, {
      verifyUrl,
      expiresInMinutes: 60,
      firstName: 'Operator',
    });
    const subject = `[TEST] ${tpl.subject}`;
    const result = await this.mailService.send({
      to: dto.to,
      event: 'test_email',
      subject,
      text: tpl.text,
      html: tpl.html,
    });

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'platform.mail.test_send',
      metadata: {
        delivered: result.delivered,
        provider: result.provider,
        providerId: result.providerId,
        reason: result.error,
      },
    });

    return result;
  }
}
