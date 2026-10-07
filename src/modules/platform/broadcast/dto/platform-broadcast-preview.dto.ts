import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformBroadcastAudience, PlatformBroadcastChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PlatformBroadcastAudienceConfigDto } from './platform-broadcast-audience-config.dto';

export class PlatformBroadcastPreviewDto {
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
}
