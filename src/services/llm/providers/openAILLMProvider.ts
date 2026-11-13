import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';
import {
  LLMProviderError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMAuthenticationError,
} from '../../../utils/errors';
import { LLMProvider, LLMChatMessage, LLMGenerateOptions, LLMResponse } from '../types';

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  retryConfig?: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
  };
}

export class OpenAILLMProvider implements LLMProvider {
  public readonly name = 'openai';
  public readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  };

  constructor(options?: OpenAIProviderOptions) {
    this.apiKey = options?.apiKey;
    this.model = options?.model ?? env.OPENAI_MODEL;
    this.baseUrl = options?.baseUrl ?? env.OPENAI_BASE_URL;
    this.timeoutMs = options?.timeoutMs ?? env.LLM_TIMEOUT_MS;
    this.defaultTemperature = options?.temperature ?? env.LLM_TEMPERATURE;
    this.defaultMaxTokens = options?.maxTokens ?? env.LLM_MAX_TOKENS;
    this.retryConfig = {
      maxRetries: options?.retryConfig?.maxRetries ?? 2,
      initialDelayMs: options?.retryConfig?.initialDelayMs ?? 500,
      backoffMultiplier: options?.retryConfig?.backoffMultiplier ?? 2,
      maxDelayMs: options?.retryConfig?.maxDelayMs ?? 4000,
    };
  }

  public async chat(
    messages: LLMChatMessage[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const effectiveKey =
      this.apiKey !== undefined
        ? this.apiKey
        : process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

    if (!effectiveKey || effectiveKey.trim().length === 0) {
      throw new LLMAuthenticationError(
        'OpenAI API key is missing or not configured. Set OPENAI_API_KEY in .env or switch LLM_PROVIDER to "mock".'
      );
    }

    const timeout = options?.timeoutMs ?? this.timeoutMs;
    const temperature = options?.temperature ?? this.defaultTemperature;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const startTime = Date.now();

    let attempt = 0;
    let currentDelay = this.retryConfig.initialDelayMs;

    while (attempt <= this.retryConfig.maxRetries) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      try {
        logger.debug(
          `Dispatching OpenAI chat request (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1})`,
          {
            model: this.model,
            messageCount: messages.length,
            timeout,
          }
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: options?.abortSignal ?? controller.signal,
        });

        clearTimeout(timeoutHandle);

        // 1. Success response
        if (response.ok) {
          const rawData = await response.json();
          const latencyMs = Date.now() - startTime;
          return this.parseOpenAIResponse(rawData, latencyMs);
        }

        // 2. Authentication failure (HTTP 401 / 403) - DO NOT RETRY
        if (response.status === 401 || response.status === 403) {
          logger.warn(`OpenAI authentication failure [${response.status}]`);
          throw new LLMAuthenticationError(
            'OpenAI authentication failed. Please verify that your OPENAI_API_KEY is valid.'
          );
        }

        // 3. Bad Request (HTTP 400) - Non-retryable
        if (response.status === 400) {
          const errBody = await response.text();
          logger.warn(`OpenAI bad request [400]: ${errBody}`);
          throw new LLMProviderError(`OpenAI rejected the request with HTTP 400: ${errBody}`);
        }

        // 4. Rate limit (HTTP 429) - Retryable with backoff
        if (response.status === 429) {
          attempt++;
          if (attempt > this.retryConfig.maxRetries) {
            logger.warn(`OpenAI rate limit [429] (retries exhausted)`);
            throw new LLMRateLimitError(
              'OpenAI rate limit exceeded. Please wait a moment before trying again.'
            );
          }

          const jitter = Math.floor(Math.random() * (currentDelay * 0.3));
          const waitTime = currentDelay + jitter;
          logger.warn(
            `OpenAI rate limited [429]. Retrying in ${waitTime}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`
          );
          await this.delay(waitTime);
          currentDelay = Math.min(
            currentDelay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelayMs
          );
          continue;
        }

        // 5. Server error (HTTP 5xx) - Retryable
        if (response.status >= 500) {
          attempt++;
          if (attempt > this.retryConfig.maxRetries) {
            logger.warn(`OpenAI server error [${response.status}] (retries exhausted)`);
            throw new LLMProviderError(
              `OpenAI upstream service error [${response.status}] after ${this.retryConfig.maxRetries} retries.`
            );
          }

          const jitter = Math.floor(Math.random() * (currentDelay * 0.3));
          const waitTime = currentDelay + jitter;
          logger.warn(
            `OpenAI server error [${response.status}]. Retrying in ${waitTime}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`
          );
          await this.delay(waitTime);
          currentDelay = Math.min(
            currentDelay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelayMs
          );
          continue;
        }

        // 6. Any other status code
        throw new LLMProviderError(
          `Unexpected HTTP status ${response.status} returned from OpenAI API`
        );
      } catch (err: unknown) {
        clearTimeout(timeoutHandle);

        if (
          err instanceof LLMAuthenticationError ||
          err instanceof LLMRateLimitError ||
          err instanceof LLMProviderError
        ) {
          throw err;
        }

        const isAbort =
          (err instanceof Error && err.name === 'AbortError') ||
          (typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError');

        if (isAbort) {
          logger.warn(`OpenAI request timed out after ${timeout}ms`);
          throw new LLMTimeoutError(`LLM request timed out after ${timeout}ms`);
        }

        // Transient network failure
        attempt++;
        if (attempt > this.retryConfig.maxRetries) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Network error calling OpenAI (retries exhausted): ${msg}`);
          throw new LLMProviderError(`Failed to communicate with OpenAI provider: ${msg}`);
        }

        const waitTime = currentDelay + Math.floor(Math.random() * 200);
        logger.warn(
          `Transient network error contacting OpenAI (attempt ${attempt}/${this.retryConfig.maxRetries}): ${
            err instanceof Error ? err.message : String(err)
          }. Retrying in ${waitTime}ms...`
        );
        await this.delay(waitTime);
        currentDelay = Math.min(
          currentDelay * this.retryConfig.backoffMultiplier,
          this.retryConfig.maxDelayMs
        );
      }
    }

    throw new LLMProviderError('Unexpected loop termination during OpenAI chat execution');
  }

  private parseOpenAIResponse(raw: unknown, latencyMs: number): LLMResponse {
    if (typeof raw !== 'object' || raw === null) {
      throw new LLMProviderError('Malformed response from OpenAI API: Expected JSON object');
    }

    const payload = raw as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    if (!Array.isArray(payload.choices) || payload.choices.length === 0) {
      throw new LLMProviderError('Malformed response from OpenAI API: Missing choices array');
    }

    const firstChoice = payload.choices[0];
    const content = firstChoice?.message?.content;

    if (typeof content !== 'string') {
      throw new LLMProviderError(
        'Malformed response from OpenAI API: Choice message missing string content'
      );
    }

    return {
      content,
      model: payload.model || this.model,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: payload.usage.total_tokens ?? 0,
          }
        : undefined,
      latencyMs,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
