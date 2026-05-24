import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintPriority } from '@prisma/client';

export class SetPriorityDto {
  @ApiProperty({
    description: 'Priority level',
    enum: ComplaintPriority,
    example: 'HIGH',
  })
  @IsEnum(ComplaintPriority)
  priority: ComplaintPriority;

  @ApiPropertyOptional({
    description: 'Custom due date (overrides default SLA)',
    example: '2026-02-20T18:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
