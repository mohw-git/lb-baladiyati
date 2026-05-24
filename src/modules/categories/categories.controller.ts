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
  @ApiOkResponse({
    description: 'List of categories',
    type: CategoriesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('all') all?: string,
  ) {
    let includeInactive = all === 'true';
    // Only users with category management permissions can see inactive categories
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
    return this.categoriesService.findAll(user.municipalityId, includeInactive);
  }

  /**
   * Get category details
   */
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

  /**
   * Create a new category
   */
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
  ) {
    return this.categoriesService.create(user.municipalityId, dto);
  }

  /**
   * Update a category
   */
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
  ) {
    return this.categoriesService.update(id, user.municipalityId, dto);
  }

  /**
   * Activate a category
   */
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
  ) {
    return this.categoriesService.toggleActive(id, user.municipalityId, true);
  }

  /**
   * Deactivate a category
   */
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
  ) {
    return this.categoriesService.toggleActive(id, user.municipalityId, false);
  }

  /**
   * Delete a category (soft delete / deactivate)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a category',
    description: `Deactivates a category (sets isActive to false).

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
  ) {
    return this.categoriesService.remove(id, user.municipalityId);
  }
}
