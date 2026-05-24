import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

export class NewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by published status', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ description: 'Municipality ID (for public/unauthenticated access)' })
  @IsOptional()
  @IsString()
  municipalityId?: string;
}
