import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { elasticsearchConfig } from './elasticsearch.config';
import { SearchService } from './search.service';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(elasticsearchConfig),
    NestElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        nodes: configService.getOrThrow<string[]>('elasticsearch.nodes'),
        maxRetries: configService.getOrThrow<number>(
          'elasticsearch.maxRetries',
        ),
        requestTimeout: configService.getOrThrow<number>(
          'elasticsearch.requestTimeout',
        ),
        sniffOnStart: configService.getOrThrow<boolean>(
          'elasticsearch.sniffOnStart',
        ),
        ...(configService.get<string>('elasticsearch.password')
          ? {
              auth: {
                username: configService.get<string>('elasticsearch.username')!,
                password: configService.get<string>('elasticsearch.password')!,
              },
            }
          : {}),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SearchService],
  exports: [SearchService],
})
export class ElasticSearchModule {}
