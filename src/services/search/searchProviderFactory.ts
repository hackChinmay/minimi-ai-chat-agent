import { env } from '../../config/env';
import { SearchProvider } from './types';
import { TavilySearchProvider } from './providers/tavilyProvider';
import { MockSearchProvider } from './providers/mockProvider';
import { AppError } from '../../utils/errors';

export function createSearchProvider(providerName?: string): SearchProvider {
  const selected = providerName ?? env.SEARCH_PROVIDER;

  switch (selected.toLowerCase()) {
    case 'tavily':
      return new TavilySearchProvider();
    case 'mock':
      return new MockSearchProvider();
    case 'brave':
      // Placeholder for future Brave implementation
      throw new AppError(
        'Brave Search provider is not yet implemented. Please set SEARCH_PROVIDER=tavily or mock.',
        501,
        'PROVIDER_NOT_IMPLEMENTED'
      );
    default:
      throw new AppError(
        `Unsupported search provider: '${selected}'. Valid options are 'tavily' or 'mock'.`,
        500,
        'INVALID_PROVIDER_CONFIG'
      );
  }
}
