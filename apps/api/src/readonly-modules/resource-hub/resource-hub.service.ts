import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { Prisma } from '@generated/prisma';
import { GetAllResourceHubArticlesQueryDto } from './dto/get-all-resource-hub-articles-query.dto';

const articleListSelect = {
  id: true,
  category: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  writer: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ResourceHubArticleSelect;

@Injectable()
export class ResourceHubService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeArticle({ saves, ...article }: any) {
    return { ...article, isSaved: (saves?.length ?? 0) > 0 };
  }

  private buildArticleWhere(
    query: GetAllResourceHubArticlesQueryDto,
  ): Prisma.ResourceHubArticleWhereInput {
    const { search, category } = query;

    return {
      ...(category && { category }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };
  }

  async getAllResourceHubArticles(
    query: GetAllResourceHubArticlesQueryDto,
    userId?: string,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = this.buildArticleWhere(query);

    const [articles, count] = await Promise.all([
      this.prisma.resourceHubArticle.findMany({
        where,
        select: {
          ...articleListSelect,
          ...(userId && {
            saves: { where: { userId }, select: { id: true } },
          }),
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

  async getSavedResourceHubArticles(
    userId: string,
    query: GetAllResourceHubArticlesQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ResourceHubArticleSaveWhereInput = {
      userId,
      article: this.buildArticleWhere(query),
    };

    const [saves, count] = await Promise.all([
      this.prisma.resourceHubArticleSave.findMany({
        where,
        select: {
          createdAt: true,
          article: { select: articleListSelect },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resourceHubArticleSave.count({ where }),
    ]);

    return {
      data: saves.map(({ createdAt, article }) => ({
        ...article,
        isSaved: true,
        savedAt: createdAt,
      })),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getResourceHubArticleById(id: string, userId?: string) {
    const article = await this.prisma.resourceHubArticle.findUnique({
      where: { id },
      select: {
        ...articleListSelect,
        content: true,
        ...(userId && {
          saves: { where: { userId }, select: { id: true } },
        }),
      },
    });

    if (!article) {
      throw new NotFoundException('Resource hub article not found');
    }

    return { data: this.serializeArticle(article) };
  }

  // --- Resource Hub Save Methods ---

  async saveResourceHubArticle(userId: string, articleId: string) {
    const article = await this.prisma.resourceHubArticle.findUnique({
      where: { id: articleId },
      select: { id: true },
    });

    if (!article) {
      throw new NotFoundException('Resource hub article not found');
    }

    await this.prisma.resourceHubArticleSave.upsert({
      where: {
        userId_articleId: { userId, articleId },
      },
      update: {},
      create: {
        userId,
        articleId,
      },
    });

    return {
      saved: true,
    };
  }

  async unsaveResourceHubArticle(userId: string, articleId: string) {
    await this.prisma.resourceHubArticleSave.deleteMany({
      where: {
        userId,
        articleId,
      },
    });

    return {
      saved: false,
    };
  }
}
