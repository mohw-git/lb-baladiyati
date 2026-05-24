import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Pagination metadata
 */
export class PaginationMeta {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 100, description: 'Total number of items' })
  total: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ example: true, description: 'Has next page' })
  hasNextPage: boolean;

  @ApiProperty({ example: false, description: 'Has previous page' })
  hasPrevPage: boolean;
}

/**
 * Generic API Success Response wrapper
 */
export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T;

  @ApiPropertyOptional({ type: PaginationMeta })
  meta?: PaginationMeta;

  constructor(data: T, meta?: PaginationMeta) {
    this.success = true;
    this.data = data;
    this.meta = meta;
  }

  static success<T>(data: T, meta?: PaginationMeta): ApiResponseDto<T> {
    return new ApiResponseDto(data, meta);
  }
}

/**
 * Paginated response wrapper
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta) {
    this.success = true;
    this.data = data;
    this.meta = meta;
  }

  static paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const totalPages = Math.ceil(total / limit);
    return new PaginatedResponseDto(data, {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  }
}

/**
 * Error detail item
 */
export class ErrorDetail {
  @ApiProperty({ example: 'email', description: 'Field that caused the error' })
  field: string;

  @ApiProperty({ example: 'Invalid email format', description: 'Error message' })
  message: string;

  @ApiPropertyOptional({ example: 'user@', description: 'Rejected value' })
  value?: any;
}

/**
 * Error response body
 */
export class ErrorBody {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: 'Error code' })
  code: string;

  @ApiProperty({ example: 'Validation failed', description: 'Human readable message' })
  message: string;

  @ApiPropertyOptional({ type: [ErrorDetail], description: 'Detailed error information' })
  details?: ErrorDetail[];
}

/**
 * Standard API Error Response
 */
export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: ErrorBody })
  error: ErrorBody;

  @ApiProperty({ example: '2026-02-11T14:30:00.000Z', description: 'Error timestamp' })
  timestamp: string;

  @ApiPropertyOptional({ example: '/auth/register', description: 'Request path' })
  path?: string;

  constructor(code: string, message: string, details?: ErrorDetail[], path?: string) {
    this.success = false;
    this.error = { code, message, details };
    this.timestamp = new Date().toISOString();
    this.path = path;
  }

  static create(
    code: string,
    message: string,
    details?: ErrorDetail[],
    path?: string,
  ): ApiErrorResponseDto {
    return new ApiErrorResponseDto(code, message, details, path);
  }
}

// Error codes enum for consistency
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
}
