import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../core/common/dto/pagination.dto';

/**
 * Author reference in news
 */
export class AuthorRefDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;
}

/**
 * News item data
 */
export class NewsDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Road Construction Update' })
  title: string;

  @ApiProperty({ example: 'Main Street will be closed for repairs...' })
  content: string;

  @ApiPropertyOptional({ example: '/uploads/news/cover-123.jpg' })
  coverImageUrl?: string;

  @ApiProperty({ example: true, description: 'Whether the news is published' })
  isPublished: boolean;

  @ApiPropertyOptional({ example: '2026-02-11T10:00:00.000Z' })
  publishedAt?: string;

  @ApiProperty({ type: AuthorRefDto })
  author: AuthorRefDto;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  updatedAt: string;
}

/**
 * News summary for list view
 */
export class NewsSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Road Construction Update' })
  title: string;

  @ApiProperty({ example: 'Main Street will be closed for repairs...', description: 'Truncated content preview' })
  excerpt: string;

  @ApiPropertyOptional({ example: '/uploads/news/cover-123.jpg' })
  coverImageUrl?: string;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiPropertyOptional({ example: '2026-02-11T10:00:00.000Z' })
  publishedAt?: string;

  @ApiProperty({ type: AuthorRefDto })
  author: AuthorRefDto;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Paginated news list response
 */
export class NewsListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [NewsSummaryDto] })
  data: NewsSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Single news response
 */
export class NewsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NewsDto })
  data: NewsDto;
}

/**
 * News action response (publish/unpublish/delete)
 */
export class NewsActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: { message: 'News published successfully' },
  })
  data: { message: string };
}
