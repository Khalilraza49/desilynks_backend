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
import { ChatService } from './chat.service';
import { GetMessagesDto } from './dto/get-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@GetUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatService.getMessages(
      userId,
      conversationId,
      dto.cursor,
      dto.limit,
    );
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.markAsRead(userId, conversationId);
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.deleteConversation(userId, conversationId);
  }

  @Get('unread-count')
  async getUnreadCount(@GetUser('id') userId: string) {
    const count = await this.chatService.getUnreadCount(userId);
    return { unreadCount: count };
  }
}
