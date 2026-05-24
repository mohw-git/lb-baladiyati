import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../core/common/dto/pagination.dto';

/**
 * Category summary in complaint response
 */
export class CategorySummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Potholes' })
  name: string;

  @ApiPropertyOptional({ example: 'pothole-icon' })
  icon?: string;
}

/**
 * User summary in complaint response
 */
export class UserSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;
}

/**
 * Assignment info in complaint response
 */
export class AssignmentInfoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ type: UserSummaryDto })
  assignedTo: UserSummaryDto;

  @ApiPropertyOptional({ type: UserSummaryDto })
  assignedBy?: UserSummaryDto;

  @ApiPropertyOptional({ example: 'Priority case, handle ASAP' })
  notes?: string;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  assignedAt: string;
}

/**
 * Attachment info in complaint response
 */
export class AttachmentInfoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '/uploads/complaints/abc123.jpg' })
  url: string;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO', 'DOCUMENT'] })
  type: string;

  @ApiProperty({ example: 'INITIAL', enum: ['INITIAL', 'PROOF'] })
  stage: string;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

/**
 * Status log entry in complaint response
 */
export class StatusLogDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'ASSIGNED', enum: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED', 'REJECTED'] })
  status: string;

  @ApiPropertyOptional({ example: 'Work started on site' })
  notes?: string;

  @ApiPropertyOptional({ type: UserSummaryDto })
  changedBy?: UserSummaryDto;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

/**
 * Complaint summary for list view
 */
export class ComplaintSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'BEI-260211-A1B2' })
  referenceCode: string;

  @ApiProperty({ example: 'Pothole on Main Street' })
  title: string;

  @ApiProperty({ example: 'SUBMITTED', enum: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED', 'REJECTED'] })
  status: string;

  @ApiProperty({ type: CategorySummaryDto })
  category: CategorySummaryDto;

  @ApiProperty({ type: UserSummaryDto })
  reporter: UserSummaryDto;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-11T12:00:00.000Z' })
  updatedAt: string;
}

/**
 * Full complaint details
 */
export class ComplaintDetailDto extends ComplaintSummaryDto {
  @ApiProperty({ example: 'Large pothole causing traffic issues on the main road...' })
  description: string;

  @ApiPropertyOptional({ example: 33.8938 })
  latitude?: number;

  @ApiPropertyOptional({ example: 35.5018 })
  longitude?: number;

  @ApiPropertyOptional({ example: '123 Main Street, Beirut' })
  address?: string;

  @ApiPropertyOptional({ type: AssignmentInfoDto })
  currentAssignment?: AssignmentInfoDto;

  @ApiProperty({ type: [AttachmentInfoDto] })
  attachments: AttachmentInfoDto[];

  @ApiProperty({ type: [StatusLogDto] })
  statusLogs: StatusLogDto[];
}

// ============ Full Response DTOs for Swagger ============

/**
 * Paginated complaints list response
 */
export class ComplaintsListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [ComplaintSummaryDto] })
  data: ComplaintSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Single complaint response
 */
export class ComplaintResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ComplaintDetailDto })
  data: ComplaintDetailDto;
}

/**
 * Complaint created response
 */
export class ComplaintCreatedResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      referenceCode: 'BEI-260211-A1B2',
      title: 'Pothole on Main Street',
      status: 'SUBMITTED',
      createdAt: '2026-02-11T10:00:00.000Z',
    },
  })
  data: {
    id: string;
    referenceCode: string;
    title: string;
    status: string;
    createdAt: string;
  };
}

/**
 * Assignment response
 */
export class AssignmentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AssignmentInfoDto })
  data: AssignmentInfoDto;
}

/**
 * Status change response
 */
export class StatusChangeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'IN_PROGRESS',
      updatedAt: '2026-02-11T12:00:00.000Z',
    },
  })
  data: {
    id: string;
    status: string;
    updatedAt: string;
  };
}

/**
 * Message response for delete operations
 */
export class DeleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: { message: 'Complaint deleted successfully' } })
  data: {
    message: string;
  };
}
