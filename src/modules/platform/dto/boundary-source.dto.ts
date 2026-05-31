import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateBoundarySourceImportDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  validOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;
}

export class BoundarySourceFeatureInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  featureKey: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  adm3Name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  adm3Name1?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  adm3Pcode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  adm2Name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  adm1Name: string;

  @ApiPropertyOptional()
  @IsOptional()
  areaSqkm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  centerLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  centerLon?: number;

  @Allow()
  @ApiProperty({ description: 'Polygon or MultiPolygon GeoJSON geometry' })
  geometry: unknown;
}

export class BulkBoundarySourceFeaturesDto {
  @ApiProperty({ type: [BoundarySourceFeatureInputDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BoundarySourceFeatureInputDto)
  features: BoundarySourceFeatureInputDto[];
}

export class UpdateBoundaryAssignmentsDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ enum: ['assign', 'unassign'] })
  @IsIn(['assign', 'unassign'])
  mode: 'assign' | 'unassign';

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  featureIds: string[];

  @ApiPropertyOptional({
    description: 'Required when assigning to a municipality with MANUAL_GEOJSON boundary',
  })
  @IsOptional()
  @IsBoolean()
  switchToSourceBased?: boolean;

  @ApiPropertyOptional({ description: 'Allow reassigning features from other municipalities' })
  @IsOptional()
  @IsBoolean()
  forceReassign?: boolean;

  @ApiPropertyOptional({ description: 'Save despite overlap warnings from validate' })
  @IsOptional()
  @IsBoolean()
  confirmOverlap?: boolean;
}

export class UpdateMunicipalityBoundaryColorDto {
  @ApiProperty({ example: '#2563eb' })
  @IsString()
  @MaxLength(16)
  boundaryColor: string;
}
