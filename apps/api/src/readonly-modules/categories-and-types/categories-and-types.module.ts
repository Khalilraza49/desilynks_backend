import { Module } from '@nestjs/common';
import { CategoriesAndTypesController } from './categories-and-types.controller';
import { CategoriesAndTypesService } from './categories-and-types.service';

@Module({
  controllers: [CategoriesAndTypesController],
  providers: [CategoriesAndTypesService],
})
export class CategoriesAndTypesModule {}
