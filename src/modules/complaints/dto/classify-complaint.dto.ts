import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClassifyComplaintDto {
  @ApiProperty({
    description: 'Target complaint category UUID (must belong to the complaint municipality)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  categoryId: string;
}
