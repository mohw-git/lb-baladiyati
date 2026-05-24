import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Roads & Infrastructure', description: 'Department name (canonical / English)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'الطرق والبنية التحتية',
    description: 'Arabic translation of the department name. Optional but strongly recommended for tenants in Arabic-speaking regions.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({
    example: 'Voirie et infrastructure',
    description: 'French translation of the department name. Optional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameFr?: string;

  @ApiPropertyOptional({ example: 'Handles road maintenance', description: 'Department description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Arabic translation of the description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'French translation of the description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionFr?: string;
}
