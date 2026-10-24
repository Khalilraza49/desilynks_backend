import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResourceHubService } from './resource-hub.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetAdmin } from '../auth/decorators/get-admin.decorator';
import { CreateResourceHubArticleDto } from './dto/create-resource-hub-article.dto';
import { UpdateResourceHubArticleDto } from './dto/update-resource-hub-article.dto';
import { GetAllResourceHubArticlesQueryDto } from './dto/get-all-resource-hub-articles-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('resource-hub')
export class ResourceHubController {
  constructor(private readonly resourceHubService: ResourceHubService) {}

  @Post()
  async createResourceHubArticle(
    @Body() dto: CreateResourceHubArticleDto,
    @GetAdmin('id') adminId: string,
  ) {
    return this.resourceHubService.createResourceHubArticle(adminId, dto);
  }

  @Get()
  async getAllResourceHubArticles(
    @Query() query: GetAllResourceHubArticlesQueryDto,
  ) {
    return this.resourceHubService.getAllResourceHubArticles(query);
  }

  @Get(':id')
  async getResourceHubArticleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourceHubService.getResourceHubArticleById(id);
  }

  @Patch(':id')
  async updateResourceHubArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceHubArticleDto,
  ) {
    return this.resourceHubService.updateResourceHubArticle(id, dto);
  }

  @Delete(':id')
  async deleteResourceHubArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.resourceHubService.deleteResourceHubArticle(id);
  }
}
