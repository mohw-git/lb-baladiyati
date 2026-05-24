import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNewsDto {
  @ApiPropertyOptional({ example: 'Updated News Title', description: 'News title' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated content...', description: 'News content' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}
