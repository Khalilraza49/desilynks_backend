export const MailTemplate = {
  OTP: 'otp',
  RESET_PASSWORD: 'reset-password',
  WELCOME: 'welcome',
} as const;

export const MailSubject = {
  OTP: 'Verify Your Email Address',
  RESET_PASSWORD: 'Reset Your Password',
  WELCOME: 'Welcome to DesiLynks',
} as const;
