import { Controller, Get, Patch, Post, Param, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MunicipalitiesService } from './municipalities.service';
import { multerConfig } from '../../core/storage/multer.config';
import {
  MunicipalitiesListResponseDto,
  MunicipalityResponseDto,
} from './dto/municipality-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { UpdateMunicipalityBrandingDto } from './dto/update-municipality-branding.dto';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

@ApiTags('Municipalities')
@Controller('municipalities')
export class MunicipalitiesController {
  constructor(private readonly municipalitiesService: MunicipalitiesService) {}

  /**
   * List all municipalities (public)
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all municipalities (public)',
    description: `Returns all active municipalities. This endpoint is public and does not require authentication.

**Who can use:** Anyone (no authentication required)

**Use case:** Display municipality selection during registration.`,
  })
  @ApiOkResponse({
    description: 'List of municipalities',
    type: MunicipalitiesListResponseDto,
  })
  async findAll() {
    return this.municipalitiesService.findAll();
  }

  /**
   * Current user's municipality (with admin slot info) — used by Departments Overview.
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the caller\'s municipality (with admin slot info)' })
  async findMine(@CurrentUser() user: CurrentUserData) {
    return this.municipalitiesService.findOne(user.municipalityId);
  }

  /**
   * Update branding / multilingual names for the caller's municipality.
   * Municipality admin (Admin role) can update their own; Super Admin can update any.
   */
  @Patch('me/branding')
  @RequirePermissions(PERMISSIONS.MUNICIPALITY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update municipality branding (admin only)' })
  async updateMyBranding(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateMunicipalityBrandingDto,
  ) {
    return this.municipalitiesService.updateBranding(
      user.municipalityId,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      dto,
    );
  }

  /**
   * Super admin: update any municipality's branding.
   */
  @Patch(':id/branding')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update any municipality branding (super admin)' })
  async updateBranding(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateMunicipalityBrandingDto,
  ) {
    return this.municipalitiesService.updateBranding(
      id,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      dto,
    );
  }

  /**
   * Upload logo for the caller's municipality.
   */
  @Post('me/logo')
  @RequirePermissions(PERMISSIONS.MUNICIPALITY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload municipality logo' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadMyLogo(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.municipalitiesService.uploadMunicipalityImage(
      user.municipalityId,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      'logoUrl',
      file,
    );
  }

  /**
   * Upload banner for the caller's municipality.
   */
  @Post('me/banner')
  @RequirePermissions(PERMISSIONS.MUNICIPALITY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload municipality banner' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadMyBanner(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.municipalitiesService.uploadMunicipalityImage(
      user.municipalityId,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      'bannerImageUrl',
      file,
    );
  }

  /**
   * Super admin: upload any municipality's logo.
   */
  @Post(':id/logo')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload any municipality logo (super admin)' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadLogo(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.municipalitiesService.uploadMunicipalityImage(
      id,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      'logoUrl',
      file,
    );
  }

  /**
   * Super admin: upload any municipality's banner.
   */
  @Post(':id/banner')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload any municipality banner (super admin)' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadBanner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.municipalitiesService.uploadMunicipalityImage(
      id,
      user.municipalityId,
      (user as any).isSuperAdmin ?? false,
      'bannerImageUrl',
      file,
    );
  }

  /**
   * Public: get municipality profile by code (used by public portal /municipalities/[slug])
   */
  @Get('by-code/:code')
  @Public()
  @ApiOperation({ summary: 'Get municipality public profile by code (public)' })
  async findByCode(@Param('code') code: string) {
    return this.municipalitiesService.findByCode(code);
  }

  /**
   * Get municipality details
   */
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get municipality details',
    description: `Returns details for a specific municipality.

**Who can use:** Authenticated users`,
  })
  @ApiOkResponse({
    description: 'Municipality details',
    type: MunicipalityResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Municipality not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findOne(@Param('id') id: string) {
    return this.municipalitiesService.findOne(id);
  }
}
