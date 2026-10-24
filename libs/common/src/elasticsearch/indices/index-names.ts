export const ES_INDEX = {
  PROPERTIES: 'properties',
  JOBS: 'jobs',
  WORKER_PROFILES: 'worker_profiles',
  PRODUCT_ADS: 'product_ads',
  NEED_A_WORKER: 'need_a_worker',
  BUSINESS_LISTINGS: 'business_listings',
} as const;

export type EsIndexName = (typeof ES_INDEX)[keyof typeof ES_INDEX];
