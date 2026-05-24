import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttachmentStage } from '@prisma/client';

export class UploadAttachmentDto {
  @ApiProperty({ enum: AttachmentStage, example: 'INITIAL', description: 'Attachment stage (INITIAL or PROOF)' })
  @IsEnum(AttachmentStage)
  stage: AttachmentStage;
}
