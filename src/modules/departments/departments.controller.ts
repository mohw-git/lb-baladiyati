import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import {
  DepartmentsListResponseDto,
  DepartmentResponseDto,
  DepartmentMessageResponseDto,
} from './dto/department-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

@ApiTags('Departments')
@ApiBearerAuth('JWT-auth')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  /**
   * List all departments
   */
  @Get()
  @ApiOperation({
    summary: 'List all departments',
    description: 'Returns all departments in the current municipality with user and category counts',
  })
  @ApiOkResponse({
    description: 'List of departments',
    type: DepartmentsListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.departmentsService.findAll(user.municipalityId);
  }

  /**
   * Get department details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get department details',
    description: 'Returns details of a specific department',
  })
  @ApiOkResponse({
    description: 'Department details',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Department not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.departmentsService.findOne(id, user.municipalityId);
  }

  /**
   * Create a new department
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new department',
    description: 'Creates a new department in the current municipality',
  })
  @ApiCreatedResponse({
    description: 'Department created successfully',
    type: DepartmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_CREATE)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user.municipalityId, dto);
  }

  /**
   * Update a department
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a department',
    description: 'Updates department name and/or description',
  })
  @ApiOkResponse({
    description: 'Department updated successfully',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Department not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, user.municipalityId, dto);
  }

  /**
   * Delete a department
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a department',
    description: 'Soft deletes a department (marks as deleted)',
  })
  @ApiOkResponse({
    description: 'Department deleted successfully',
    type: DepartmentMessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Department not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.DEPARTMENT_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.departmentsService.remove(id, user.municipalityId);
  }

  /**
   * Set the Head of Department (positional slot).
   * Atomically grants HOD role to the new head and revokes it from the
   * previous holder. Only the Municipality Admin can do this.
   */
  @Put(':id/head')
  @ApiOperation({
    summary: 'Promote a user to Head of this Department',
    description:
      'Moves the HOD positional slot to the given user, grants the HOD role atomically, and revokes it from any previous holder.',
  })
  @RequirePermissions(PERMISSIONS.USER_ASSIGN_ROLE)
  async setHead(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.departmentsService.setHead(
      id,
      user.municipalityId,
      userId,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * Clear the HOD slot (vacate the position). The UI will warn the
   * Municipality Admin that the department has no Head until refilled.
   */
  @Delete(':id/head')
  @ApiOperation({
    summary: 'Vacate the Head of Department slot',
  })
  @RequirePermissions(PERMISSIONS.USER_ASSIGN_ROLE)
  async vacateHead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.departmentsService.vacateHead(
      id,
      user.municipalityId,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * List the staff members of a department.
   */
  @Get(':id/members')
  @ApiOperation({
    summary: 'List the staff members of a department',
  })
  async listMembers(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.departmentsService.listMembers(id, user.municipalityId);
  }

  /**
   * Add a member to the department by email. The target user must already
   * be a provisioned staff account in the same municipality.
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a member to the department by email',
  })
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  async addMember(
    @Param('id') id: string,
    @Body('email') email: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.departmentsService.addMemberByEmail(
      id,
      user.municipalityId,
      email,
      { id: user.id, email: user.email },
      req,
    );
  }

  /**
   * Remove a member from the department.
   */
  @Delete(':id/members/:userId')
  @ApiOperation({
    summary: 'Remove a member from the department',
  })
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.departmentsService.removeMember(
      id,
      user.municipalityId,
      userId,
      { id: user.id, email: user.email },
      req,
    );
  }
}
