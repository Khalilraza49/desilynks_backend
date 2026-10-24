import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPublicFeedQueryDto } from './dto/get-public-feed-query.dto';
import { GetGroupPostsQueryDto } from './dto/get-group-posts-query.dto';
import { GetMyPostsQueryDto } from './dto/get-my-posts-query.dto';
import {
  tempStorage,
  imageOrVideoFileFilter,
  MAX_COMMUNITY_POST_VIDEO_SIZE,
  MAX_PHOTO_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('community/post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photos', maxCount: 5 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: tempStorage,
        fileFilter: imageOrVideoFileFilter,
        limits: { fileSize: MAX_COMMUNITY_POST_VIDEO_SIZE },
      },
    ),
  )
  async createPost(
    @GetUser('id') userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles(new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION }))
    files: {
      photos?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    return this.postService.createPost(userId, dto, files || {});
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getPublicFeed(
    @GetUser('id') userId: string,
    @Query() query: GetPublicFeedQueryDto,
  ) {
    return this.postService.getPublicFeed(userId, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyPosts(
    @GetUser('id') userId: string,
    @Query() query: GetMyPostsQueryDto,
  ) {
    return this.postService.getMyPosts(userId, query);
  }

  @Get('group/:groupId')
  @UseGuards(JwtAuthGuard)
  async getGroupPosts(
    @GetUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GetGroupPostsQueryDto,
  ) {
    return this.postService.getGroupPosts(userId, groupId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPostById(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postService.getPostById(userId, postId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deletePost(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postService.deletePost(userId, postId);
  }
}
