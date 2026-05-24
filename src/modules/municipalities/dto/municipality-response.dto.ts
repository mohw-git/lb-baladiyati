import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Municipality data
 */
export class MunicipalityDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Beirut Municipality' })
  name: string;

  @ApiProperty({ example: 'BEI', description: 'Unique municipality code used in reference codes' })
  code: string;

  @ApiPropertyOptional({ example: '/uploads/municipalities/logo-bei.png' })
  logoUrl?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Municipalities list response
 */
export class MunicipalitiesListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [MunicipalityDto] })
  data: MunicipalityDto[];
}

/**
 * Single municipality response
 */
export class MunicipalityResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: MunicipalityDto })
  data: MunicipalityDto;
}
