import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import {
  UsersListResponseDto,
  UserResponseDto,
  UserRoleResponseDto,
} from './dto/user-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { WebOnly } from '../../core/auth/decorators/web-only.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List all users (staff/workers)
   * 
   * Required permission: user.view_all (Admin only)
   */
  @Get()
  @ApiOperation({
    summary: 'List all users',
    description: `Returns paginated list of users (staff/workers) in the municipality.
    
**Required Permission:** \`user.view_all\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'Paginated list of users',
    type: UsersListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or expired token', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden - missing user.view_all or user.view_department permission', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_VIEW_ALL, PERMISSIONS.USER_VIEW_DEPARTMENT)
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.findAll(user.id, user.municipalityId, query);
  }

  /**
   * Get user details
   * 
   * Required permission: user.view_all or user.view_department
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user details',
    description: `Returns details of a specific user including their roles.
    
**Required Permission:** \`user.view_all\` or \`user.view_department\`
**Who can use:** Admin, HOD, Supervisor`,
  })
  @ApiOkResponse({
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_VIEW_ALL, PERMISSIONS.USER_VIEW_DEPARTMENT)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.findOne(id, user.municipalityId);
  }

  /**
   * Create a new user (staff/worker)
   * 
   * Required permission: user.create (Admin only)
   */
  @WebOnly()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: `Creates a new staff or worker account. Unlike registration, this allows assigning specific roles and department.
    
**Required Permission:** \`user.create\`
**Who can use:** Admin only

**Note:** This is different from citizen registration - use this to create internal staff/worker accounts.`,
  })
  @ApiCreatedResponse({
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden - missing user.create permission', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.create(
      user.municipalityId,
      dto,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * Update user details
   * 
   * Required permission: user.update (Admin only)
   */
  @WebOnly()
  @Patch(':id')
  @ApiOperation({
    summary: 'Update user details',
    description: `Updates user profile, department assignment, or active status.
    
**Required Permission:** \`user.update\`
**Who can use:** Admin only`,
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.update(
      id,
      user.municipalityId,
      dto,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * Assign a role to user
   * 
   * Required permission: user.assign_role (Admin only)
   */
  @WebOnly()
  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign role to user',
    description: `Assigns an additional role to a user.
    
**Required Permission:** \`user.assign_role\`
**Who can use:** Admin only

**Example:** Promote a Worker to Staff by assigning the Staff role.`,
  })
  @ApiOkResponse({
    description: 'Role assigned successfully',
    type: UserRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User or role not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Role already assigned', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_ASSIGN_ROLE)
  async assignRole(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AssignRoleDto,
    @Req() req: Request,
  ) {
    return this.usersService.assignRole(
      id,
      dto.roleId,
      user.municipalityId,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * Remove a role from user
   * 
   * Required permission: user.assign_role (Admin only)
   */
  @WebOnly()
  @Delete(':id/roles/:roleId')
  @ApiOperation({
    summary: 'Remove role from user',
    description: `Removes a role from a user.
    
**Required Permission:** \`user.assign_role\`
**Who can use:** Admin only

**Warning:** Removing all roles will leave user without any permissions.`,
  })
  @ApiOkResponse({
    description: 'Role removed successfully',
    type: UserRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User or role assignment not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.USER_ASSIGN_ROLE)
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.usersService.removeRole(
      id,
      roleId,
      user.municipalityId,
      { id: user.id, email: user.email },
      req,
    );
  }
}
