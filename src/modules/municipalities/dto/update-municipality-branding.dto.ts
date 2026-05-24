import { IsOptional, IsString, MaxLength, Matches, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMunicipalityBrandingDto {
  @ApiPropertyOptional({ description: 'Official name in English' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Official name in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Official name in French' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameFr?: string;

  @ApiPropertyOptional({ description: 'Short description in English' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Short description in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Short description in French' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionFr?: string;

  @ApiPropertyOptional({ description: 'Logo image URL (HTTPS)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Banner / institutional header image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerImageUrl?: string;

  @ApiPropertyOptional({ description: 'Hex overlay color applied on top of the banner, e.g. #0f2555' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'bannerOverlayColor must be a valid hex color (e.g. #0f2555)',
  })
  bannerOverlayColor?: string;

  @ApiPropertyOptional({ description: 'Banner overlay opacity (0–1). 0.6 is default.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  bannerOverlayOpacity?: number;

  @ApiPropertyOptional({ description: 'Primary brand color in hex, e.g. #0f2555' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'primaryColor must be a valid hex color (e.g. #0f2555)',
  })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Public support email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'Public phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'WhatsApp / mobile number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsApp?: string;

  @ApiPropertyOptional({ description: 'Office address in English' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Office address in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressAr?: string;

  @ApiPropertyOptional({ description: 'Office address in French' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressFr?: string;

  @ApiPropertyOptional({ description: 'Opening hours in English' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  openingHours?: string;

  @ApiPropertyOptional({ description: 'Opening hours in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  openingHoursAr?: string;

  @ApiPropertyOptional({ description: 'Opening hours in French' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  openingHoursFr?: string;

  @ApiPropertyOptional({ description: 'Official municipality website URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'Latitude for map display' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude for map display' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
