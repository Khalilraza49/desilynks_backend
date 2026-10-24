import {
  BusinessListingStatus,
  JobStatus,
  ProductAdStatus,
  PropertyStatus,
} from '@generated/prisma';
import { ES_INDEX, type EsIndexName } from './index-names';

export const MAX_SEARCH_WINDOW = 10000;

export const MAX_SEARCH_PAGE_SIZE = 50;

export const PUBLIC_PROPERTY_STATUSES = [
  PropertyStatus.PUBLISHED,
  PropertyStatus.RENTED,
];

export const PUBLIC_JOB_STATUSES = [JobStatus.OPEN, JobStatus.CLOSED];

export const PUBLIC_PRODUCT_AD_STATUSES = [ProductAdStatus.ACTIVE];

export const PUBLIC_BUSINESS_LISTING_STATUSES = [BusinessListingStatus.ACTIVE];

export const PUBLIC_STATUSES: Partial<Record<EsIndexName, string[]>> = {
  [ES_INDEX.PROPERTIES]: PUBLIC_PROPERTY_STATUSES,
  [ES_INDEX.JOBS]: PUBLIC_JOB_STATUSES,
  [ES_INDEX.PRODUCT_ADS]: PUBLIC_PRODUCT_AD_STATUSES,
  [ES_INDEX.BUSINESS_LISTINGS]: PUBLIC_BUSINESS_LISTING_STATUSES,
};

export const PROPERTY_SORT_FIELDS = [
  '_score',
  'createdAt',
  'monthlyRent',
  'noOfBedRooms',
  'noOfBathRooms',
  'availableFrom',
  'viewsCount',
];

export const JOB_SORT_FIELDS = ['_score', 'createdAt', 'salary'];

export const WORKER_PROFILE_SORT_FIELDS = [
  '_score',
  'createdAt',
  'hourlyRate',
  'dailyRate',
  'experienceInYears',
];

export const PRODUCT_AD_SORT_FIELDS = [
  '_score',
  'createdAt',
  'price',
  'viewsCount',
];

export const NEED_A_WORKER_SORT_FIELDS = [
  '_score',
  'createdAt',
  'budget',
  'dateNeeded',
];

export const BUSINESS_LISTING_SORT_FIELDS = [
  '_score',
  'createdAt',
  'viewsCount',
  'clicks',
];

export const SUGGEST_FIELDS: Record<EsIndexName, string[]> = {
  [ES_INDEX.PROPERTIES]: ['title', 'location'],
  [ES_INDEX.JOBS]: ['title', 'companyName', 'location'],
  [ES_INDEX.WORKER_PROFILES]: ['areaCovered'],
  [ES_INDEX.PRODUCT_ADS]: ['title', 'brand', 'location'],
  [ES_INDEX.NEED_A_WORKER]: ['location', 'description'],
  [ES_INDEX.BUSINESS_LISTINGS]: ['name', 'address'],
};
