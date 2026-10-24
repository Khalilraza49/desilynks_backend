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
import { ResourceHubService } from './resource-hub.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { GetAllResourceHubArticlesQueryDto } from './dto/get-all-resource-hub-articles-query.dto';

@Controller('resource-hub')
export class ResourceHubController {
  constructor(private readonly resourceHubService: ResourceHubService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllResourceHubArticles(
    @GetUser('id') userId: string | undefined,
    @Query() query: GetAllResourceHubArticlesQueryDto,
  ) {
    return this.resourceHubService.getAllResourceHubArticles(query, userId);
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async getSavedResourceHubArticles(
    @GetUser('id') userId: string,
    @Query() query: GetAllResourceHubArticlesQueryDto,
  ) {
    return this.resourceHubService.getSavedResourceHubArticles(userId, query);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async saveResourceHubArticle(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) articleId: string,
  ) {
    return this.resourceHubService.saveResourceHubArticle(userId, articleId);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  async unsaveResourceHubArticle(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) articleId: string,
  ) {
    return this.resourceHubService.unsaveResourceHubArticle(userId, articleId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getResourceHubArticleById(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resourceHubService.getResourceHubArticleById(id, userId);
  }
}
