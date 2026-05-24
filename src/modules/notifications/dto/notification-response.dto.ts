import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../core/common/dto/pagination.dto';

/**
 * Notification data
 */
export class NotificationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'COMPLAINT_STATUS_CHANGED', description: 'Notification type identifier' })
  type: string;

  @ApiProperty({ example: 'Complaint Status Updated' })
  title: string;

  @ApiProperty({ example: 'Your complaint #BEI-260211-A1B2 has been marked as in progress.' })
  body: string;

  @ApiPropertyOptional({
    example: { complaintId: '550e8400-...', status: 'in_progress' },
    description: 'Additional data payload for navigation/action',
  })
  data?: Record<string, any>;

  @ApiProperty({ example: false, description: 'Whether the notification has been read' })
  isRead: boolean;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  createdAt: string;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Paginated notifications list response
 */
export class NotificationsListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Single notification response
 */
export class NotificationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NotificationDto })
  data: NotificationDto;
}

/**
 * Unread count response
 */
export class UnreadCountResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: { unreadCount: 5 },
  })
  data: { unreadCount: number };
}

/**
 * Mark all read response
 */
export class MarkAllReadResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: { message: 'All notifications marked as read', count: 5 },
  })
  data: { message: string; count: number };
}

/**
 * Device token registration response
 */
export class DeviceTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: { message: 'Device token registered successfully' },
  })
  data: { message: string };
}
