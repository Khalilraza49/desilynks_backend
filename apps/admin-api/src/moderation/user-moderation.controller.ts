import {
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UserModerationService } from './user-moderation.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserModerationController {
  constructor(private readonly userModerationService: UserModerationService) {}

  @Patch(':id/suspend')
  async suspendUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userModerationService.suspendUser(id);
  }

  @Patch(':id/unsuspend')
  async unsuspendUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userModerationService.unsuspendUser(id);
  }
}
