import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Department data
 */
export class DepartmentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Roads & Infrastructure' })
  name: string;

  @ApiPropertyOptional({ example: 'Handles road maintenance and infrastructure issues' })
  description?: string;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  updatedAt: string;

  @ApiPropertyOptional({
    example: { users: 5, categories: 3 },
    description: 'Count of related entities',
  })
  _count?: {
    users: number;
    categories: number;
  };
}

// ============ Full Response DTOs for Swagger ============

/**
 * Departments list response
 */
export class DepartmentsListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [DepartmentDto] })
  data: DepartmentDto[];
}

/**
 * Single department response
 */
export class DepartmentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: DepartmentDto })
  data: DepartmentDto;
}

/**
 * Message response for operations
 */
export class DepartmentMessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: { message: 'Department deleted successfully' } })
  data: {
    message: string;
  };
}
