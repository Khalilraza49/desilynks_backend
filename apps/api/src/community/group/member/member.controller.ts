import {
  Controller,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Get,
  Query,
  Patch,
  Body,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { JwtAuthGuard } from '../../../auth/jwt.guard';
import { GetUser } from '../../../auth/decorators/get-user.decorator';
import { GroupRoleGuard } from '../../common/guards/group-role.guard';
import { GroupRoles } from '../../common/decorators/group-roles.decorator';
import { CommunityGroupMemberRole } from '@generated/prisma';
import { GetGroupMembersQueryDto } from './dto/get-group-members-query.dto';
import { GetAdminGroupMembersQueryDto } from './dto/get-admin-group-members-query.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('community/group/:groupId/member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinGroup(
    @GetUser() user: any,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.memberService.joinGroup(user, groupId);
  }

  @Delete('leave')
  @UseGuards(JwtAuthGuard)
  async leaveGroup(
    @GetUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.memberService.leaveGroup(userId, groupId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(
    CommunityGroupMemberRole.ADMIN,
    CommunityGroupMemberRole.MODERATOR,
  )
  async removeMember(
    @GetUser('id') requesterId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userIdToRemove: string,
  ) {
    return this.memberService.removeMember(
      requesterId,
      groupId,
      userIdToRemove,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getGroupMembers(
    @GetUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GetGroupMembersQueryDto,
  ) {
    return this.memberService.getGroupMembers(userId, groupId, query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(
    CommunityGroupMemberRole.ADMIN,
    CommunityGroupMemberRole.MODERATOR,
  )
  async getAdminGroupMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GetAdminGroupMembersQueryDto,
  ) {
    return this.memberService.getAdminGroupMembers(groupId, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyMembership(
    @GetUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.memberService.getMyMembership(userId, groupId);
  }

  @Patch(':userId/status')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(
    CommunityGroupMemberRole.ADMIN,
    CommunityGroupMemberRole.MODERATOR,
  )
  async updateMemberStatus(
    @GetUser('id') requesterId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userIdToUpdate: string,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    return this.memberService.updateMemberStatus(
      requesterId,
      groupId,
      userIdToUpdate,
      dto,
    );
  }

  @Patch(':userId/role')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(CommunityGroupMemberRole.ADMIN)
  async updateMemberRole(
    @GetUser('id') requesterId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userIdToUpdate: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.memberService.updateMemberRole(
      requesterId,
      groupId,
      userIdToUpdate,
      dto,
    );
  }
}
