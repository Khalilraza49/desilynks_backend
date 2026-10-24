import { BadRequestException, Logger, PipeTransform } from '@nestjs/common';
import { ALLOWED_IMAGE_TYPES, deleteTempFile } from './multer-config';
import { optimizeTempImage } from './image-optimizer';

type UploadedFileValue =
  | Express.Multer.File
  | Express.Multer.File[]
  | Record<string, Express.Multer.File[]>;

export class OptimizeImagePipe implements PipeTransform {
  private readonly logger = new Logger(OptimizeImagePipe.name);

  constructor(private readonly dimensions: Record<string, number>) {}

  async transform(value?: UploadedFileValue) {
    if (!value) {
      return value;
    }

    const files = this._collectFiles(value);

    try {
      for (const file of files) {
        const maxDimension = this.dimensions[file.fieldname];

        if (!maxDimension || !ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          continue;
        }

        await optimizeTempImage(file, maxDimension);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to optimize uploaded image: ${error instanceof Error ? error.message : error}`,
      );

      for (const file of files) {
        deleteTempFile(file.filename);
      }

      throw new BadRequestException('Invalid or corrupted image file');
    }

    return value;
  }

  private _collectFiles(value: UploadedFileValue): Express.Multer.File[] {
    if (Array.isArray(value)) {
      return value;
    }

    if ('fieldname' in value) {
      return [value as Express.Multer.File];
    }

    return Object.values(value).flat();
  }
}
