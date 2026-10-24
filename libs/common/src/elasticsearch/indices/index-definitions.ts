import type { estypes } from '@elastic/elasticsearch';
import { ES_INDEX } from './index-names';

const SHARED_ANALYSIS = {
  analyzer: {
    autocomplete: {
      type: 'custom' as const,
      tokenizer: 'autocomplete_tokenizer',
      filter: ['lowercase'],
    },
    autocomplete_search: {
      type: 'custom' as const,
      tokenizer: 'standard',
      filter: ['lowercase'],
    },
  },
  tokenizer: {
    autocomplete_tokenizer: {
      type: 'edge_ngram' as const,
      min_gram: 2,
      max_gram: 15,
      token_chars: ['letter', 'digit'] as Array<
        'letter' | 'digit' | 'whitespace' | 'punctuation' | 'symbol'
      >,
    },
  },
};

const SHARED_SETTINGS: estypes.IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 1,
  refresh_interval: '1s',
  analysis: SHARED_ANALYSIS,
};

export interface IndexDefinition {
  index: string;
  settings: estypes.IndicesIndexSettings;
  mappings: estypes.MappingTypeMapping;
}

const PROPERTIES_INDEX: IndexDefinition = {
  index: ES_INDEX.PROPERTIES,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text' },
      type: { type: 'keyword' },
      status: { type: 'keyword' },
      location: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      monthlyRent: { type: 'scaled_float', scaling_factor: 100 },
      noOfBedRooms: { type: 'integer' },
      noOfBathRooms: { type: 'integer' },
      featuresAndAmenities: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          title: { type: 'keyword' },
        },
      },
      contactPreference: { type: 'keyword' },
      availableFrom: { type: 'date' },
      ownerId: { type: 'keyword' },
      viewsCount: { type: 'integer' },
      propertyPhotos: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

const JOBS_INDEX: IndexDefinition = {
  index: ES_INDEX.JOBS,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      companyName: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text' },
      categoryId: { type: 'keyword' },
      category: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          title: { type: 'keyword' },
        },
      },
      type: { type: 'keyword' },
      workMode: { type: 'keyword' },
      location: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      requiredSkills: { type: 'text' },
      salary: { type: 'scaled_float', scaling_factor: 100 },
      salaryPeriod: { type: 'keyword' },
      experience: { type: 'keyword' },
      languages: { type: 'keyword' },
      status: { type: 'keyword' },
      poster: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      employerId: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};


const WORKER_PROFILES_INDEX: IndexDefinition = {
  index: ES_INDEX.WORKER_PROFILES,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      service: { type: 'keyword' },
      about: { type: 'text' },
      areaCovered: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      experienceInYears: { type: 'integer' },
      hourlyRate: { type: 'scaled_float', scaling_factor: 100 },
      dailyRate: { type: 'scaled_float', scaling_factor: 100 },
      languagesSpoken: { type: 'keyword' },
      isAvailableToday: { type: 'boolean' },
      ownVehicle: { type: 'boolean' },
      ownTools: { type: 'boolean' },
      workerId: { type: 'keyword' },
      profilePhoto: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      workPhotos: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      certificates: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

const PRODUCT_ADS_INDEX: IndexDefinition = {
  index: ES_INDEX.PRODUCT_ADS,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text' },
      category: { type: 'keyword' },
      brand: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      condition: { type: 'keyword' },
      price: { type: 'scaled_float', scaling_factor: 100 },
      negotiable: { type: 'boolean' },
      location: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      status: { type: 'keyword' },
      viewsCount: { type: 'integer' },
      sellerId: { type: 'keyword' },
      photos: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      video: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

const NEED_A_WORKER_INDEX: IndexDefinition = {
  index: ES_INDEX.NEED_A_WORKER,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      workerTypeId: { type: 'keyword' },
      workerType: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          title: { type: 'keyword' },
        },
      },
      location: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      dateNeeded: { type: 'date' },
      budget: { type: 'scaled_float', scaling_factor: 100 },
      budgetType: { type: 'keyword' },
      isUrgentRequest: { type: 'boolean' },
      description: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
      },
      requesterId: { type: 'keyword' },
      referencePhotos: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

const BUSINESS_LISTINGS_INDEX: IndexDefinition = {
  index: ES_INDEX.BUSINESS_LISTINGS,
  settings: SHARED_SETTINGS,
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'autocomplete',
        search_analyzer: 'autocomplete_search',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text' },
      categoryId: { type: 'keyword' },
      category: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          title: { type: 'keyword' },
        },
      },
      address: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      phone: { type: 'keyword' },
      whatsApp: { type: 'keyword' },
      status: { type: 'keyword' },
      viewsCount: { type: 'integer' },
      clicks: { type: 'integer' },
      ownerId: { type: 'keyword' },
      coverPhoto: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      businessGalleries: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      businessHours: {
        type: 'object',
        properties: {
          monToFriStartTime: { type: 'keyword' },
          monToFriEndTime: { type: 'keyword' },
          saturdayStartTime: { type: 'keyword' },
          saturdayEndTime: { type: 'keyword' },
          sundayStartTime: { type: 'keyword' },
          sundayEndTime: { type: 'keyword' },
          isClosedOnSunday: { type: 'boolean' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

export const INDEX_DEFINITIONS: IndexDefinition[] = [
  PROPERTIES_INDEX,
  JOBS_INDEX,
  WORKER_PROFILES_INDEX,
  PRODUCT_ADS_INDEX,
  NEED_A_WORKER_INDEX,
  BUSINESS_LISTINGS_INDEX,
];
