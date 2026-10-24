import {
  plainToInstance,
  Type,
  type ClassConstructor,
} from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateBy,
  ValidateIf,
  validateSync,
  type ValidationOptions,
} from 'class-validator';

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

const MIN_PRODUCTION_SECRET_LENGTH = 32;

const isProduction = (env: BaseEnvironmentVariables) =>
  env.NODE_ENV === Environment.PRODUCTION;

function IsProductionSecret(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isProductionSecret',
      validator: {
        validate: (value, args) =>
          !isProduction(args?.object as BaseEnvironmentVariables) ||
          (typeof value === 'string' &&
            value.length >= MIN_PRODUCTION_SECRET_LENGTH),
        defaultMessage: (args) =>
          `${args?.property} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      },
    },
    validationOptions,
  );
}

class BaseEnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @Type(() => Number)
  @IsInt()
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;
}

class MailEnvironmentVariables extends BaseEnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  MAIL_HOST: string;

  @Type(() => Number)
  @IsInt()
  MAIL_PORT: number;

  @IsString()
  @IsNotEmpty()
  MAIL_USER: string;

  @IsString()
  @IsNotEmpty()
  MAIL_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string;
}

export class ApiEnvironmentVariables extends MailEnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  @IsProductionSecret()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET_EXPIRY: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  APPLE_BUNDLE_ID: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_NODES?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_USERNAME?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_PASSWORD?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
}

export class AdminEnvironmentVariables extends MailEnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ADMIN_PORT?: number;

  @IsString()
  @IsNotEmpty()
  @IsProductionSecret()
  ADMIN_JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_JWT_SECRET_EXPIRY: string;

  @IsOptional()
  @IsString()
  @IsProductionSecret()
  ADMIN_SEED_SECRET?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_NODES?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_USERNAME?: string;

  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_PASSWORD?: string;
}

export class WorkerEnvironmentVariables extends BaseEnvironmentVariables {
  @ValidateIf(isProduction)
  @IsString()
  @IsNotEmpty()
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
}

export function validateEnv<T extends BaseEnvironmentVariables>(
  environmentVariables: ClassConstructor<T>,
) {
  return (config: Record<string, unknown>): T => {
    const validatedConfig = plainToInstance(environmentVariables, config, {
      enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    }).flatMap((error) => Object.values(error.constraints ?? {}));

    if (
      typeof config.JWT_SECRET === 'string' &&
      config.JWT_SECRET === config.ADMIN_JWT_SECRET
    ) {
      errors.push('JWT_SECRET and ADMIN_JWT_SECRET must be different');
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
      );
    }

    return validatedConfig;
  };
}
