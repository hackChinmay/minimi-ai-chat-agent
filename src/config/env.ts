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

  // Conversation Memory & Storage Configurations
  STORAGE_PROVIDER: z.enum(['inmemory', 'mongodb']).default('inmemory'),
  MONGODB_URI: z.string().optional(),
  MAX_CONTEXT_MESSAGES: z.coerce.number().int().min(1).max(100).default(10),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().min(1).max(50000).default(10000),

  // LLM Provider Configurations
  LLM_PROVIDER: z.enum(['openai', 'mock']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_MAX_TOKENS: z.coerce.number().int().min(50).max(4000).default(1000),
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
