import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { MemberController } from './member/member.controller';
import { MemberService } from './member/member.service';

@Module({
  controllers: [GroupController, MemberController],
  providers: [GroupService, MemberService],
})
export class GroupModule {}
