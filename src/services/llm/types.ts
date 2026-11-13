export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: LLMUsage;
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: LLMChatMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;
}
