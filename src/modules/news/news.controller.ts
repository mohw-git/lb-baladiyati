import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsQueryDto } from './dto/news-query.dto';
import {
  NewsListResponseDto,
  NewsResponseDto,
  NewsActionResponseDto,
} from './dto/news-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { Public } from '../../core/auth/decorators/public.decorator';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { imageOnlyMulterConfig } from '../../core/storage/multer.config';

@ApiTags('News')
@ApiBearerAuth('JWT-auth')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * List news articles
   * Public: Returns only published news
   * Authenticated with news.view_all: Returns all news including drafts
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List news articles (public)',
    description: `Returns paginated list of news articles.

**Public access:** Returns only published news. Pass \`municipalityId\` as query parameter.
**Authenticated with \`news.view_all\` permission:** Returns all news including drafts.`,
  })
  @ApiOkResponse({
    description: 'Paginated news list',
    type: NewsListResponseDto,
  })
  async findAll(
    @CurrentUser() user: CurrentUserData | undefined,
    @Query() query: NewsQueryDto,
  ) {
    const muniId = user?.municipalityId || query.municipalityId;
    if (!muniId) {
      return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
    }
    return this.newsService.findAll(user?.id || null, muniId, query);
  }

  /**
   * Get single news article
   */
  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get news article (public)',
    description: `Returns a single news article by ID.

**Public access:** Only published news. Pass \`municipalityId\` as query parameter.
**Authenticated:** Can also view drafts with proper permissions.`,
  })
  @ApiOkResponse({
    description: 'News article details',
    type: NewsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'News not found', type: ApiErrorResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData | undefined,
    @Query('municipalityId') municipalityId?: string,
  ) {
    const muniId = user?.municipalityId || municipalityId;
    if (!muniId) {
      throw new BadRequestException('Municipality ID required');
    }
    return this.newsService.findOne(id, user?.id ?? null, muniId);
  }

  /**
   * Create news article
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create news article',
    description: `Creates a new news article as draft. Use POST /news/:id/publish to publish.
    
**Required Permission:** \`news.create\`
**Who can use:** Staff, Admin`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'News created successfully',
    type: NewsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.NEWS_CREATE)
  @UseInterceptors(FileInterceptor('coverImage', imageOnlyMulterConfig))
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateNewsDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    return this.newsService.create(user.id, user.municipalityId, dto, coverImage);
  }

  /**
   * Update news article
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update news article',
    description: `Updates an existing news article.
    
**Required Permission:** \`news.update\`
**Who can use:** Staff, Admin`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'News updated successfully',
    type: NewsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'News not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.NEWS_UPDATE)
  @UseInterceptors(FileInterceptor('coverImage', imageOnlyMulterConfig))
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateNewsDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    return this.newsService.update(id, user.municipalityId, dto, coverImage);
  }

  /**
   * Publish news article
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish news article',
    description: `Publishes a draft news article, making it visible to the public.
    
**Required Permission:** \`news.publish\`
**Who can use:** Staff, Admin`,
  })
  @ApiOkResponse({
    description: 'News published successfully',
    type: NewsActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'News not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.NEWS_PUBLISH)
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.newsService.publish(id, user.municipalityId);
  }

  /**
   * Unpublish news article
   */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unpublish news article',
    description: `Reverts a published news article back to draft status.
    
**Required Permission:** \`news.publish\`
**Who can use:** Staff, Admin`,
  })
  @ApiOkResponse({
    description: 'News unpublished successfully',
    type: NewsActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'News not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.NEWS_PUBLISH)
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.newsService.unpublish(id, user.municipalityId);
  }

  /**
   * Delete news article (soft delete)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete news article',
    description: `Soft deletes a news article.
    
**Required Permission:** \`news.delete\`
**Who can use:** Staff, Admin`,
  })
  @ApiOkResponse({
    description: 'News deleted successfully',
    type: NewsActionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'News not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.NEWS_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.newsService.remove(id, user.municipalityId);
  }
}
