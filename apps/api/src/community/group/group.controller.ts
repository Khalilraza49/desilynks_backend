import {
  Body,
  Controller,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GetAllGroupsQueryDto } from './dto/get-all-groups-query.dto';
import { GetUserGroupsQueryDto } from './dto/get-user-groups-query.dto';
import { GroupRoles } from '../common/decorators/group-roles.decorator';
import { GroupRoleGuard } from '../common/guards/group-role.guard';
import { CommunityGroupMemberRole } from '@generated/prisma';
import {
  tempStorage,
  imageFileFilter,
  MAX_COMMUNITY_GROUP_COVER_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('community/group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('coverPhoto', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_COMMUNITY_GROUP_COVER_SIZE },
    }),
  )
  async createGroup(
    @GetUser('id') userId: string,
    @Body() dto: CreateGroupDto,
    @UploadedFile(new OptimizeImagePipe({ coverPhoto: MAX_BANNER_DIMENSION }))
    coverPhoto?: Express.Multer.File,
  ) {
    return this.groupService.createGroup(userId, dto, coverPhoto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(CommunityGroupMemberRole.ADMIN)
  async updateGroupDetails(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupService.updateGroupDetails(groupId, dto);
  }

  @Patch(':id/cover-photo')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(CommunityGroupMemberRole.ADMIN)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('coverPhoto', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_COMMUNITY_GROUP_COVER_SIZE },
    }),
  )
  async updateGroupCover(
    @Param('id', ParseUUIDPipe) groupId: string,
    @UploadedFile(new OptimizeImagePipe({ coverPhoto: MAX_BANNER_DIMENSION }))
    coverPhoto?: Express.Multer.File,
  ) {
    if (!coverPhoto) {
      throw new BadRequestException('Provide a "coverPhoto" file to upload');
    }

    return this.groupService.updateGroupCover(groupId, coverPhoto);
  }

  @Get()
  async getAllGroups(@Query() query: GetAllGroupsQueryDto) {
    return this.groupService.getAllGroups(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserGroups(
    @GetUser('id') userId: string,
    @Query() query: GetUserGroupsQueryDto,
  ) {
    return this.groupService.getUserGroups(userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getGroupById(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
  ) {
    return this.groupService.getGroupById(userId, groupId);
  }

  @Patch(':id/toggle-archive')
  @UseGuards(JwtAuthGuard, GroupRoleGuard)
  @GroupRoles(CommunityGroupMemberRole.ADMIN)
  async toggleArchiveGroup(@Param('id', ParseUUIDPipe) groupId: string) {
    return this.groupService.toggleArchiveGroup(groupId);
  }
}
