import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Permission reference in role response
 */
export class PermissionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'complaint.create' })
  key: string;

  @ApiProperty({ example: 'Create Complaints' })
  name: string;

  @ApiProperty({ example: 'complaints' })
  module: string;
}

/**
 * Role data
 */
export class RoleDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Staff' })
  name: string;

  @ApiPropertyOptional({ example: 'Municipality staff with full complaint management' })
  description?: string;

  @ApiProperty({ example: true, description: 'System roles cannot be deleted' })
  isSystem: boolean;

  @ApiProperty({ type: [PermissionDto] })
  permissions: PermissionDto[];

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

/**
 * Role without permissions (for list view)
 */
export class RoleSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Staff' })
  name: string;

  @ApiPropertyOptional({ example: 'Municipality staff with full complaint management' })
  description?: string;

  @ApiProperty({ example: true })
  isSystem: boolean;

  @ApiProperty({ example: 15, description: 'Number of permissions assigned' })
  permissionCount: number;

  @ApiProperty({ example: 5, description: 'Number of users with this role' })
  userCount: number;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Roles list response
 */
export class RolesListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [RoleSummaryDto] })
  data: RoleSummaryDto[];
}

/**
 * Single role response
 */
export class RoleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: RoleDto })
  data: RoleDto;
}

/**
 * Role deleted response
 */
export class RoleDeleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: { message: 'Role deleted successfully' },
  })
  data: { message: string };
}

/**
 * All permissions list response
 */
export class PermissionsListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [PermissionDto] })
  data: PermissionDto[];
}
