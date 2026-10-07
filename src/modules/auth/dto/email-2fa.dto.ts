import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Switch the user's 2FA method to EMAIL (no QR code, just an email). */
export class EnableEmailTwoFactorDto {
  @ApiProperty({ description: 'Current password (for safety)' })
  @IsString()
  password!: string;
}

/** Submit the email OTP to complete the login challenge. */
export class EmailTwoFactorLoginDto {
  @ApiProperty({ description: 'Short-lived 2FA challenge token from /auth/login' })
  @IsString()
  challengeToken!: string;

  @ApiProperty({ description: '6-digit code emailed to the user', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;
}

/** Resend the email OTP for an in-flight 2FA challenge. */
export class ResendEmailTwoFactorDto {
  @ApiProperty({ description: 'Short-lived 2FA challenge token from /auth/login' })
  @IsString()
  challengeToken!: string;
}

/** Step 1: request an email OTP to confirm disabling email-based 2FA. */
export class RequestDisableEmailTwoFactorDto {
  @ApiProperty({ description: 'Current password (for safety)' })
  @IsString()
  password!: string;
}

/** Step 2: confirm disable with password + emailed OTP. */
export class ConfirmDisableEmailTwoFactorDto {
  @ApiProperty({ description: 'Current password (for safety)' })
  @IsString()
  password!: string;

  @ApiProperty({ description: '6-digit code emailed to the user', example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;
}
