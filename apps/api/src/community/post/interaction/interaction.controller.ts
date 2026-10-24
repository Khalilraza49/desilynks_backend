import {
  Controller,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { InteractionService } from './interaction.service';
import { JwtAuthGuard } from '../../../auth/jwt.guard';
import { GetUser } from '../../../auth/decorators/get-user.decorator';

@Controller('community/post/:postId/interaction')
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Post('like')
  @UseGuards(JwtAuthGuard)
  async likePost(
    @GetUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionService.likePost(user, postId);
  }

  @Delete('like')
  @UseGuards(JwtAuthGuard)
  async unlikePost(
    @GetUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionService.unlikePost(user, postId);
  }

  @Post('share')
  @UseGuards(JwtAuthGuard)
  async sharePost(
    @GetUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.interactionService.sharePost(user, postId);
  }
}
