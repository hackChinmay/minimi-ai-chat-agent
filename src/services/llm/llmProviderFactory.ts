import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { LLMProvider } from './types';
import { OpenAILLMProvider } from './providers/openAILLMProvider';
import { MockLLMProvider } from './providers/mockLLMProvider';

export function createLLMProvider(providerName?: string): LLMProvider {
  const selected = (
    providerName ??
    process.env.LLM_PROVIDER ??
    env.LLM_PROVIDER
  ).toLowerCase();

  switch (selected) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
      if (!apiKey && (process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test')) {
        logger.debug('No OPENAI_API_KEY configured in test environment. Using MockLLMProvider.');
        return new MockLLMProvider();
      }
      return new OpenAILLMProvider();
    }

    case 'mock':
      return new MockLLMProvider();

    default:
      logger.warn(`Unknown LLM provider "${selected}". Falling back to MockLLMProvider.`);
      return new MockLLMProvider();
  }
}
