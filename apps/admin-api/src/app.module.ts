import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  PrismaModule,
  MailModule,
  RedisModule,
  RedisService,
  ElasticSearchModule,
  SessionModule,
  ContentRemovalModule,
  AdminEnvironmentVariables,
  createThrottlerOptions,
  validateEnv,
} from '@libs/common';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CategoryModule } from './category/category.module';
import { ExploreCountryModule } from './explore-country/explore-country.module';
import { ResourceHubModule } from './resource-hub/resource-hub.module';
import { ModerationModule } from './moderation/moderation.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv(AdminEnvironmentVariables),
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => createThrottlerOptions(redis),
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    RedisModule,
    ElasticSearchModule,
    SessionModule,
    ContentRemovalModule,
    AdminModule,
    CategoryModule,
    ExploreCountryModule,
    ResourceHubModule,
    ModerationModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
