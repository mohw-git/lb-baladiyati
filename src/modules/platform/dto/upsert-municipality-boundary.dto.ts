import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpsertMunicipalityBoundaryDto {
  @Allow()
  @ApiProperty({
    description:
      'GeoJSON Polygon, MultiPolygon, Feature, or FeatureCollection (WGS84, coordinates [lng, lat])',
  })
  geojson: unknown;

  @ApiPropertyOptional({ description: 'Buffer distance in meters when point is outside polygon', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  bufferMeters?: number;

  @ApiPropertyOptional({ description: 'Whether routing uses this boundary', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateMunicipalityBoundaryDto {
  @Allow()
  @ApiProperty({ description: 'GeoJSON to validate (not saved)' })
  geojson: unknown;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  bufferMeters?: number;
}
