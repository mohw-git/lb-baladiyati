import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AssignTaskDto {
  @ApiProperty({ description: 'User to assign — MUST be in the same department as the task' })
  @IsUUID()
  assignedToId!: string;
}
