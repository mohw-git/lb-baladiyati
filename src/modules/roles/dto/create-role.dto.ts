import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Supervisor', description: 'Role name (canonical / English)' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'مشرف', description: 'Arabic translation of the role name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Superviseur', description: 'French translation of the role name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nameFr?: string;

  @ApiPropertyOptional({ example: 'Supervises workers', description: 'Role description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: 'Arabic translation of the description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'French translation of the description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descriptionFr?: string;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Hierarchy priority (Discord-style). Higher numbers are stronger; ties allowed. ' +
      'Must be strictly less than the actor\'s own effective rank. Defaults to 0 if omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ type: [String], description: 'Array of permission UUIDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
