import sharp from 'sharp';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  TEMP_UPLOADS_DIR,
  THUMBNAIL_DIMENSION,
  deleteTempFile,
  getThumbnailFilename,
} from './multer-config';

sharp.cache(false);

const OPTIMIZED_IMAGE_MIMETYPE = 'image/webp';
const OPTIMIZED_IMAGE_EXT = '.webp';
const OPTIMIZED_IMAGE_QUALITY = 80;
const THUMBNAIL_QUALITY = 70;
const MAX_INPUT_PIXELS = 50 * 1000 * 1000;

export async function optimizeTempImage(
  file: Express.Multer.File,
  maxDimension: number,
): Promise<void> {
  const filename = `${randomUUID()}${OPTIMIZED_IMAGE_EXT}`;
  const source = join(TEMP_UPLOADS_DIR, file.filename);
  const destination = join(TEMP_UPLOADS_DIR, filename);
  const thumbnailDestination = join(
    TEMP_UPLOADS_DIR,
    getThumbnailFilename(filename),
  );

  try {
    const info = await sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .autoOrient()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: OPTIMIZED_IMAGE_QUALITY })
      .toFile(destination);

    await sharp(destination)
      .resize({
        width: THUMBNAIL_DIMENSION,
        height: THUMBNAIL_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbnailDestination);

    deleteTempFile(file.filename);

    file.filename = filename;
    file.path = destination;
    file.mimetype = OPTIMIZED_IMAGE_MIMETYPE;
    file.size = info.size;
  } catch (error) {
    deleteTempFile(filename);
    throw error;
  }
}
