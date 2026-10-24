import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert } from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import { FcmTokenService } from './fcm-token.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => FcmTokenService))
    private readonly fcmTokenService: FcmTokenService,
  ) {}

  onModuleInit() {
    const serviceAccountPath = this.configService.get(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );

    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new Error(
          'Firebase service account not found. Push notifications are required in production.',
        );
      }

      this.logger.warn(
        'Firebase service account not found. Push notifications disabled.',
      );
      return;
    }

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf-8'),
      );

      initializeApp({
        credential: cert(serviceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized');
    }

    this.isInitialized = true;
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    badge?: number,
  ): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await getMessaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: badge ?? 1,
              'content-available': 1,
              'mutable-content': 1,
            },
          },
        },
      });
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      this.logger.error(
        `Failed to send FCM to token ${token}:`,
        error?.message,
      );
      await this.handleTokenError(error, token);
    }
  }

  async sendMulticastNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    badge?: number,
  ): Promise<void> {
    if (!this.isInitialized || tokens.length === 0) return;

    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: badge ?? 1,
              'content-available': 1,
              'mutable-content': 1,
            },
          },
        },
      });

      this.logger.log(
        `FCM multicast: ${response.successCount} success, ${response.failureCount} failed`,
      );

      if (response.failureCount > 0) {
        const staleTokens: string[] = [];

        response.responses.forEach((resp, index) => {
          if (
            !resp.success &&
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            staleTokens.push(tokens[index]);
          }
        });

        if (staleTokens.length > 0) {
          await this.fcmTokenService.removeStaleTokens(staleTokens);
          this.logger.warn(`Removed ${staleTokens.length} stale FCM tokens`);
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error('FCM multicast failed:', error.message);
    }
  }

  private async handleTokenError(
    err: { message?: string; code?: string },
    token: string,
  ): Promise<void> {
    const staleErrorCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ];

    if (err?.code && staleErrorCodes.includes(err.code)) {
      await this.fcmTokenService.removeToken(token);
      this.logger.warn(`Removed stale FCM token: ${token.substring(0, 20)}...`);
    }
  }
}
