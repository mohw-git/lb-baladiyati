import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RejectionReason } from '@prisma/client';

export class RejectComplaintDto {
  @ApiProperty({
    description: 'Reason for rejection',
    enum: RejectionReason,
    example: 'DUPLICATE',
  })
  @IsEnum(RejectionReason)
  reason: RejectionReason;

  @ApiPropertyOptional({
    description: 'Additional notes explaining the rejection',
    example: 'This complaint duplicates ticket #BEI-240211-001234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
