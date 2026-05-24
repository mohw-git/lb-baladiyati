import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { VerificationStatus } from '@prisma/client';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

export class KycQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: 'Filter by verification status',
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
