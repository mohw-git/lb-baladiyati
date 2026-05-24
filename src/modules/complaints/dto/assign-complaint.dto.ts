import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignComplaintDto {
  @ApiProperty({ description: 'User UUID to assign complaint to' })
  @IsUUID()
  assignedToId: string;

  @ApiPropertyOptional({ example: 'Priority case, handle ASAP', description: 'Assignment notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
