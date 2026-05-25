import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PlatformAnnouncementStatus } from '@prisma/client';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

export class PlatformAnnouncementQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PlatformAnnouncementStatus)
  status?: PlatformAnnouncementStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  expired?: boolean;
}

export class PlatformAnnouncementPublicQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
