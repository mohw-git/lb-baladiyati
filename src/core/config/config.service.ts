import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { resolveUploadRoot } from '../storage/upload-path.util';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL')!;
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET')!;
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('JWT_EXPIRATION', '7d');
  }

  get uploadPath(): string {
    return resolveUploadRoot(this.configService.get<string>('UPLOAD_PATH'));
  }

  get maxFileSize(): number {
    return this.configService.get<number>('MAX_FILE_SIZE', 10485760);
  }

  get fcmServerKey(): string | undefined {
    return this.configService.get<string>('FCM_SERVER_KEY');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
