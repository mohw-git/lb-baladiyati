import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/** Firebase `sendEachForMulticast` hard limit per request. */
export const FCM_MULTICAST_TOKEN_LIMIT = 500;

/**
 * Push-notification service backed by Firebase Cloud Messaging via the
 * official Admin SDK.
 *
 * Configuration:
 *   FIREBASE_SERVICE_ACCOUNT_PATH — path to a service-account JSON
 *   FIREBASE_SERVICE_ACCOUNT      — alternative: full JSON pasted as one
 *                                   environment variable
 *
 * If neither is configured the service degrades gracefully: in-app
 * notification records are still created, push delivery is skipped,
 * and a warning is logged. **Push failures must never block the
 * underlying business event** (complaint update, KYC review, etc.).
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.app = admin.app();
      return;
    }
    const credentials = this.loadServiceAccount();
    if (!credentials) {
      this.logger.warn(
        'Firebase service account not configured — FCM push delivery disabled.',
      );
      return;
    }
    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      this.logger.log(`Firebase Admin initialized for project ${credentials.projectId}.`);
    } catch (err) {
      this.logger.error(
        `Failed to init Firebase Admin: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
    }
  }

  private loadServiceAccount(): admin.ServiceAccount | null {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (raw) {
      try {
        return parseAccount(JSON.parse(raw));
      } catch (err) {
        this.logger.error(`FIREBASE_SERVICE_ACCOUNT JSON is invalid: ${(err as Error).message}`);
      }
    }
    const filePath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (filePath) {
      try {
        const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        if (fs.existsSync(abs)) {
          return parseAccount(JSON.parse(fs.readFileSync(abs, 'utf-8')));
        }
        this.logger.warn(`Firebase service-account file not found at ${abs}`);
      } catch (err) {
        this.logger.error(
          `Failed to read service account: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }
    return null;
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    return this.sendToUsers([userId], title, body, data);
  }

  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app) return;
    if (!userIds.length) return;

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (!tokens.length) {
      this.logger.debug(`No device tokens for ${userIds.length} user(s) — skipping push.`);
      return;
    }
    return this.sendToTokens(tokens.map((t) => t.token), title, body, data);
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app) return;
    if (!tokens.length) return;

    const messaging = admin.messaging(this.app);
    const invalidTokens: string[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    try {
      for (let offset = 0; offset < tokens.length; offset += FCM_MULTICAST_TOKEN_LIMIT) {
        const chunk = tokens.slice(offset, offset + FCM_MULTICAST_TOKEN_LIMIT);
        const result = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: data ?? {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'baladi-default',
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: { sound: 'default' },
            },
          },
        });

        totalSuccess += result.successCount;
        totalFailed += result.failureCount;

        result.responses.forEach((resp, i) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/invalid-argument'
            ) {
              invalidTokens.push(chunk[i]);
            } else {
              this.logger.warn(`FCM error for token chunk ${offset + i}: ${code}`);
            }
          }
        });
      }

      this.logger.debug(
        `FCM: ${totalSuccess} delivered, ${totalFailed} failed (${tokens.length} tokens, ${Math.ceil(tokens.length / FCM_MULTICAST_TOKEN_LIMIT)} chunk(s)).`,
      );

      if (invalidTokens.length) {
        await this.removeInvalidTokens(invalidTokens);
      }
    } catch (err) {
      // Never let push failures cascade. Log and continue.
      this.logger.error(
        `FCM batch send failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
    }
  }

  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } });
    this.logger.log(`Removed ${tokens.length} invalid FCM tokens.`);
  }
}

function parseAccount(json: any): admin.ServiceAccount {
  // Admin SDK accepts the camelCase ServiceAccount object directly.
  return {
    projectId: json.project_id ?? json.projectId,
    privateKey: (json.private_key ?? json.privateKey ?? '').replace(/\\n/g, '\n'),
    clientEmail: json.client_email ?? json.clientEmail,
  };
}
