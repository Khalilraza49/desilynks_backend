import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { SearchReindexService } from './search/search-reindex.service';

async function reindexSearch() {
  const logger = new Logger('Reindex');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    await app
      .get(SearchReindexService)
      .reindexAll(process.argv.includes('--fresh'));
    logger.log('Search reindex completed');
  } catch (error) {
    logger.error(
      'Search reindex failed',
      error instanceof Error ? error.stack : error,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }

  process.exit();
}

async function bootstrap() {
  if (process.argv.includes('reindex')) {
    return reindexSearch();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    maxAge: '365d',
    immutable: true,
  });

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const PORT = configService.get<string>('PORT');
  await app.listen(PORT ?? 3000);
}
bootstrap();
