import { IsOptional, IsString, IsNumber, Min, Max, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlatformBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerOverlayColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  bannerOverlayOpacity?: number;

  @ApiPropertyOptional({ description: 'Hero banner horizontal focal point (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bannerFocalX?: number;

  @ApiPropertyOptional({ description: 'Hero banner vertical focal point (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bannerFocalY?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authBackgroundImageUrl?: string;

  @ApiPropertyOptional({ description: 'Auth background horizontal focal point (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  authBackgroundFocalX?: number;

  @ApiPropertyOptional({ description: 'Auth background vertical focal point (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  authBackgroundFocalY?: number;

  @ApiPropertyOptional({ description: 'Auth background overlay opacity (0–1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  authBackgroundOverlayOpacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformNameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformNameFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformDescriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformDescriptionFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorNameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorNameFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportWhatsApp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeAddressAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeAddressFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openingHoursAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openingHoursFr?: string;

  @ApiPropertyOptional({ description: 'Apple App Store listing URL (public landing page)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  appStoreUrl?: string;

  @ApiPropertyOptional({ description: 'Google Play listing URL (public landing page)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  googlePlayUrl?: string;

  @ApiPropertyOptional({
    description: 'Direct Android APK download URL; used for QR code on the public landing page',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  apkUrl?: string;
}
