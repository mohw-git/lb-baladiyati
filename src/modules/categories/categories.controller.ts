import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  CategoriesListResponseDto,
  CategoryResponseDto,
  CategoryMessageResponseDto,
} from './dto/category-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { PermissionsResolver } from '../../core/rbac/permissions.resolver';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly permissionsResolver: PermissionsResolver,
  ) {}

  private actor(user: CurrentUserData) {
    return { id: user.id, email: user.email };
  }

  /**
   * List all categories
   * Pass ?all=true to include inactive categories (for admin management)
   */
  @Get()
  @ApiOperation({
    summary: 'List all categories',
    description: `Returns complaint categories in the current municipality.
    
By default, only active categories are returned.
Pass \`?all=true\` to include inactive categories (for admin management).`,
  })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'Include inactive categories' })
  @ApiQuery({
    name: 'municipalityId',
    required: false,
    type: String,
    description:
      'Load categories for a specific municipality (incident location). Citizens may request any active municipality.',
  })
  @ApiOkResponse({
    description: 'List of categories',
    type: CategoriesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('all') all?: string,
    @Query('municipalityId') municipalityIdParam?: string,
  ) {
    let includeInactive = all === 'true';
    if (includeInactive) {
      const permissions = await this.permissionsResolver.getUserPermissions(user.id);
      const canManage =
        permissions.includes(PERMISSIONS.CATEGORY_UPDATE) ||
        permissions.includes(PERMISSIONS.CATEGORY_CREATE) ||
        permissions.includes(PERMISSIONS.CATEGORY_DELETE);
      if (!canManage) {
        includeInactive = false;
      }
    }

    let targetMunicipalityId = user.municipalityId;
    if (municipalityIdParam) {
      const permissions = await this.permissionsResolver.getUserPermissions(user.id);
      const isStaff =
        permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
        permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
        permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);
      const canSubmit = permissions.includes(PERMISSIONS.COMPLAINT_CREATE);

      if (isStaff && !user.isSuperAdmin && municipalityIdParam !== user.municipalityId) {
        throw new ForbiddenException(
          'Staff can only load categories for their own municipality',
        );
      }
      if (!canSubmit && !isStaff && !user.isSuperAdmin) {
        throw new ForbiddenException('Not allowed to load categories for another municipality');
      }

      const muni = await this.categoriesService.assertActiveMunicipality(municipalityIdParam);
      targetMunicipalityId = muni.id;
    }

    return this.categoriesService.findAll(
      targetMunicipalityId,
      includeInactive,
      includeInactive ? user.id : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get category details',
    description: 'Returns details of a specific category',
  })
  @ApiOkResponse({
    description: 'Category details',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Category not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.categoriesService.findOne(id, user.municipalityId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new category',
    description: `Creates a new complaint category, optionally linked to a department.

**Required Permission:** \`category.create\``,
  })
  @ApiCreatedResponse({
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.CATEGORY_CREATE)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoriesService.create(
      user.municipalityId,
      dto,
      this.actor(user),
      req,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category',
    description: `Updates category details including name, icon, department, and active status.

**Required Permission:** \`category.update\``,
  })
  @ApiOkResponse({
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Category not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.CATEGORY_UPDATE)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoriesService.update(
      id,
      user.municipalityId,
      dto,
      this.actor(user),
      req,
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate a category',
    description: `Re-activates a deactivated category.

**Required Permission:** \`category.update\``,
  })
  @ApiOkResponse({ description: 'Category activated', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.CATEGORY_UPDATE)
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.categoriesService.toggleActive(
      id,
      user.municipalityId,
      true,
      this.actor(user),
      req,
    );
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a category',
    description: `Deactivates a category so it no longer appears for citizens.

**Required Permission:** \`category.update\``,
  })
  @ApiOkResponse({ description: 'Category deactivated', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.CATEGORY_UPDATE)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.categoriesService.toggleActive(
      id,
      user.municipalityId,
      false,
      this.actor(user),
      req,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a category',
    description: `Soft-deactivates a category (sets isActive to false). Historical complaints retain their category reference.

**Required Permission:** \`category.delete\``,
  })
  @ApiOkResponse({
    description: 'Category deactivated successfully',
    type: CategoryMessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Category not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.CATEGORY_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.categoriesService.remove(
      id,
      user.municipalityId,
      this.actor(user),
      req,
    );
  }
}
