import { describe, it, expect } from 'vitest';
import { validateEnv, EnvValidationError } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  it('should parse valid environment variables successfully with defaults', () => {
    const rawEnv = {
      NODE_ENV: 'production',
      PORT: '8080',
    };

    const parsed = validateEnv(rawEnv);

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.PORT).toBe(8080);
    expect(parsed.CORS_ORIGIN).toBe('*');
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.API_PREFIX).toBe('/api');
    expect(parsed.REQUEST_BODY_LIMIT).toBe('1mb');
    expect(parsed.SEARCH_PROVIDER).toBe('tavily');
    expect(parsed.SEARCH_TIMEOUT_MS).toBe(5000);
    expect(parsed.STORAGE_PROVIDER).toBe('inmemory');
    expect(parsed.MAX_CONTEXT_MESSAGES).toBe(10);
    expect(parsed.MAX_MESSAGE_LENGTH).toBe(10000);
    expect(parsed.LLM_PROVIDER).toBe('openai');
    expect(parsed.OPENAI_MODEL).toBe('gpt-4o-mini');
    expect(parsed.OPENAI_BASE_URL).toBe('https://api.openai.com/v1');
    expect(parsed.LLM_TIMEOUT_MS).toBe(15000);
    expect(parsed.LLM_TEMPERATURE).toBe(0.2);
    expect(parsed.LLM_MAX_TOKENS).toBe(1000);
  });

  it('should throw EnvValidationError when PORT is out of valid range', () => {
    const rawEnv = {
      PORT: '999999', // Exceeds 65535
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when NODE_ENV is an unrecognized enum value', () => {
    const rawEnv = {
      NODE_ENV: 'invalid_environment',
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when API_PREFIX does not start with a slash', () => {
    const rawEnv = {
      API_PREFIX: 'api/v1', // Missing leading slash
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when SEARCH_PROVIDER is unsupported', () => {
    const rawEnv = {
      SEARCH_PROVIDER: 'unsupported_engine',
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when SEARCH_TIMEOUT_MS is less than minimum allowed', () => {
    const rawEnv = {
      SEARCH_TIMEOUT_MS: '100', // Minimum is 500ms
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when STORAGE_PROVIDER is unsupported', () => {
    const rawEnv = {
      STORAGE_PROVIDER: 'unsupported_db',
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when LLM_PROVIDER is unsupported', () => {
    const rawEnv = {
      LLM_PROVIDER: 'unsupported_llm',
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });

  it('should throw EnvValidationError when LLM_TIMEOUT_MS is below minimum', () => {
    const rawEnv = {
      LLM_TIMEOUT_MS: '500', // Minimum is 1000ms
    };

    expect(() => validateEnv(rawEnv)).toThrow(EnvValidationError);
  });
});
