import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformBroadcastStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../../core/common/dto/pagination.dto';

export class PlatformBroadcastQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PlatformBroadcastStatus })
  @IsOptional()
  @IsEnum(PlatformBroadcastStatus)
  status?: PlatformBroadcastStatus;
}
