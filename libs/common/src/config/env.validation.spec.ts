import 'reflect-metadata';
import {
  AdminEnvironmentVariables,
  ApiEnvironmentVariables,
  WorkerEnvironmentVariables,
  validateEnv,
} from './env.validation';

const STRONG_SECRET = 'a'.repeat(32);

const baseConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: '587',
  MAIL_USER: 'mailer',
  MAIL_PASSWORD: 'secret',
  MAIL_FROM: 'DesiLynks <no-reply@example.com>',
};

const apiConfig = {
  ...baseConfig,
  JWT_SECRET: 'short',
  JWT_SECRET_EXPIRY: '30m',
  GOOGLE_CLIENT_ID: 'google-client-id',
  APPLE_BUNDLE_ID: 'com.example.app',
};

const productionApiConfig = {
  ...apiConfig,
  NODE_ENV: 'production',
  JWT_SECRET: STRONG_SECRET,
  ELASTICSEARCH_NODES: 'http://es01:9200',
  ELASTICSEARCH_USERNAME: 'desilynks_app',
  ELASTICSEARCH_PASSWORD: 'es-password',
  FIREBASE_SERVICE_ACCOUNT_PATH: '/run/secrets/firebase.json',
};

describe('validateEnv', () => {
  it('should accept a development config with a short secret', () => {
    const config = validateEnv(ApiEnvironmentVariables)(apiConfig);

    expect(config.REDIS_PORT).toBe(6379);
    expect(config.MAIL_PORT).toBe(587);
  });

  it('should accept a complete production config', () => {
    expect(() =>
      validateEnv(ApiEnvironmentVariables)(productionApiConfig),
    ).not.toThrow();
  });

  it('should reject a short JWT secret in production', () => {
    expect(() =>
      validateEnv(ApiEnvironmentVariables)({
        ...productionApiConfig,
        JWT_SECRET: 'short',
      }),
    ).toThrow('JWT_SECRET must be at least 32 characters in production');
  });

  it('should require elasticsearch credentials and firebase in production', () => {
    const {
      ELASTICSEARCH_USERNAME: _username,
      FIREBASE_SERVICE_ACCOUNT_PATH: _firebase,
      ...config
    } = productionApiConfig;

    expect(() => validateEnv(ApiEnvironmentVariables)(config)).toThrow(
      /ELASTICSEARCH_USERNAME[\s\S]*FIREBASE_SERVICE_ACCOUNT_PATH/,
    );
  });

  it('should reject a missing database url', () => {
    const { DATABASE_URL: _databaseUrl, ...config } = apiConfig;

    expect(() => validateEnv(ApiEnvironmentVariables)(config)).toThrow(
      'DATABASE_URL',
    );
  });

  it('should reject the same secret for users and admins', () => {
    expect(() =>
      validateEnv(AdminEnvironmentVariables)({
        ...baseConfig,
        JWT_SECRET: STRONG_SECRET,
        ADMIN_JWT_SECRET: STRONG_SECRET,
        ADMIN_JWT_SECRET_EXPIRY: '30m',
      }),
    ).toThrow('JWT_SECRET and ADMIN_JWT_SECRET must be different');
  });

  it('should only require the worker settings for the worker', () => {
    expect(() =>
      validateEnv(WorkerEnvironmentVariables)({
        DATABASE_URL: baseConfig.DATABASE_URL,
        REDIS_HOST: baseConfig.REDIS_HOST,
        REDIS_PORT: baseConfig.REDIS_PORT,
      }),
    ).not.toThrow();
  });
});
