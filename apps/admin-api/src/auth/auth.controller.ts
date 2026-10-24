import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import {
  LOGIN_THROTTLE,
  OTP_REQUEST_THROTTLE,
  OTP_VERIFY_THROTTLE,
  SENSITIVE_ACTION_THROTTLE,
} from '@libs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GetAdmin } from './decorators/get-admin.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterSeedDto } from './dto/register-seed.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('seed-admin')
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  async seedAdmin(
    @Body() dto: RegisterSeedDto,
    @Headers('x-seed-key') seedKey?: string,
  ) {
    return this.authService.seedAdmin(dto, seedKey);
  }

  @Post('login')
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch('change-password')
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @GetAdmin('id') id: string,
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
  async logout(@Req() req: express.Request) {
    const accessToken = req['accessToken'] as string;
    return this.authService.logout(accessToken);
  }
}
