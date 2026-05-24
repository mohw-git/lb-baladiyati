import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';

export class ChangeStatusDto {
  @ApiProperty({ enum: ComplaintStatus, example: 'IN_PROGRESS', description: 'New status' })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;

  @ApiPropertyOptional({ example: 'Work started on site', description: 'Status change notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
