import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewKycDto {
  @ApiProperty({
    enum: ReviewAction,
    description: 'Review decision',
    example: ReviewAction.APPROVE,
  })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiPropertyOptional({
    description: 'Reason for rejection (required when rejecting)',
    example: 'ID photo is blurry, please resubmit with a clearer image',
  })
  @ValidateIf((o) => o.action === ReviewAction.REJECT)
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @IsOptional()
  reason?: string;
}
