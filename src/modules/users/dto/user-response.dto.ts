import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../core/common/dto/pagination.dto';

/**
 * Role reference in user response
 */
export class RoleRefDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Admin' })
  name: string;
}

/**
 * Department reference in user response
 */
export class DepartmentRefDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Roads & Infrastructure' })
  name: string;
}

/**
 * User data
 */
export class UserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: '+961123456' })
  phone?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: DepartmentRefDto })
  department?: DepartmentRefDto;

  @ApiProperty({ type: [RoleRefDto] })
  roles: RoleRefDto[];

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Paginated users list response
 */
export class UsersListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [UserDto] })
  data: UserDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Single user response
 */
export class UserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UserDto })
  data: UserDto;
}

/**
 * User role assignment response
 */
export class UserRoleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: {
      message: 'Role assigned successfully',
      userId: '550e8400-...',
      roleId: '550e8400-...',
    },
  })
  data: {
    message: string;
    userId: string;
    roleId: string;
  };
}
