import { Module } from '@nestjs/common';
import { ProductAdController } from './product-ad.controller';
import { ProductAdService } from './product-ad.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [ProductAdController],
  providers: [ProductAdService],
})
export class ProductAdModule {}
