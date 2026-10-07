import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformBroadcastAudience, PlatformBroadcastChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PlatformBroadcastAudienceConfigDto } from './platform-broadcast-audience-config.dto';

export class PlatformBroadcastSendDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ description: 'In-app / push deep link (e.g. /platform/announcements)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @ApiProperty({ enum: PlatformBroadcastAudience })
  @IsEnum(PlatformBroadcastAudience)
  audience: PlatformBroadcastAudience;

  @ApiPropertyOptional({ type: PlatformBroadcastAudienceConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformBroadcastAudienceConfigDto)
  audienceConfig?: PlatformBroadcastAudienceConfigDto;

  @ApiProperty({ enum: PlatformBroadcastChannel })
  @IsEnum(PlatformBroadcastChannel)
  channels: PlatformBroadcastChannel;

  @ApiPropertyOptional({
    description: 'ISO datetime for scheduled send. Omit or null for send now.',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Client idempotency key (unique per broadcast intent)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Required when audience is ALL_USERS — must equal SEND TO ALL USERS',
  })
  @IsOptional()
  @IsString()
  confirmPhrase?: string;
}
