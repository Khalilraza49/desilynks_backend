import {
  Body,
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/jwt.guard';
import { GetUser } from '../../../auth/decorators/get-user.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { GetMyCommentsQueryDto } from './dto/get-my-comments-query.dto';

@Controller('community/post/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createComment(@GetUser() user: any, @Body() dto: CreateCommentDto) {
    return this.commentService.createComment(user, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyComments(
    @GetUser('id') userId: string,
    @Query() query: GetMyCommentsQueryDto,
  ) {
    return this.commentService.getMyComments(userId, query);
  }

  @Get(':postId')
  @UseGuards(JwtAuthGuard)
  async getComments(
    @GetUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentService.getComments(userId, postId, query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentService.deleteComment(userId, commentId);
  }
}
