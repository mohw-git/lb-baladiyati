import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMPLAINT_FIELD_LIMITS } from '@shared/constants/complaint-fields';

export class CreateComplaintDto {
  @ApiProperty({ description: 'Category UUID' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: 'Pothole on Main Street',
    description: 'Complaint title',
    minLength: COMPLAINT_FIELD_LIMITS.title.min,
    maxLength: COMPLAINT_FIELD_LIMITS.title.max,
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(COMPLAINT_FIELD_LIMITS.title.min, {
    message: `Title must be at least ${COMPLAINT_FIELD_LIMITS.title.min} characters`,
  })
  @MaxLength(COMPLAINT_FIELD_LIMITS.title.max, {
    message: `Title must not exceed ${COMPLAINT_FIELD_LIMITS.title.max} characters`,
  })
  title: string;

  @ApiProperty({
    example: 'There is a large pothole causing traffic issues...',
    description: 'Detailed description',
    minLength: COMPLAINT_FIELD_LIMITS.description.min,
    maxLength: COMPLAINT_FIELD_LIMITS.description.max,
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(COMPLAINT_FIELD_LIMITS.description.min, {
    message: `Description must be at least ${COMPLAINT_FIELD_LIMITS.description.min} characters`,
  })
  @MaxLength(COMPLAINT_FIELD_LIMITS.description.max, {
    message: `Description must not exceed ${COMPLAINT_FIELD_LIMITS.description.max} characters`,
  })
  description: string;

  @ApiProperty({ example: 33.8938, description: 'Incident latitude (required for routing)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 35.5018, description: 'Incident longitude (required for routing)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ example: '123 Main Street, Beirut', description: 'Address' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Required when location resolution is ambiguous. Must be one of the resolver candidate municipality IDs.',
  })
  @IsOptional()
  @IsUUID()
  selectedMunicipalityId?: string;
}
