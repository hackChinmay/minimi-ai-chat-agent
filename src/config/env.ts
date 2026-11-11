import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_PREFIX: z.string().startsWith('/').default('/api'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),

  // Search Provider Configurations
  SEARCH_PROVIDER: z.enum(['tavily', 'brave', 'mock']).default('tavily'),
  TAVILY_API_KEY: z.string().optional(),
  SEARCH_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const formattedIssues = issues
      .map((issue) => `  - [${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join('\n');
    super(`Environment configuration validation failed:\n${formattedIssues}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function validateEnv(customEnv?: Record<string, unknown>): EnvConfig {
  const envToValidate = customEnv ?? process.env;
  const result = envSchema.safeParse(envToValidate);

  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }

  return result.data;
}

export const env: EnvConfig = validateEnv();
