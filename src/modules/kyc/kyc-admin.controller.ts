import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { VerificationStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { KycService } from './kyc.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { KycQueryDto } from './dto/kyc-query.dto';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import {
  KycListResponseDto,
  KycDetailResponseDto,
} from './dto/kyc-response.dto';

class ManualKycOverrideDto {
  @IsEnum([VerificationStatus.VERIFIED, VerificationStatus.UNVERIFIED] as any)
  status!: VerificationStatus;

  @IsString()
  @MinLength(5)
  reason!: string;
}

@ApiTags('KYC - Admin/Verifier')
@Controller('admin/kyc')
export class KycAdminController {
  constructor(private readonly kycService: KycService) {}

  /**
   * List all KYC submissions (paginated, filterable)
   */
  @Get()
  @RequirePermissions(PERMISSIONS.KYC_VIEW_ALL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List KYC submissions',
    description:
      'Paginated list of KYC submissions scoped to the reviewer\'s municipality. ' +
      'Filter by status (PENDING, VERIFIED, REJECTED).',
  })
  @ApiOkResponse({ description: 'List of KYC submissions', type: KycListResponseDto })
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: KycQueryDto,
  ) {
    return this.kycService.findAll(user.municipalityId, query);
  }

  /**
   * Get single KYC submission detail with full audit log
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.KYC_VIEW_ALL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get KYC submission detail',
    description: 'Returns full submission detail including attachments and review audit log.',
  })
  @ApiParam({ name: 'id', description: 'KYC submission ID' })
  @ApiOkResponse({ description: 'KYC submission detail', type: KycDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Submission not found', type: ApiErrorResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.kycService.findOne(id, user.municipalityId);
  }

  /**
   * Approve or reject a KYC submission
   */
  @Post(':id/review')
  @RequirePermissions(PERMISSIONS.KYC_REVIEW)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Review KYC submission',
    description:
      'Approve or reject a pending KYC submission. Rejection requires a reason. ' +
      'Updates user verification status and sends notification.',
  })
  @ApiParam({ name: 'id', description: 'KYC submission ID' })
  @ApiOkResponse({ description: 'Review processed', type: KycDetailResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error or invalid state', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Submission not found', type: ApiErrorResponseDto })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.review(
      id,
      user.id,
      user.municipalityId,
      dto.action,
      dto.reason,
    );
  }

  /**
   * Securely stream a KYC attachment file (not publicly accessible)
   */
  @Get(':submissionId/attachments/:attachmentId')
  @RequirePermissions(PERMISSIONS.KYC_VIEW_ALL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Download KYC attachment',
    description:
      'Securely streams a KYC document file. Files are NOT publicly accessible; ' +
      'this authenticated endpoint is the only way to view them.',
  })
  @ApiParam({ name: 'submissionId', description: 'KYC submission ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiOkResponse({ description: 'File stream', content: { 'image/*': {} } })
  @ApiNotFoundResponse({ description: 'File not found', type: ApiErrorResponseDto })
  async getAttachment(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const { filePath, mimeType, filename } = await this.kycService.getAttachmentPath(
      submissionId,
      attachmentId,
      user.municipalityId,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.sendFile(filePath);
  }

  /**
   * Manually override a user's KYC verification status.
   * Power-user tool for walk-in verifications, mistakes, or test flows.
   * Defined as a separate route below the attachment route. Note: the route segment
   * 'users' avoids conflict with the :id (UUID) path because UUIDs never start with 'users'.
   */
  @Post('users/:userId/manual-override')
  @RequirePermissions(PERMISSIONS.KYC_REVIEW)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Manually set a user\'s verification status',
    description:
      'Bypass the document submission flow and directly mark a user as VERIFIED or UNVERIFIED. ' +
      'Requires a reason for the audit trail. Auto-resolves any pending submission.',
  })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  @ApiOkResponse({ description: 'Verification status updated' })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  async manualOverride(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ManualKycOverrideDto,
  ) {
    return this.kycService.manualOverride(
      userId,
      user.id,
      user.municipalityId,
      dto.status,
      dto.reason,
    );
  }
}
