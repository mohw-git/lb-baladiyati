import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Citizen requests another verification email be sent. We do NOT
 * require auth here because users can hit this immediately after
 * signup (when they're already authenticated) OR while signed out
 * via a "didn't get the email?" link. Always returns generic "ok"
 * to prevent enumeration of registered addresses.
 */
export class ResendVerificationDto {
  @ApiProperty({ example: 'citizen@example.com' })
  @IsEmail()
  email!: string;
}

/** Verify-email completion: user clicks the link from their inbox. */
export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token from the email link' })
  @IsString()
  token!: string;
}
