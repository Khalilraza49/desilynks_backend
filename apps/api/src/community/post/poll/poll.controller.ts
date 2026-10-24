import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PollService } from './poll.service';
import { JwtAuthGuard } from '../../../auth/jwt.guard';
import { GetUser } from '../../../auth/decorators/get-user.decorator';
import { CastVoteDto } from './dto/cast-vote.dto';

@Controller('community/post/:postId/poll')
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post('vote')
  @UseGuards(JwtAuthGuard)
  async castVote(
    @GetUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CastVoteDto,
  ) {
    return this.pollService.castVote(userId, postId, dto.optionId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getPollResults(
    @GetUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.pollService.getPollResults(userId, postId);
  }
}
