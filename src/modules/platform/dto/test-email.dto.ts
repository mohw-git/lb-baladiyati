import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for POST /platform/test-email. Super-admin only.
 *
 * Lets operators verify Resend (or SMTP) deliverability without creating
 * a real user account. The endpoint sends the email-verification
 * template wrapped with a "[TEST]" prefix in the subject line.
 */
export class TestEmailDto {
  @ApiProperty({
    example: 'ops@example.com',
    description: 'Recipient address for the diagnostic email',
  })
  @IsEmail()
  to!: string;

  @ApiPropertyOptional({
    example: 'EN',
    enum: ['EN', 'AR', 'FR'],
    description: 'Template locale (defaults to EN)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['EN', 'AR', 'FR'])
  locale?: 'EN' | 'AR' | 'FR';
}
