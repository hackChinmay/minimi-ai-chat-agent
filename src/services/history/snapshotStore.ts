import mongoose, { Schema, Model } from 'mongoose';
import { HistoricalSnapshot, HistoricalQueryOptions, SnapshotStorageAdapter } from './types';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ============================================================================
// 1. In-Memory Snapshot Storage Adapter
// ============================================================================

export class InMemorySnapshotStorage implements SnapshotStorageAdapter {
  public readonly name = 'inmemory';
  private readonly snapshots = new Map<string, HistoricalSnapshot[]>();

  public async saveSnapshot(snapshot: HistoricalSnapshot): Promise<HistoricalSnapshot> {
    const list = this.snapshots.get(snapshot.conversationId) ?? [];

    // Duplicate prevention: check if identical entity, attribute, and value exists within 5 mins
    const nowMs = new Date(snapshot.observedAt).getTime();
    const duplicate = list.find((s) => {
      const sameEntity = s.entity.toLowerCase() === snapshot.entity.toLowerCase();
      const sameAttr = s.attribute.toLowerCase() === snapshot.attribute.toLowerCase();
      const sameVal = s.value.toLowerCase() === snapshot.value.toLowerCase();
      const diffMs = Math.abs(nowMs - new Date(s.observedAt).getTime());
      return sameEntity && sameAttr && sameVal && diffMs < 5 * 60 * 1000;
    });

    if (duplicate) {
      logger.debug(
        `Duplicate snapshot detected for [${snapshot.conversationId}]: ${snapshot.entity}.${snapshot.attribute}. Returning existing.`
      );
      return duplicate;
    }

    list.push({ ...snapshot });
    this.snapshots.set(snapshot.conversationId, list);
    return snapshot;
  }

  public async getSnapshots(
    conversationId?: string,
    options?: HistoricalQueryOptions
  ): Promise<HistoricalSnapshot[]> {
    let list: HistoricalSnapshot[] = [];
    if (conversationId) {
      list = this.snapshots.get(conversationId) ?? [];
    } else {
      for (const snaps of this.snapshots.values()) {
        list.push(...snaps);
      }
    }
    let filtered = [...list];

    if (options?.entity) {
      const ent = options.entity.toLowerCase();
      filtered = filtered.filter((s) => s.entity.toLowerCase().includes(ent));
    }

    if (options?.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.entity.toLowerCase().includes(q) ||
          s.attribute.toLowerCase().includes(q) ||
          s.value.toLowerCase().includes(q)
      );
    }

    if (options?.since) {
      const sinceDate = new Date(options.since).getTime();
      if (!isNaN(sinceDate)) {
        filtered = filtered.filter((s) => new Date(s.observedAt).getTime() >= sinceDate);
      }
    }

    if (options?.until) {
      const untilDate = new Date(options.until).getTime();
      if (!isNaN(untilDate)) {
        filtered = filtered.filter((s) => new Date(s.observedAt).getTime() <= untilDate);
      }
    }

    // Sort by observedAt descending
    filtered.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  public async findLatestSnapshot(
    conversationId: string,
    entity: string,
    attribute?: string
  ): Promise<HistoricalSnapshot | null> {
    const list = this.snapshots.get(conversationId) ?? [];
    const ent = entity.toLowerCase();
    const attr = attribute?.toLowerCase();

    const matches = list.filter((s) => {
      const entityMatch = s.entity.toLowerCase() === ent || s.entity.toLowerCase().includes(ent);
      const attrMatch = attr ? s.attribute.toLowerCase() === attr : true;
      return entityMatch && attrMatch;
    });

    if (matches.length === 0) return null;

    matches.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
    return matches[0] ?? null;
  }

  public async deleteSnapshots(conversationId: string): Promise<number> {
    const count = (this.snapshots.get(conversationId) ?? []).length;
    this.snapshots.delete(conversationId);
    return count;
  }

  public async clearAll(): Promise<void> {
    this.snapshots.clear();
  }
}

// ============================================================================
// 2. MongoDB Snapshot Storage Adapter
// ============================================================================

interface MongoSnapshotDoc {
  _id: string;
  conversationId: string;
  messageId?: string;
  entity: string;
  attribute: string;
  value: string;
  validPeriod?: string;
  observedAt: Date;
  retrievedAt: Date;
  sourceUrl?: string;
  sourceTitle?: string;
  metadata?: Record<string, unknown>;
}

const snapshotSchema = new Schema<MongoSnapshotDoc>(
  {
    _id: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    messageId: { type: String },
    entity: { type: String, required: true, index: true },
    attribute: { type: String, required: true },
    value: { type: String, required: true },
    validPeriod: { type: String },
    observedAt: { type: Date, required: true, index: true },
    retrievedAt: { type: Date, required: true },
    sourceUrl: { type: String },
    sourceTitle: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for fast queries by conversation and entity
snapshotSchema.index({ conversationId: 1, entity: 1, observedAt: -1 });

export class MongoSnapshotStorage implements SnapshotStorageAdapter {
  public readonly name = 'mongodb';
  private model: Model<MongoSnapshotDoc>;

  constructor() {
    this.model =
      (mongoose.models.HistoricalSnapshot as Model<MongoSnapshotDoc>) ||
      mongoose.model<MongoSnapshotDoc>('HistoricalSnapshot', snapshotSchema);
  }

  public async saveSnapshot(snapshot: HistoricalSnapshot): Promise<HistoricalSnapshot> {
    const nowMs = new Date(snapshot.observedAt).getTime();
    const fiveMinutesAgo = new Date(nowMs - 5 * 60 * 1000);

    // Duplicate check
    const existing = await this.model
      .findOne({
        conversationId: snapshot.conversationId,
        entity: new RegExp(`^${snapshot.entity}$`, 'i'),
        attribute: new RegExp(`^${snapshot.attribute}$`, 'i'),
        value: snapshot.value,
        observedAt: { $gte: fiveMinutesAgo },
      })
      .lean();

    if (existing) {
      return this.mapDoc(existing as unknown as MongoSnapshotDoc);
    }

    await this.model.create({
      _id: snapshot.id,
      conversationId: snapshot.conversationId,
      messageId: snapshot.messageId,
      entity: snapshot.entity,
      attribute: snapshot.attribute,
      value: snapshot.value,
      validPeriod: snapshot.validPeriod,
      observedAt: new Date(snapshot.observedAt),
      retrievedAt: new Date(snapshot.retrievedAt),
      sourceUrl: snapshot.sourceUrl,
      sourceTitle: snapshot.sourceTitle,
      metadata: snapshot.metadata,
    });

    return snapshot;
  }

  public async getSnapshots(
    conversationId?: string,
    options?: HistoricalQueryOptions
  ): Promise<HistoricalSnapshot[]> {
    const query: any = {};
    if (conversationId) {
      query.conversationId = conversationId;
    }

    if (options?.entity) {
      query.entity = new RegExp(options.entity, 'i');
    }

    if (options?.query) {
      query.$or = [
        { entity: new RegExp(options.query, 'i') },
        { attribute: new RegExp(options.query, 'i') },
        { value: new RegExp(options.query, 'i') },
      ];
    }

    if (options?.since || options?.until) {
      const dateQuery: Record<string, unknown> = {};
      if (options.since) dateQuery.$gte = new Date(options.since);
      if (options.until) dateQuery.$lte = new Date(options.until);
      query.observedAt = dateQuery;
    }

    const limit = Math.min(options?.limit ?? 20, 100);
    const docs = await this.model
      .find(query)
      .sort({ observedAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc: any) => this.mapDoc(doc as unknown as MongoSnapshotDoc));
  }

  public async findLatestSnapshot(
    conversationId: string,
    entity: string,
    attribute?: string
  ): Promise<HistoricalSnapshot | null> {
    const query: any = {
      conversationId,
      entity: new RegExp(entity, 'i'),
    };
    if (attribute) {
      query.attribute = new RegExp(`^${attribute}$`, 'i');
    }

    const doc = await this.model
      .findOne(query)
      .sort({ observedAt: -1 })
      .lean();

    if (!doc) return null;
    return this.mapDoc(doc as unknown as MongoSnapshotDoc);
  }

  public async deleteSnapshots(conversationId: string): Promise<number> {
    const res = await this.model.deleteMany({ conversationId });
    return res.deletedCount || 0;
  }

  private mapDoc(doc: MongoSnapshotDoc): HistoricalSnapshot {
    return {
      id: doc._id,
      conversationId: doc.conversationId,
      messageId: doc.messageId,
      entity: doc.entity,
      attribute: doc.attribute,
      value: doc.value,
      validPeriod: doc.validPeriod,
      observedAt: doc.observedAt instanceof Date ? doc.observedAt.toISOString() : String(doc.observedAt),
      retrievedAt: doc.retrievedAt instanceof Date ? doc.retrievedAt.toISOString() : String(doc.retrievedAt),
      sourceUrl: doc.sourceUrl,
      sourceTitle: doc.sourceTitle,
      metadata: doc.metadata,
    };
  }
}

// ============================================================================
// 3. Storage Factory
// ============================================================================

export function createSnapshotStorage(providerName?: string): SnapshotStorageAdapter {
  const selected = (providerName ?? env.STORAGE_PROVIDER).toLowerCase();

  switch (selected) {
    case 'mongodb':
      if (!env.MONGODB_URI) {
        logger.warn('MONGODB_URI is not configured. Falling back to InMemorySnapshotStorage.');
        return new InMemorySnapshotStorage();
      }
      return new MongoSnapshotStorage();

    case 'inmemory':
    default:
      return new InMemorySnapshotStorage();
  }
}

export const snapshotStorage = createSnapshotStorage();
