import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';

export class RegisterTokenDto {
  @ApiProperty({ example: 'fcm_token_string_here', description: 'FCM device token' })
  @IsString()
  token: string;

  @ApiProperty({ enum: Platform, example: 'ANDROID', description: 'Device platform (ANDROID or IOS)' })
  @IsEnum(Platform)
  platform: Platform;
}
