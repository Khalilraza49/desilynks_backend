import { registerAs } from '@nestjs/config';

export const elasticsearchConfig = registerAs('elasticsearch', () => ({
  nodes: process.env.ELASTICSEARCH_NODES?.split(',').map((n) => n.trim()) || [
    'http://localhost:9200',
  ],
  maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3', 10),
  requestTimeout: parseInt(
    process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '30000',
    10,
  ),
  sniffOnStart: process.env.ELASTICSEARCH_SNIFF_ON_START === 'true',
  username: process.env.ELASTICSEARCH_USERNAME,
  password: process.env.ELASTICSEARCH_PASSWORD,
}));

export type ElasticsearchConfig = ReturnType<typeof elasticsearchConfig>;
