import mongoose, { Schema, Model } from 'mongoose';
import { Conversation, ConversationMessage, ConversationStorageAdapter } from '../types';
import { logger } from '../../../utils/logger';

interface ConversationDoc {
  _id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

interface MessageDoc {
  _id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export class MongoConversationStorage implements ConversationStorageAdapter {
  public readonly name = 'mongodb';
  private readonly uri: string;
  private isConnected = false;
  private conversationModel!: Model<ConversationDoc>;
  private messageModel!: Model<MessageDoc>;

  constructor(uri: string) {
    this.uri = uri;
    this.initSchemas();
  }

  private initSchemas(): void {
    const conversationSchema = new Schema<ConversationDoc>(
      {
        _id: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed, default: {} },
      },
      { _id: false }
    );

    const messageSchema = new Schema<MessageDoc>(
      {
        _id: { type: String, required: true },
        conversationId: { type: String, required: true, index: true },
        role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now, index: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
      },
      { _id: false }
    );

    // Reuse existing model if already compiled (e.g. in hot reload environments)
    this.conversationModel =
      mongoose.models.Conversation ||
      mongoose.model<ConversationDoc>('Conversation', conversationSchema);

    this.messageModel =
      mongoose.models.Message ||
      mongoose.model<MessageDoc>('Message', messageSchema);
  }

  public async connect(): Promise<void> {
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return;
    }

    try {
      await mongoose.connect(this.uri, {
        serverSelectionTimeoutMS: 5000,
      });
      this.isConnected = true;
      logger.info('Connected to MongoDB successfully for conversation memory');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to connect to MongoDB: ${msg}`);
      throw new Error(`MongoDB connection failed: ${msg}`);
    }
  }

  public async createConversation(
    conversationData: Omit<Conversation, 'messageCount'>
  ): Promise<Conversation> {
    await this.connect();

    const created = await this.conversationModel.create({
      _id: conversationData.id,
      title: conversationData.title,
      createdAt: new Date(conversationData.createdAt),
      updatedAt: new Date(conversationData.updatedAt),
      metadata: conversationData.metadata ?? {},
    });

    return {
      id: created._id,
      title: created.title,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      messageCount: 0,
      metadata: created.metadata,
    };
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    await this.connect();

    const doc = await this.conversationModel.findById(id).lean().exec();
    if (!doc) {
      return null;
    }

    const messageCount = await this.messageModel.countDocuments({ conversationId: id }).exec();

    return {
      id: doc._id,
      title: doc.title,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
      messageCount,
      metadata: doc.metadata,
    };
  }

  public async listConversations(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    await this.connect();

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const docs = await this.conversationModel
      .find()
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    const conversations: Conversation[] = [];

    for (const doc of docs) {
      const messageCount = await this.messageModel.countDocuments({ conversationId: doc._id }).exec();
      conversations.push({
        id: doc._id,
        title: doc.title,
        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: new Date(doc.updatedAt).toISOString(),
        messageCount,
        metadata: doc.metadata,
      });
    }

    return conversations;
  }

  public async deleteConversation(id: string): Promise<boolean> {
    await this.connect();

    const res = await this.conversationModel.deleteOne({ _id: id }).exec();
    if (res.deletedCount === 0) {
      return false;
    }

    await this.messageModel.deleteMany({ conversationId: id }).exec();
    return true;
  }

  public async appendMessage(message: ConversationMessage): Promise<ConversationMessage> {
    await this.connect();

    const convExists = await this.conversationModel.exists({ _id: message.conversationId }).exec();
    if (!convExists) {
      throw new Error(`Cannot append message: Conversation ${message.conversationId} does not exist`);
    }

    const created = await this.messageModel.create({
      _id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt),
      metadata: message.metadata ?? {},
    });

    // Update conversation updatedAt
    await this.conversationModel.updateOne(
      { _id: message.conversationId },
      { updatedAt: new Date(message.createdAt) }
    ).exec();

    return {
      id: created._id,
      conversationId: created.conversationId,
      role: created.role,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      metadata: created.metadata,
    };
  }

  public async getMessages(
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessage[]> {
    await this.connect();

    const filter: Record<string, unknown> = { conversationId };

    if (options?.before) {
      filter.createdAt = { $lt: new Date(options.before) };
    }

    let query = this.messageModel.find(filter).sort({ createdAt: 1 });

    if (options?.limit && options.limit > 0) {
      // If limit is specified, fetch the last N messages
      const total = await this.messageModel.countDocuments(filter).exec();
      const skip = Math.max(0, total - options.limit);
      query = query.skip(skip).limit(options.limit);
    }

    const docs = await query.lean().exec();

    return docs.map((doc) => ({
      id: doc._id,
      conversationId: doc.conversationId,
      role: doc.role,
      content: doc.content,
      createdAt: new Date(doc.createdAt).toISOString(),
      metadata: doc.metadata,
    }));
  }

  public async getMessageCount(conversationId: string): Promise<number> {
    await this.connect();
    return this.messageModel.countDocuments({ conversationId }).exec();
  }

  public async clearAll(): Promise<void> {
    await this.connect();
    await this.conversationModel.deleteMany({}).exec();
    await this.messageModel.deleteMany({}).exec();
  }

  public async close(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }
}
