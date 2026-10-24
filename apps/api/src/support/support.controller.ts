import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SUPPORT_THROTTLE } from '@libs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SupportService } from './support.service';
import { CreateSupportFormDto } from './dto/create-support-form.dto';

@Controller('support-form')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @Throttle(SUPPORT_THROTTLE)
  @UseGuards(OptionalJwtAuthGuard)
  async createSupportForm(
    @GetUser('id') userId: string | undefined,
    @Body() dto: CreateSupportFormDto,
  ) {
    return this.supportService.createSupportForm(userId, dto);
  }
}
