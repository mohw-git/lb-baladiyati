import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Department reference in category
 */
export class DepartmentRefDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Roads & Infrastructure' })
  name: string;
}

/**
 * Category data
 */
export class CategoryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Potholes' })
  name: string;

  @ApiPropertyOptional({ example: 'pothole-icon' })
  icon?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: DepartmentRefDto })
  department?: DepartmentRefDto;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({
    example: { complaints: 15 },
    description: 'Count of complaints in this category',
  })
  _count?: {
    complaints: number;
  };
}

// ============ Full Response DTOs for Swagger ============

/**
 * Categories list response
 */
export class CategoriesListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [CategoryDto] })
  data: CategoryDto[];
}

/**
 * Single category response
 */
export class CategoryResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: CategoryDto })
  data: CategoryDto;
}

/**
 * Message response
 */
export class CategoryMessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: { message: 'Category deactivated successfully' } })
  data: {
    message: string;
  };
}
