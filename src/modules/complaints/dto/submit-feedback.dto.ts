import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitFeedbackDto {
  @ApiProperty({
    description: 'Rating from 1 (poor) to 5 (excellent)',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Optional comment about the service',
    example: 'The team fixed the pothole quickly. Thank you!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
