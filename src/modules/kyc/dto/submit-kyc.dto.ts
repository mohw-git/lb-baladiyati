import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for KYC submission - files are handled via multipart/form-data
 * Fields: idFront, idBack, selfie (all image files)
 */
export class SubmitKycDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Front side of national ID card (JPEG/PNG, max 10MB)',
  })
  idFront: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Back side of national ID card (JPEG/PNG, max 10MB)',
  })
  idBack: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Selfie photo for identity matching (JPEG/PNG, max 10MB). Also used as avatar.',
  })
  selfie: Express.Multer.File;
}
