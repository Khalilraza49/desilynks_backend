import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { Prisma } from '@generated/prisma';
import { CreateResourceHubArticleDto } from './dto/create-resource-hub-article.dto';
import { UpdateResourceHubArticleDto } from './dto/update-resource-hub-article.dto';
import { GetAllResourceHubArticlesQueryDto } from './dto/get-all-resource-hub-articles-query.dto';

const writerSelect = {
  select: { id: true, firstName: true, lastName: true },
};

@Injectable()
export class ResourceHubService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeArticle({ _count, ...article }: any) {
    return { ...article, savesCount: _count.saves };
  }

  async createResourceHubArticle(
    adminId: string,
    dto: CreateResourceHubArticleDto,
  ) {
    const article = await this.prisma.resourceHubArticle.create({
      data: {
        category: dto.category,
        title: dto.title,
        content: dto.content,
        writerId: adminId,
      },
      include: {
        writer: writerSelect,
      },
    });

    return {
      message: 'Resource hub article created successfully',
      data: article,
    };
  }

  async getAllResourceHubArticles(query: GetAllResourceHubArticlesQueryDto) {
    const { page = 1, limit = 10, search, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ResourceHubArticleWhereInput = {
      ...(category && { category }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    const [articles, count] = await Promise.all([
      this.prisma.resourceHubArticle.findMany({
        where,
        select: {
          id: true,
          category: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          writer: writerSelect,
          _count: { select: { saves: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resourceHubArticle.count({ where }),
    ]);

    return {
      data: articles.map((article) => this.serializeArticle(article)),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getResourceHubArticleById(id: string) {
    const article = await this.prisma.resourceHubArticle.findUnique({
      where: { id },
      include: {
        writer: writerSelect,
        _count: { select: { saves: true } },
      },
    });

    if (!article) {
      throw new NotFoundException('Resource hub article not found');
    }

    return { data: this.serializeArticle(article) };
  }

  async updateResourceHubArticle(id: string, dto: UpdateResourceHubArticleDto) {
    const article = await this.prisma.resourceHubArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Resource hub article not found');
    }

    const updatedArticle = await this.prisma.resourceHubArticle.update({
      where: { id },
      data: {
        category: dto.category,
        title: dto.title,
        content: dto.content,
      },
      include: {
        writer: writerSelect,
      },
    });

    return {
      message: 'Resource hub article updated successfully',
      data: updatedArticle,
    };
  }

  async deleteResourceHubArticle(id: string) {
    const article = await this.prisma.resourceHubArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Resource hub article not found');
    }

    await this.prisma.resourceHubArticle.delete({ where: { id } });

    return { message: 'Resource hub article deleted successfully' };
  }
}
