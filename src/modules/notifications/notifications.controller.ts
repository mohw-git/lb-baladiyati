import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationsListResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
} from './dto/notification-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * List user's notifications
   */
  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: `Returns paginated list of notifications for the authenticated user.

**Who can use:** Any authenticated user`,
  })
  @ApiOkResponse({
    description: 'Paginated notifications list',
    type: NotificationsListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  /**
   * Get unread notifications count
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread count',
    description: `Returns the number of unread notifications for the authenticated user.

**Who can use:** Any authenticated user`,
  })
  @ApiOkResponse({
    description: 'Unread notifications count',
    type: UnreadCountResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async getUnreadCount(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  /**
   * Mark a notification as read
   */
  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: `Marks a single notification as read.

**Who can use:** Any authenticated user (own notifications only)`,
  })
  @ApiOkResponse({
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Notification not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  /**
   * Mark all notifications as read
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all as read',
    description: `Marks all notifications as read for the authenticated user.

**Who can use:** Any authenticated user`,
  })
  @ApiOkResponse({
    description: 'All notifications marked as read',
    type: MarkAllReadResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async markAllAsRead(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
