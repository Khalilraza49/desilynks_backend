import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { MailSubject, MailTemplate } from './constants/mail-constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendOtpEmail(
    email: string,
    fullName: string,
    otp: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: MailSubject.OTP,
        template: MailTemplate.OTP,
        context: {
          fullName,
          otp,
        },
      });

      this.logger.log(`OTP email sent successfully to ${email}`);
      return {
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`Failed to send otp email to ${email}`, err);
      return {
        success: false,
      };
    }
  }

  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    otp: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: MailSubject.RESET_PASSWORD,
        template: MailTemplate.RESET_PASSWORD,
        context: {
          fullName,
          otp,
        },
      });

      this.logger.log(`Reset password email sent successfully to ${email}`);
      return {
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`Failed to send reset password email to ${email}`, err);
      return {
        success: false,
      };
    }
  }

  async sendWelcomeEmail(
    email: string,
    fullName: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: MailSubject.WELCOME,
        template: MailTemplate.WELCOME,
        context: {
          fullName,
        },
      });

      return {
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`Failed to sent welcome email to ${email}`);
      return {
        success: false,
      };
    }
  }
}
