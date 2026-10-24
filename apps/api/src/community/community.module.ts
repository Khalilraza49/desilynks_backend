import { Module } from '@nestjs/common';
import { GroupModule } from './group/group.module';
import { PostModule } from './post/post.module';
import { EventModule } from './event/event.module';

@Module({
  imports: [GroupModule, PostModule, EventModule],
})
export class CommunityModule {}
