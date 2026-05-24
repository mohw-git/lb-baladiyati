import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMunicipalityDto {
  @ApiProperty({ example: 'Tripoli Municipality', description: 'Canonical / English name' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'بلدية طرابلس',
    description: 'Arabic translation of the municipality name. Strongly recommended.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({
    example: 'Municipalité de Tripoli',
    description: 'French translation of the municipality name. Optional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameFr?: string;

  @ApiProperty({
    example: 'TRI',
    description: 'Short uppercase code (2-10 chars, letters/numbers).',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, { message: 'Code must be uppercase letters/numbers only' })
  code!: string;

  @ApiProperty({ example: 'admin@tripoli.gov.lb' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminFirstName!: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminLastName!: string;
}
