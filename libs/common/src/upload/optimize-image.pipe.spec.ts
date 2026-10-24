import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { OptimizeImagePipe } from './optimize-image.pipe';
import {
  MAX_AVATAR_DIMENSION,
  MAX_PHOTO_DIMENSION,
  PROFILE_PHOTOS_DIR,
  TEMP_UPLOADS_DIR,
  THUMBNAIL_DIMENSION,
  deleteProfilePhoto,
  deleteTempFile,
  getThumbnailFilename,
  moveFileToProfilePhotos,
} from './multer-config';

describe('OptimizeImagePipe', () => {
  let createdFilenames: string[];

  const tempPath = (filename: string) => join(TEMP_UPLOADS_DIR, filename);

  const toMulterFile = (
    fieldname: string,
    filename: string,
    mimetype: string,
  ) => {
    createdFilenames.push(filename);
    return {
      fieldname,
      originalname: `original-${filename}`,
      mimetype,
      filename,
      destination: TEMP_UPLOADS_DIR,
      path: tempPath(filename),
      size: statSync(tempPath(filename)).size,
    } as Express.Multer.File;
  };

  const createJpeg = async (
    fieldname: string,
    width: number,
    height: number,
  ) => {
    const filename = `${randomUUID()}.jpg`;
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 200, g: 120, b: 40 },
      },
    })
      .jpeg()
      .withExif({
        IFD0: { ImageDescription: 'private description' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' },
      })
      .withMetadata({ orientation: 6 })
      .toFile(tempPath(filename));
    return toMulterFile(fieldname, filename, 'image/jpeg');
  };

  const createPng = async (
    fieldname: string,
    width: number,
    height: number,
  ) => {
    const filename = `${randomUUID()}.png`;
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toFile(tempPath(filename));
    return toMulterFile(fieldname, filename, 'image/png');
  };

  const createRawFile = (
    fieldname: string,
    extension: string,
    mimetype: string,
  ) => {
    const filename = `${randomUUID()}${extension}`;
    writeFileSync(tempPath(filename), 'this is not an image');
    return toMulterFile(fieldname, filename, mimetype);
  };

  beforeEach(() => {
    createdFilenames = [];
    mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
  });

  afterEach(() => {
    for (const filename of createdFilenames) {
      deleteTempFile(filename);
    }
  });

  it('should return undefined when no file was uploaded', async () => {
    const pipe = new OptimizeImagePipe({ photo: MAX_PHOTO_DIMENSION });

    await expect(pipe.transform(undefined)).resolves.toBeUndefined();
  });

  it('should convert, auto-orient, resize and strip metadata of an image', async () => {
    const file = await createJpeg('profilePhoto', 4000, 3000);
    const originalFilename = file.filename;
    const pipe = new OptimizeImagePipe({ profilePhoto: MAX_AVATAR_DIMENSION });

    await pipe.transform(file);
    createdFilenames.push(file.filename);

    expect(file.filename).toMatch(/\.webp$/);
    expect(file.mimetype).toBe('image/webp');
    expect(file.path).toBe(tempPath(file.filename));
    expect(file.size).toBe(statSync(tempPath(file.filename)).size);
    expect(existsSync(tempPath(originalFilename))).toBe(false);

    const metadata = await sharp(tempPath(file.filename)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(384);
    expect(metadata.height).toBe(MAX_AVATAR_DIMENSION);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();

    const thumbnailPath = tempPath(getThumbnailFilename(file.filename));
    const thumbnailMetadata = await sharp(thumbnailPath).metadata();
    expect(thumbnailMetadata.format).toBe('webp');
    expect(thumbnailMetadata.width).toBe(360);
    expect(thumbnailMetadata.height).toBe(THUMBNAIL_DIMENSION);
  });

  it('should keep transparency and never enlarge small images', async () => {
    const file = await createPng('photos', 300, 200);
    const pipe = new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION });

    await pipe.transform([file]);
    createdFilenames.push(file.filename);

    const metadata = await sharp(tempPath(file.filename)).metadata();
    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(200);
    expect(metadata.hasAlpha).toBe(true);

    const thumbnailMetadata = await sharp(
      tempPath(getThumbnailFilename(file.filename)),
    ).metadata();
    expect(thumbnailMetadata.width).toBe(300);
    expect(thumbnailMetadata.height).toBe(200);
  });

  it('should only optimize image fields listed in the dimensions map', async () => {
    const photo = await createJpeg('photos', 2000, 1000);
    const video = createRawFile('video', '.mp4', 'video/mp4');
    const certificate = createRawFile(
      'certificates',
      '.pdf',
      'application/pdf',
    );
    const unlistedPhoto = await createJpeg('gallery', 800, 600);
    const videoFilename = video.filename;
    const certificateFilename = certificate.filename;
    const unlistedPhotoFilename = unlistedPhoto.filename;
    const pipe = new OptimizeImagePipe({
      photos: MAX_PHOTO_DIMENSION,
      certificates: MAX_PHOTO_DIMENSION,
    });

    await pipe.transform({
      photos: [photo],
      video: [video],
      certificates: [certificate],
      gallery: [unlistedPhoto],
    });
    createdFilenames.push(photo.filename);

    expect(photo.mimetype).toBe('image/webp');
    expect(video.filename).toBe(videoFilename);
    expect(video.mimetype).toBe('video/mp4');
    expect(certificate.filename).toBe(certificateFilename);
    expect(certificate.mimetype).toBe('application/pdf');
    expect(unlistedPhoto.filename).toBe(unlistedPhotoFilename);
    expect(unlistedPhoto.mimetype).toBe('image/jpeg');
    expect(existsSync(tempPath(videoFilename))).toBe(true);
    expect(existsSync(tempPath(certificateFilename))).toBe(true);
    expect(existsSync(tempPath(unlistedPhotoFilename))).toBe(true);
  });

  it('should reject a fake image and remove every temp file of the request', async () => {
    const validPhoto = await createJpeg('photos', 1200, 900);
    const fakePhoto = createRawFile('photos', '.jpg', 'image/jpeg');
    const fakePhotoFilename = fakePhoto.filename;
    const pipe = new OptimizeImagePipe({ photos: MAX_PHOTO_DIMENSION });

    await expect(pipe.transform([validPhoto, fakePhoto])).rejects.toThrow(
      BadRequestException,
    );
    createdFilenames.push(validPhoto.filename);

    expect(existsSync(tempPath(validPhoto.filename))).toBe(false);
    expect(
      existsSync(tempPath(getThumbnailFilename(validPhoto.filename))),
    ).toBe(false);
    expect(existsSync(tempPath(fakePhotoFilename))).toBe(false);
  });

  it('should move and delete the thumbnail together with the image', async () => {
    const file = await createJpeg('profilePhoto', 1000, 800);
    const pipe = new OptimizeImagePipe({ profilePhoto: MAX_AVATAR_DIMENSION });

    await pipe.transform(file);
    createdFilenames.push(file.filename);

    const thumbnailFilename = getThumbnailFilename(file.filename);
    const url = moveFileToProfilePhotos(file.filename);

    expect(url).toBe(`/uploads/profile-photos/${file.filename}`);
    expect(existsSync(join(PROFILE_PHOTOS_DIR, file.filename))).toBe(true);
    expect(existsSync(join(PROFILE_PHOTOS_DIR, thumbnailFilename))).toBe(true);
    expect(existsSync(tempPath(thumbnailFilename))).toBe(false);

    deleteProfilePhoto(file.filename);

    expect(existsSync(join(PROFILE_PHOTOS_DIR, file.filename))).toBe(false);
    expect(existsSync(join(PROFILE_PHOTOS_DIR, thumbnailFilename))).toBe(false);
  });
});
