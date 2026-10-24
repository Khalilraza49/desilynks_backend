import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { FcmTokenService } from '@libs/common';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

@Controller('fcm-token')
@UseGuards(JwtAuthGuard)
export class FcmTokenController {
  constructor(private readonly fcmTokenService: FcmTokenService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async registerToken(
    @GetUser('id') userId: string,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    await this.fcmTokenService.registerToken(userId, dto.token, dto.device);
    return { message: 'FCM token registered successfully' };
  }

  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  async removeToken(@Body() dto: RegisterFcmTokenDto) {
    await this.fcmTokenService.removeToken(dto.token);
    return { message: 'FCM token removed successfully' };
  }
}
