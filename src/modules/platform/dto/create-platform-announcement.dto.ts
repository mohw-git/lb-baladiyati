import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlatformAnnouncementDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsString()
  titleFr?: string;

  @IsString()
  @MinLength(1)
  summary: string;

  @IsOptional()
  @IsString()
  summaryAr?: string;

  @IsOptional()
  @IsString()
  summaryFr?: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  contentAr?: string;

  @IsOptional()
  @IsString()
  contentFr?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
