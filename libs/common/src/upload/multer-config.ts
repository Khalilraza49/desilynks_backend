import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join, parse } from 'path';
import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

// root dir
const UPLOADS_ROOT = join(process.cwd(), 'uploads');

// specific dir for each model
export const PROFILE_PHOTOS_DIR = join(UPLOADS_ROOT, 'profile-photos');
export const TEMP_UPLOADS_DIR = join(UPLOADS_ROOT, 'temp');
export const PROPERTY_PHOTOS_DIR = join(UPLOADS_ROOT, 'property-photos');
export const PROPERTY_VIDEOS_DIR = join(UPLOADS_ROOT, 'property-videos');
export const JOB_POSTER_DIR = join(UPLOADS_ROOT, 'job-posters');
export const WORKER_PROFILE_PHOTOS_DIR = join(
  UPLOADS_ROOT,
  'worker-profile-photos',
);
export const WORKER_WORK_PHOTOS_DIR = join(UPLOADS_ROOT, 'work-photos');
export const WORKER_CERTIFICATES_DIR = join(
  UPLOADS_ROOT,
  'worker-certificates',
);
export const NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR = join(
  UPLOADS_ROOT,
  'need-worker-req-ref-photos',
);
export const PRODUCT_AD_PHOTOS_DIR = join(UPLOADS_ROOT, 'product-photos');
export const PRODUCT_VIDEO_DIR = join(UPLOADS_ROOT, 'product-videos');
export const BUSINESS_LOGOS_DIR = join(UPLOADS_ROOT, 'business-logos');
export const BUSINESS_COVER_PHOTOS_DIR = join(
  UPLOADS_ROOT,
  'business-cover-photos',
);
export const BUSINESS_GALLERY_DIR = join(UPLOADS_ROOT, 'business-gallery');
export const COMMUNITY_POST_PHOTOS_DIR = join(
  UPLOADS_ROOT,
  'community-post-photos',
);
export const COMMUNITY_POST_VIDEOS_DIR = join(
  UPLOADS_ROOT,
  'community-post-videos',
);
export const COMMUNITY_GROUP_COVERS_DIR = join(
  UPLOADS_ROOT,
  'community-group-covers',
);
export const COMMUNITY_EVENT_BANNERS_DIR = join(
  UPLOADS_ROOT,
  'community-event-banners',
);
export const EXPLORE_COUNTRY_BANNERS_DIR = join(
  UPLOADS_ROOT,
  'explore-country-banners',
);
export const EXPLORE_COUNTRY_CITY_BANNERS_DIR = join(
  UPLOADS_ROOT,
  'explore-country-city-banners',
);
export const BANNER_AD_PHOTOS_DIR = join(UPLOADS_ROOT, 'banner-ad-photos');

// media allowed types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
];
const ALLOWED_CERTIFICATE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// media extensions
const MIMETYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
};

// max media size
export const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;
export const MAX_PROPERTY_PHOTO_SIZE = 3 * 1024 * 1024;
export const MAX_VIDEO_TOUR_SIZE = 50 * 1024 * 1024;
export const MAX_WORKER_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;
export const MAX_WORK_PHOTO_SIZE = 3 * 1024 * 1024;
export const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024;
export const MAX_JOB_POSTER_SIZE = 3 * 1024 * 1024;
export const MAX_NEED_A_WORKER_REF_IMAGE_SIZE = 3 * 1024 * 1024;
export const MAX_PRODUCT_PHOTO_SIZE = 3 * 1024 * 1024;
export const MAX_PRODUCT_VIDEO_SIZE = 50 * 1024 * 1024;
export const MAX_BUSINESS_LOGO_SIZE = 3 * 1024 * 1024;
export const MAX_BUSINESS_COVER_PHOTO_SIZE = 4 * 1024 * 1024;
export const MAX_BUSINESS_GALLERY_PHOTO_SIZE = 3 * 1024 * 1024;
export const MAX_COMMUNITY_POST_PHOTO_SIZE = 3 * 1024 * 1024;
export const MAX_COMMUNITY_POST_VIDEO_SIZE = 50 * 1024 * 1024;
export const MAX_COMMUNITY_GROUP_COVER_SIZE = 4 * 1024 * 1024;
export const MAX_COMMUNITY_EVENT_BANNER_SIZE = 4 * 1024 * 1024;
export const MAX_EXPLORE_COUNTRY_BANNER_SIZE = 4 * 1024 * 1024;
export const MAX_EXPLORE_COUNTRY_CITY_BANNER_SIZE = 3 * 1024 * 1024;
export const MAX_BANNER_AD_PHOTO_SIZE = 4 * 1024 * 1024;

// max image dimension
export const MAX_AVATAR_DIMENSION = 512;
export const MAX_PHOTO_DIMENSION = 1600;
export const MAX_BANNER_DIMENSION = 1920;
export const THUMBNAIL_DIMENSION = 480;

const THUMBNAIL_SUFFIX = '_thumb';

function ensureDirExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getThumbnailFilename(filename: string): string {
  const { name, ext } = parse(filename);
  return `${name}${THUMBNAIL_SUFFIX}${ext}`;
}

function moveThumbnailIfExists(filename: string, dir: string): void {
  const thumbnailFilename = getThumbnailFilename(filename);
  const source = join(TEMP_UPLOADS_DIR, thumbnailFilename);
  if (existsSync(source)) {
    renameSync(source, join(dir, thumbnailFilename));
  }
}

function deleteThumbnailIfExists(filename: string, dir: string): void {
  const filePath = join(dir, getThumbnailFilename(filename));
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export const tempStorage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirExists(TEMP_UPLOADS_DIR);
    cb(null, TEMP_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = MIMETYPE_EXTENSIONS[file.mimetype] ?? '';
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

export function moveFileToProfilePhotos(filename: string): string {
  ensureDirExists(PROFILE_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(PROFILE_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, PROFILE_PHOTOS_DIR);
  return `/uploads/profile-photos/${filename}`;
}

export function moveFileToPropertyPhotos(filename: string): string {
  ensureDirExists(PROPERTY_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(PROPERTY_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, PROPERTY_PHOTOS_DIR);
  return `/uploads/property-photos/${filename}`;
}

export function moveFileToJobPosters(filename: string): string {
  ensureDirExists(JOB_POSTER_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(JOB_POSTER_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, JOB_POSTER_DIR);
  return `/uploads/job-posters/${filename}`;
}

export function moveFileToPropertyVideos(filename: string): string {
  ensureDirExists(PROPERTY_VIDEOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(PROPERTY_VIDEOS_DIR, filename);
  renameSync(source, destination);
  return `/uploads/property-videos/${filename}`;
}

export function moveFileToWorkerProfilePhotos(filename: string): string {
  ensureDirExists(WORKER_PROFILE_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(WORKER_PROFILE_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, WORKER_PROFILE_PHOTOS_DIR);
  return `/uploads/worker-profile-photos/${filename}`;
}

export function moveFileToWorkPhotos(filename: string): string {
  ensureDirExists(WORKER_WORK_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(WORKER_WORK_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, WORKER_WORK_PHOTOS_DIR);
  return `/uploads/work-photos/${filename}`;
}

export function moveFileToWorkerCertificates(filename: string): string {
  ensureDirExists(WORKER_CERTIFICATES_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(WORKER_CERTIFICATES_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, WORKER_CERTIFICATES_DIR);
  return `/uploads/worker-certificates/${filename}`;
}

export function moveFileToNeedWorkerReqRefPhotos(filename: string): string {
  ensureDirExists(NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR);
  return `/uploads/need-worker-req-ref-photos/${filename}`;
}

export function moveFileToProductPhotos(filename: string): string {
  ensureDirExists(PRODUCT_AD_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(PRODUCT_AD_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, PRODUCT_AD_PHOTOS_DIR);
  return `/uploads/product-photos/${filename}`;
}

export function moveFileToProductVideo(filename: string): string {
  ensureDirExists(PRODUCT_VIDEO_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(PRODUCT_VIDEO_DIR, filename);
  renameSync(source, destination);
  return `/uploads/product-videos/${filename}`;
}

export function moveFileToBusinessLogos(filename: string): string {
  ensureDirExists(BUSINESS_LOGOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(BUSINESS_LOGOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, BUSINESS_LOGOS_DIR);
  return `/uploads/business-logos/${filename}`;
}

export function moveFileToBusinessCoverPhotos(filename: string): string {
  ensureDirExists(BUSINESS_COVER_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(BUSINESS_COVER_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, BUSINESS_COVER_PHOTOS_DIR);
  return `/uploads/business-cover-photos/${filename}`;
}

export function moveFileToBusinessGallery(filename: string): string {
  ensureDirExists(BUSINESS_GALLERY_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(BUSINESS_GALLERY_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, BUSINESS_GALLERY_DIR);
  return `/uploads/business-gallery/${filename}`;
}

export function moveFileToCommunityPostPhotos(filename: string): string {
  ensureDirExists(COMMUNITY_POST_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(COMMUNITY_POST_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, COMMUNITY_POST_PHOTOS_DIR);
  return `/uploads/community-post-photos/${filename}`;
}

export function moveFileToCommunityPostVideos(filename: string): string {
  ensureDirExists(COMMUNITY_POST_VIDEOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(COMMUNITY_POST_VIDEOS_DIR, filename);
  renameSync(source, destination);
  return `/uploads/community-post-videos/${filename}`;
}

export function moveFileToCommunityGroupCovers(filename: string): string {
  ensureDirExists(COMMUNITY_GROUP_COVERS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(COMMUNITY_GROUP_COVERS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, COMMUNITY_GROUP_COVERS_DIR);
  return `/uploads/community-group-covers/${filename}`;
}

export function moveFileToCommunityEventBanners(filename: string): string {
  ensureDirExists(COMMUNITY_EVENT_BANNERS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(COMMUNITY_EVENT_BANNERS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, COMMUNITY_EVENT_BANNERS_DIR);
  return `/uploads/community-event-banners/${filename}`;
}

export function moveFileToExploreCountryBanners(filename: string): string {
  ensureDirExists(EXPLORE_COUNTRY_BANNERS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(EXPLORE_COUNTRY_BANNERS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, EXPLORE_COUNTRY_BANNERS_DIR);
  return `/uploads/explore-country-banners/${filename}`;
}

export function moveFileToExploreCountryCityBanners(filename: string): string {
  ensureDirExists(EXPLORE_COUNTRY_CITY_BANNERS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(EXPLORE_COUNTRY_CITY_BANNERS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, EXPLORE_COUNTRY_CITY_BANNERS_DIR);
  return `/uploads/explore-country-city-banners/${filename}`;
}

export function moveFileToBannerAdPhotos(filename: string): string {
  ensureDirExists(BANNER_AD_PHOTOS_DIR);
  const source = join(TEMP_UPLOADS_DIR, filename);
  const destination = join(BANNER_AD_PHOTOS_DIR, filename);
  renameSync(source, destination);
  moveThumbnailIfExists(filename, BANNER_AD_PHOTOS_DIR);
  return `/uploads/banner-ad-photos/${filename}`;
}

export function deleteTempFile(filename: string): void {
  try {
    const filePath = join(TEMP_UPLOADS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, TEMP_UPLOADS_DIR);
  } catch {
    console.warn('Failed to delete temporary file');
  }
}

export function deleteProfilePhoto(filename: string): void {
  try {
    const filePath = join(PROFILE_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, PROFILE_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete profile photo');
  }
}

export function deletePropertyPhoto(filename: string): void {
  try {
    const filePath = join(PROPERTY_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, PROPERTY_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete property photo');
  }
}

export function deleteJobPoster(filename: string): void {
  try {
    const filePath = join(JOB_POSTER_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, JOB_POSTER_DIR);
  } catch {
    console.warn('Failed to delete job poster');
  }
}

export function deleteVideoTour(filename: string): void {
  try {
    const filePath = join(PROPERTY_VIDEOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    console.warn('Failed to delete video tour');
  }
}

export function deleteWorkerProfilePhoto(filename: string): void {
  try {
    const filePath = join(WORKER_PROFILE_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, WORKER_PROFILE_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete worker profile photo');
  }
}

export function deleteWorkPhoto(filename: string): void {
  try {
    const filePath = join(WORKER_WORK_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, WORKER_WORK_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete work photo');
  }
}

export function deleteWorkerCertificate(filename: string): void {
  try {
    const filePath = join(WORKER_CERTIFICATES_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, WORKER_CERTIFICATES_DIR);
  } catch {
    console.warn('Failed to delete worker certificate');
  }
}

export function deleteNeedWorkerRefPhoto(filename: string): void {
  try {
    const filePath = join(NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, NEED_A_WORKER_REQUEST_REF_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete need worker request reference photo');
  }
}

export function deleteProductPhoto(filename: string): void {
  try {
    const filePath = join(PRODUCT_AD_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, PRODUCT_AD_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete product ad photo');
  }
}

export function deleteProductVideo(filename: string): void {
  try {
    const filePath = join(PRODUCT_VIDEO_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    console.warn('Failed to delete product video');
  }
}

export function deleteBusinessLogo(filename: string): void {
  try {
    const filePath = join(BUSINESS_LOGOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, BUSINESS_LOGOS_DIR);
  } catch {
    console.warn('Failed to delete business logo');
  }
}

export function deleteBusinessCoverPhoto(filename: string): void {
  try {
    const filePath = join(BUSINESS_COVER_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, BUSINESS_COVER_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete business cover photo');
  }
}

export function deleteBusinessGalleryPhoto(filename: string): void {
  try {
    const filePath = join(BUSINESS_GALLERY_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, BUSINESS_GALLERY_DIR);
  } catch {
    console.warn('Failed to delete business gallery photo');
  }
}

export function deleteCommunityPostPhoto(filename: string): void {
  try {
    const filePath = join(COMMUNITY_POST_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, COMMUNITY_POST_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete community post photo');
  }
}

export function deleteCommunityPostVideo(filename: string): void {
  try {
    const filePath = join(COMMUNITY_POST_VIDEOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    console.warn('Failed to delete community post video');
  }
}

export function deleteCommunityGroupCover(filename: string): void {
  try {
    const filePath = join(COMMUNITY_GROUP_COVERS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, COMMUNITY_GROUP_COVERS_DIR);
  } catch {
    console.warn('Failed to delete community group cover');
  }
}

export function deleteCommunityEventBanner(filename: string): void {
  try {
    const filePath = join(COMMUNITY_EVENT_BANNERS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, COMMUNITY_EVENT_BANNERS_DIR);
  } catch {
    console.warn('Failed to delete community event banner');
  }
}

export function deleteExploreCountryBanner(filename: string): void {
  try {
    const filePath = join(EXPLORE_COUNTRY_BANNERS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, EXPLORE_COUNTRY_BANNERS_DIR);
  } catch {
    console.warn('Failed to delete explore country banner');
  }
}

export function deleteExploreCountryCityBanner(filename: string): void {
  try {
    const filePath = join(EXPLORE_COUNTRY_CITY_BANNERS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, EXPLORE_COUNTRY_CITY_BANNERS_DIR);
  } catch {
    console.warn('Failed to delete explore country city banner');
  }
}

export function deleteBannerAdPhoto(filename: string): void {
  try {
    const filePath = join(BANNER_AD_PHOTOS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    deleteThumbnailIfExists(filename, BANNER_AD_PHOTOS_DIR);
  } catch {
    console.warn('Failed to delete banner ad photo');
  }
}

export const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      ),
      false,
    );
  }
};

export const videoFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
      ),
      false,
    );
  }
};

export const imageOrVideoFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (file.fieldname === 'videoTour' || file.fieldname === 'video') {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Invalid video type: ${file.mimetype}. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
        ),
        false,
      );
    }
  } else {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Invalid image type: ${file.mimetype}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        ),
        false,
      );
    }
  }
};

export const workerProfileFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (file.fieldname === 'certificates') {
    if (ALLOWED_CERTIFICATE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Invalid certificate file type: ${file.mimetype}. Allowed types: ${ALLOWED_CERTIFICATE_TYPES.join(', ')}`,
        ),
        false,
      );
    }
  } else {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Invalid image type: ${file.mimetype}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        ),
        false,
      );
    }
  }
};
