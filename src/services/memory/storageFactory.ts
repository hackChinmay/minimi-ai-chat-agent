import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ConversationStorageAdapter } from './types';
import { InMemoryConversationStorage } from './adapters/inMemoryAdapter';
import { MongoConversationStorage } from './adapters/mongoAdapter';

export function createConversationStorage(providerName?: string): ConversationStorageAdapter {
  const selected = (providerName ?? env.STORAGE_PROVIDER).toLowerCase();

  switch (selected) {
    case 'mongodb': {
      if (env.MONGODB_URI && env.MONGODB_URI.trim().length > 0) {
        return new MongoConversationStorage(env.MONGODB_URI);
      }
      logger.warn(
        'STORAGE_PROVIDER is set to "mongodb" but MONGODB_URI is not configured. Falling back to InMemoryConversationStorage.'
      );
      return new InMemoryConversationStorage();
    }

    case 'inmemory':
      return new InMemoryConversationStorage();

    default:
      logger.warn(
        `Unknown storage provider "${selected}". Falling back to InMemoryConversationStorage.`
      );
      return new InMemoryConversationStorage();
  }
}
