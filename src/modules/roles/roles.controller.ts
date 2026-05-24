import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import {
  RolesListResponseDto,
  RoleResponseDto,
  RoleDeleteResponseDto,
  PermissionsListResponseDto,
} from './dto/role-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { WebOnly } from '../../core/auth/decorators/web-only.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@WebOnly()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * List all available permissions
   */
  @Get('permissions')
  @ApiOperation({
    summary: 'List all permissions',
    description: `Returns all available permissions that can be assigned to roles. Use this to populate the permission selection UI.
    
**Required Permission:** \`role.view\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'List of all permissions',
    type: PermissionsListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_VIEW)
  async findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  /**
   * List all roles for the municipality
   */
  @Get()
  @ApiOperation({
    summary: 'List all roles',
    description: `Returns all roles in the municipality with their permission counts.
    
**Required Permission:** \`role.view\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'List of roles',
    type: RolesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden - missing role.view permission', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_VIEW)
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.rolesService.findAll(user.municipalityId);
  }

  /**
   * Get role details with permissions
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get role details',
    description: `Returns role details including all assigned permissions.
    
**Required Permission:** \`role.view\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'Role details with permissions',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.rolesService.findOne(id, user.municipalityId);
  }

  /**
   * Create a new custom role
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new role',
    description: `Creates a custom role for the municipality. System roles (Citizen, Worker, Staff, Admin) are created automatically.
    
**Required Permission:** \`role.create\`
**Who can use:** Admin only

**Note:** After creating a role, use PUT /roles/:id/permissions to assign permissions.`,
  })
  @ApiCreatedResponse({
    description: 'Role created successfully',
    type: RoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error or role name already exists', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_CREATE)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(user.municipalityId, dto, user.id);
  }

  /**
   * Update role name/description
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update role',
    description: `Updates role name or description. Cannot update system roles.
    
**Required Permission:** \`role.update\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'Role updated successfully',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot update system role', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_UPDATE)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, user.municipalityId, dto, user.id);
  }

  /**
   * Set permissions for a role
   */
  @Put(':id/permissions')
  @ApiOperation({
    summary: 'Set role permissions',
    description: `Replaces all permissions for a role. Pass an array of permission IDs.
    
**Required Permission:** \`role.manage_permissions\`
**Who can use:** Admin only

**Important:** This replaces all existing permissions. To keep existing permissions, include them in the request.`,
  })
  @ApiOkResponse({
    description: 'Permissions updated successfully',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid permission IDs', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE_PERMISSIONS)
  async setPermissions(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.rolesService.setPermissions(
      id,
      user.municipalityId,
      dto.permissionIds,
      user.id,
    );
  }

  /**
   * Delete a custom role (soft delete)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete role',
    description: `Soft deletes a custom role. Cannot delete system roles.
    
**Required Permission:** \`role.delete\`
**Who can use:** Admin only

**Warning:** Users with only this role will lose their permissions.`,
  })
  @ApiOkResponse({
    description: 'Role deleted successfully',
    type: RoleDeleteResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot delete system role', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.ROLE_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.rolesService.remove(id, user.municipalityId, user.id);
  }
}
