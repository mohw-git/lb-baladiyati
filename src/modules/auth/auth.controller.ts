import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  VerifyTwoFactorDto,
  DisableTwoFactorDto,
  TwoFactorLoginDto,
} from './dto/two-factor.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import {
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/email-verification.dto';
import {
  EnableEmailTwoFactorDto,
  EmailTwoFactorLoginDto,
  ResendEmailTwoFactorDto,
  RequestDisableEmailTwoFactorDto,
  ConfirmDisableEmailTwoFactorDto,
} from './dto/email-2fa.dto';
import { multerConfig } from '../../core/storage/multer.config';
import {
  RegisterResponseDto,
  LoginResponseDto,
  ProfileResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new citizen account
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new citizen account',
    description: 'Creates a new user account with Citizen role in the specified municipality',
  })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists in this municipality',
    type: ApiErrorResponseDto,
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req);
  }

  /**
   * Login with email and password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login and get JWT tokens',
    description: 'Authenticates user and returns access/refresh token pair',
  })
  @ApiOkResponse({
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account',
    type: ApiErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ApiErrorResponseDto,
  })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  /**
   * Refresh access token
   *
   * Note: All IP-based throttling (including the global 100/min) is disabled here.
   * Lebanon and similar markets use carrier-grade NAT heavily, where many legitimate
   * users share a single egress IP — IP-based limits would falsely block real traffic.
   * The endpoint is still protected by stateful refresh-token security:
   *  - Token rotation (each refresh issues a new token + revokes the old one)
   *  - Replay detection (reusing a revoked token revokes the entire token family)
   *  - Hashed storage in DB (SHA-256, not raw tokens)
   *  - Token expiry (7 days)
   */
  @Public()
  @SkipThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Exchange refresh token for new access/refresh token pair',
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token',
    type: ApiErrorResponseDto,
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile with roles and municipality info',
  })
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing token',
    type: ApiErrorResponseDto,
  })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return this.authService.getProfile(user.id);
  }

  /**
   * Update current user profile
   */
  @Patch('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Updates the authenticated user profile fields',
  })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing token',
    type: ApiErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ApiErrorResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  /**
   * Logout and invalidate refresh token
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout and invalidate refresh token',
    description: 'Revokes the provided refresh token so it cannot be used again',
  })
  @ApiOkResponse({
    description: 'Logged out successfully',
    type: MessageResponseDto,
  })
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.logout(dto.refreshToken, req);
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revokes all refresh tokens for the authenticated user',
  })
  @ApiOkResponse({
    description: 'All sessions revoked',
    type: MessageResponseDto,
  })
  async logoutAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.authService.logoutAll(user.id, req);
  }

  // ===========================================================
  //  Password change
  // ===========================================================
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.id, dto, req);
  }

  // ===========================================================
  //  Avatar upload
  // ===========================================================
  @Post('me/avatar')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile picture (image, max 5 MB)' })
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  async uploadAvatar(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.authService.uploadAvatar(user.id, file, req);
  }

  // ===========================================================
  //  Two-Factor Authentication
  // ===========================================================
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Begin 2FA setup',
    description:
      'Generates a TOTP secret + QR code (data URL). Scan the QR with Google Authenticator (or any TOTP app) and call /auth/2fa/verify with the 6-digit code to enable.',
  })
  async setupTwoFactor(@CurrentUser() user: CurrentUserData) {
    return this.authService.setupTwoFactor(user.id);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA' })
  async verifyTwoFactor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.verifyAndEnableTwoFactor(user.id, dto.code, req);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disable 2FA (requires password + code)' })
  async disableTwoFactor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: DisableTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.disableTwoFactor(user.id, dto.password, dto.code, req);
  }

  @Public()
  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete login with 2FA',
    description:
      'Call after /auth/login returned `twoFactorRequired: true`. Provide the challengeToken and the 6-digit TOTP code.',
  })
  async twoFactorLogin(@Body() dto: TwoFactorLoginDto, @Req() req: Request) {
    return this.authService.completeTwoFactorLogin(dto.challengeToken, dto.code, req);
  }

  // ── Password reset by email ──────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset email',
    description:
      'Sends a password reset link to the email if an active account exists. Always returns the same message to prevent enumeration. Rate-limited.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.requestPasswordReset(dto.email, req);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete password reset using emailed token',
    description: 'Token is single-use; reusing it after success returns 400. All sessions are revoked.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto.token, dto.newPassword, req);
  }

  // ── Email verification ───────────────────────────────────────────────

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Resend the email verification link',
    description:
      'Always returns the same generic message regardless of whether the email exists. Rate-limited.',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
  ) {
    return this.authService.sendEmailVerification(dto.email, req);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete email verification using emailed token',
    description: 'Token is single-use and time-limited.',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto.token, req);
  }

  // ── Email 2FA ────────────────────────────────────────────────────────

  @Post('2fa/email/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enable email-based 2FA',
    description:
      'Requires a verified email and the current password. Replaces TOTP if previously configured.',
  })
  async enableEmailTwoFactor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: EnableEmailTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.enableEmailTwoFactor(user.id, dto.password, req);
  }

  @Public()
  @Post('2fa/email/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete login with an emailed OTP',
    description:
      'Call after /auth/login returned `twoFactorRequired: true` with `twoFactorMethod: "EMAIL"`.',
  })
  async emailTwoFactorLogin(
    @Body() dto: EmailTwoFactorLoginDto,
    @Req() req: Request,
  ) {
    return this.authService.completeEmailTwoFactorLogin(
      dto.challengeToken,
      dto.code,
      req,
    );
  }

  @Public()
  @Post('2fa/email/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Resend the email 2FA sign-in code',
    description:
      'Validates the in-flight challenge token first, so anonymous flooding cannot trigger emails.',
  })
  async resendEmailTwoFactor(
    @Body() dto: ResendEmailTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.resendEmailTwoFactorCode(dto.challengeToken, req);
  }

  @Post('2fa/email/disable/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Request email OTP to disable email-based 2FA',
    description: 'Step 1 of 2. Requires the current password. Rate-limited.',
  })
  async requestDisableEmailTwoFactor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RequestDisableEmailTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.requestDisableEmailTwoFactor(
      user.id,
      dto.password,
      req,
    );
  }

  @Post('2fa/email/disable/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm disable of email-based 2FA',
    description: 'Step 2 of 2. Requires password and the emailed OTP.',
  })
  async confirmDisableEmailTwoFactor(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ConfirmDisableEmailTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.authService.confirmDisableEmailTwoFactor(
      user.id,
      dto.password,
      dto.code,
      req,
    );
  }
}
