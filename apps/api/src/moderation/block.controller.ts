import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BlockService } from './block.service';
import { GetBlockedUsersQueryDto } from './dto/get-blocked-users-query.dto';

@Controller('block')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBlockedUsers(
    @GetUser('id') userId: string,
    @Query() query: GetBlockedUsersQueryDto,
  ) {
    return this.blockService.getBlockedUsers(userId, query);
  }

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @GetUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) blockedUserId: string,
  ) {
    return this.blockService.blockUser(userId, blockedUserId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  async unblockUser(
    @GetUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) blockedUserId: string,
  ) {
    return this.blockService.unblockUser(userId, blockedUserId);
  }
}
