import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * User data returned in auth responses
 */
export class AuthUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: '+961123456' })
  phone?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  municipalityId: string;
}

/**
 * Extended user data with roles and permissions (for login response)
 */
export class AuthUserWithRolesDto extends AuthUserDto {
  @ApiProperty({ type: [String], example: ['Admin', 'Staff'] })
  roles: string[];

  @ApiProperty({ type: [String], example: ['complaint:view', 'complaint:create', 'user:manage'] })
  permissions: string[];
}

/**
 * Token pair returned in auth responses
 */
export class TokensDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    description: 'JWT access token for API authentication'
  })
  accessToken: string;

  @ApiProperty({ 
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4gZXhhbXBsZQ==',
    description: 'Refresh token for obtaining new access tokens'
  })
  refreshToken: string;
}

/**
 * Login/Register response data
 */
export class AuthDataDto {
  @ApiProperty({ type: AuthUserWithRolesDto })
  user: AuthUserWithRolesDto;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token'
  })
  accessToken: string;

  @ApiProperty({ 
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...',
    description: 'Refresh token'
  })
  refreshToken: string;
}

/**
 * Register response data (user without roles initially)
 */
export class RegisterDataDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...' })
  refreshToken: string;
}

// ============ Full Response DTOs for Swagger ============

/**
 * Success response for register endpoint
 */
export class RegisterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: RegisterDataDto })
  data: RegisterDataDto;
}

/**
 * Success response for login endpoint
 */
export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AuthDataDto })
  data: AuthDataDto;
}

/**
 * User profile response
 */
export class UserProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: '+961123456' })
  phone?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ 
    example: { id: '...', name: 'Beirut Municipality', code: 'BEI' },
    description: 'Municipality details'
  })
  municipality: {
    id: string;
    name: string;
    code: string;
  };

  @ApiPropertyOptional({ 
    example: { id: '...', name: 'Roads & Infrastructure' },
    description: 'Department if assigned'
  })
  department?: {
    id: string;
    name: string;
  };

  @ApiProperty({ 
    type: 'array',
    example: [{ id: '...', name: 'Admin' }],
    description: 'Assigned roles'
  })
  roles: { id: string; name: string }[];
}

/**
 * Success response for profile endpoint
 */
export class ProfileResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UserProfileDto })
  data: UserProfileDto;
}

import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Refresh token request
 */
export class RefreshTokenDto {
  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...', description: 'Refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

/**
 * Refresh token response
 */
export class RefreshTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: TokensDto })
  data: TokensDto;
}

/**
 * Generic success message response
 */
export class MessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: { message: 'Operation completed successfully' } })
  data: {
    message: string;
  };
}
