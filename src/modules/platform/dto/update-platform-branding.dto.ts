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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appStoreUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googlePlayUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apkUrl?: string;
}
