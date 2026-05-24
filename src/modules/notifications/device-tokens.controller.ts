import { Controller, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { DeviceTokenResponseDto } from './dto/notification-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('device-tokens')
export class DeviceTokensController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Register device token for push notifications
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register device token',
    description: `Registers a device token for push notifications (FCM).

**Who can use:** Any authenticated user

**Note:** If the token already exists for this user, it will be updated.`,
  })
  @ApiCreatedResponse({
    description: 'Device token registered successfully',
    type: DeviceTokenResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async register(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notificationsService.registerToken(
      user.id,
      dto.token,
      dto.platform,
    );
  }

  /**
   * Remove device token
   */
  @Delete(':token')
  @ApiOperation({
    summary: 'Remove device token',
    description: `Removes a device token from push notifications. Call this when user logs out.

**Who can use:** Any authenticated user`,
  })
  @ApiOkResponse({
    description: 'Device token removed successfully',
    type: DeviceTokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  async remove(
    @Param('token') token: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.notificationsService.removeToken(user.id, token);
  }
}
