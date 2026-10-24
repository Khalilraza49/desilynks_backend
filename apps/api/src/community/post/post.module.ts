import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { CommentController } from './comment/comment.controller';
import { CommentService } from './comment/comment.service';
import { PollController } from './poll/poll.controller';
import { PollService } from './poll/poll.service';
import { InteractionController } from './interaction/interaction.controller';
import { InteractionService } from './interaction/interaction.service';
import { ModerationModule } from '../../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [
    PostController,
    CommentController,
    PollController,
    InteractionController,
  ],
  providers: [PostService, CommentService, PollService, InteractionService],
})
export class PostModule {}
