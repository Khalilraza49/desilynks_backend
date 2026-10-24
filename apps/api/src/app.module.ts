import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  PrismaModule,
  RedisModule,
  RedisService,
  ElasticSearchModule,
  FirebaseModule,
  MailModule,
  SessionModule,
  ContentRemovalModule,
  ApiEnvironmentVariables,
  createThrottlerOptions,
  validateEnv,
} from '@libs/common';
import { UserModule } from './user/user.module';
import { PropertyModule } from './property/property.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { JobModule } from './job/job.module';
import { WorkerProfileModule } from './worker-profile/worker-profile.module';
import { NeedAWorkerModule } from './need-a-worker/need-a-worker.module';
import { ProductAdModule } from './product-ad/product-ad.module';
import { BusinessListingModule } from './business-listing/business-listing.module';
import { ChatModule } from './chat/chat.module';
import { CommunityModule } from './community/community.module';
import { NotificationModule } from './notification/notification.module';
import { CategoriesAndTypesModule } from './readonly-modules/categories-and-types/categories-and-types.module';
import { ExploreCountryModule } from './readonly-modules/explore-country/explore-country.module';
import { ResourceHubModule } from './readonly-modules/resource-hub/resource-hub.module';
import { BannerAdModule } from './banner-ad/banner-ad.module';
import { SearchModule } from './search/search.module';
import { ModerationModule } from './moderation/moderation.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv(ApiEnvironmentVariables),
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => createThrottlerOptions(redis),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    UserModule,
    TasksModule,
    PropertyModule,
    JobModule,
    WorkerProfileModule,
    ElasticSearchModule,
    NeedAWorkerModule,
    ProductAdModule,
    BusinessListingModule,
    FirebaseModule,
    ChatModule,
    CommunityModule,
    NotificationModule,
    CategoriesAndTypesModule,
    ExploreCountryModule,
    ResourceHubModule,
    BannerAdModule,
    SessionModule,
    ContentRemovalModule,
    SearchModule,
    ModerationModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
