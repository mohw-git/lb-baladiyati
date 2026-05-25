import { IsOptional, IsString, IsUUID, IsBoolean, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';
import { ComplaintStatus, ComplaintPriority } from '@prisma/client';
import type { ComplaintBucketId } from '../complaint-filters';

export class ComplaintQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search in title, description, reference code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by status (comma-separated)', example: 'SUBMITTED,ASSIGNED' })
  @IsOptional()
  @Transform(({ value }) => value?.split(','))
  @IsEnum(ComplaintStatus, { each: true })
  status?: ComplaintStatus[];

  @ApiPropertyOptional({ description: 'Filter by priority (comma-separated)', example: 'HIGH,URGENT' })
  @IsOptional()
  @Transform(({ value }) => value?.split(','))
  @IsEnum(ComplaintPriority, { each: true })
  priority?: ComplaintPriority[];

  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Show only my assigned complaints', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  myAssignments?: boolean;

  @ApiPropertyOptional({ description: 'Filter by overdue status', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter to complaints with no active assignment (the "needs attention" inbox)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, exclude COMPLETED, CLOSED and REJECTED statuses. Used by the action-queue buckets so the table matches the count badge.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'History view — only terminal complaints (COMPLETED, REJECTED, CLOSED). ' +
      'Combine with `status` to narrow to a single terminal status (e.g. only COMPLETED).',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  terminalOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Field workers only: when true, include complaints where the worker had an assignment (even if no longer active). Used by the "My History" bucket so completed work does not disappear from a worker\'s view.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeAssignmentHistory?: boolean;

  @ApiPropertyOptional({
    description: 'Staff only: filter to complaints submitted by unverified citizens',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  riskyOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Staff inbox bucket — applies the same filters as GET /complaints/stats/buckets',
    enum: [
      'needsAttention',
      'assignedToMe',
      'myDepartment',
      'all',
      'overdue',
      'myReports',
      'completed',
      'rejected',
      'closed',
      'history',
    ],
  })
  @IsOptional()
  @IsString()
  bucket?: ComplaintBucketId;
}
