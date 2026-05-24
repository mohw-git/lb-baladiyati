import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@beirut.gov.lb', description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123', description: 'Password' })
  @IsString()
  @MinLength(1)
  password: string;
}
