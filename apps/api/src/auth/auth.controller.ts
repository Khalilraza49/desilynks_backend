import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto, AppleLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard } from './jwt.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GetUser } from './decorators/get-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_PROFILE_PHOTO_SIZE,
  MAX_AVATAR_DIMENSION,
  OptimizeImagePipe,
  LOGIN_THROTTLE,
  OTP_REQUEST_THROTTLE,
  OTP_VERIFY_THROTTLE,
  OTP_RESEND_THROTTLE,
  SENSITIVE_ACTION_THROTTLE,
  TOKEN_REFRESH_THROTTLE,
} from '@libs/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(OTP_REQUEST_THROTTLE)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_PROFILE_PHOTO_SIZE },
    }),
  )
  async register(
    @Body() dto: RegisterUserDto,
    @UploadedFile(new OptimizeImagePipe({ profilePhoto: MAX_AVATAR_DIMENSION }))
    file?: Express.Multer.File,
  ) {
    return this.authService.register(dto, file);
  }

  @Post('verify-otp')
  @Throttle(OTP_VERIFY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @Throttle(OTP_RESEND_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google-login')
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('apple-login')
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
  }

  @Post('refresh')
  @Throttle(TOKEN_REFRESH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Patch('change-password')
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @GetUser('id') id: string,
  ) {
    return this.authService.changePassword(id, dto);
  }

  @Post('forgot-password')
  @Throttle(OTP_REQUEST_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Patch('reset-password')
  @Throttle(OTP_VERIFY_THROTTLE)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: express.Request, @Body() dto: LogoutDto) {
    const accessToken = req['accessToken'] as string;
    return this.authService.logout(accessToken, dto.refreshToken);
  }
}
