import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNewsDto {
  @ApiProperty({ example: 'Road Maintenance Scheduled', description: 'News title' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'We are pleased to announce that road maintenance will begin...', description: 'News content (HTML allowed)' })
  @IsString()
  @MinLength(10)
  content: string;
}
