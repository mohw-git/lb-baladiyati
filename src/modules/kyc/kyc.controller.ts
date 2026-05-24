import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import {
  KycSubmitResponseDto,
  KycStatusResponseDto,
} from './dto/kyc-response.dto';

const kycMulterConfig = {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG files are allowed for KYC'), false);
    }
  },
};

@ApiTags('KYC - Citizen')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * Submit KYC documents for identity verification (mobile or web)
   */
  @Post('submit')
  @RequirePermissions(PERMISSIONS.KYC_SUBMIT)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit KYC verification documents',
    description:
      'Upload national ID (front & back) and a selfie for identity verification. ' +
      'Available from both mobile and web. The selfie will become the user avatar. ' +
      'Only one pending submission allowed at a time.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['idFront', 'idBack', 'selfie'],
      properties: {
        idFront: {
          type: 'string',
          format: 'binary',
          description: 'Front of national ID (JPEG/PNG, max 10MB)',
        },
        idBack: {
          type: 'string',
          format: 'binary',
          description: 'Back of national ID (JPEG/PNG, max 10MB)',
        },
        selfie: {
          type: 'string',
          format: 'binary',
          description: 'Selfie photo (JPEG/PNG, max 10MB)',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'KYC submitted successfully', type: KycSubmitResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error or duplicate submission', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Not mobile or not permitted', type: ApiErrorResponseDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      kycMulterConfig,
    ),
  )
  async submit(
    @CurrentUser() user: CurrentUserData,
    @UploadedFiles()
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    return this.kycService.submit(user.id, user.municipalityId, files as any);
  }

  /**
   * Get current user's KYC verification status
   */
  @Get('me')
  @RequirePermissions(PERMISSIONS.KYC_VIEW_OWN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get own KYC verification status',
    description:
      'Returns the current verification status, latest submission details, ' +
      'and rejection reason if applicable.',
  })
  @ApiOkResponse({ description: 'KYC status retrieved', type: KycStatusResponseDto })
  async getMyStatus(@CurrentUser() user: CurrentUserData) {
    return this.kycService.getMyStatus(user.id);
  }
}
