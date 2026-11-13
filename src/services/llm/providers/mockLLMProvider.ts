import { LLMProvider, LLMChatMessage, LLMGenerateOptions, LLMResponse } from '../types';

export interface MockLLMHandler {
  (messages: LLMChatMessage[], options?: LLMGenerateOptions): Promise<string> | string;
}

export class MockLLMProvider implements LLMProvider {
  public readonly name = 'mock';
  public readonly model: string;
  private customHandler?: MockLLMHandler;
  private cannedResponses: string[] = [];
  private callHistory: Array<{ messages: LLMChatMessage[]; options?: LLMGenerateOptions }> = [];
  private shouldFailWith?: Error;

  constructor(options?: { model?: string; defaultResponse?: string }) {
    this.model = options?.model ?? 'mock-gpt-4o';
    if (options?.defaultResponse) {
      this.cannedResponses.push(options.defaultResponse);
    }
  }

  public setHandler(handler: MockLLMHandler): void {
    this.customHandler = handler;
  }

  public addCannedResponse(response: string): void {
    this.cannedResponses.push(response);
  }

  public setSimulatedError(error: Error | undefined): void {
    this.shouldFailWith = error;
  }

  public getCalls(): Array<{ messages: LLMChatMessage[]; options?: LLMGenerateOptions }> {
    return [...this.callHistory];
  }

  public getLastCall(): { messages: LLMChatMessage[]; options?: LLMGenerateOptions } | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  public clearHistory(): void {
    this.callHistory = [];
    this.cannedResponses = [];
    this.customHandler = undefined;
    this.shouldFailWith = undefined;
  }

  public async chat(
    messages: LLMChatMessage[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    this.callHistory.push({ messages, options });

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let responseContent: string;

    if (this.customHandler) {
      responseContent = await this.customHandler(messages, options);
    } else if (this.cannedResponses.length > 0) {
      responseContent = this.cannedResponses.shift()!;
    } else {
      // Deterministic default content based on last user message
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const query = lastUserMsg?.content || 'general inquiry';
      responseContent = `I am a simulated AI assistant responding to: "${query}".`;
    }

    const latencyMs = Date.now() - startTime;
    const promptChars = messages.reduce((acc, m) => acc + m.content.length, 0);
    const completionChars = responseContent.length;

    return {
      content: responseContent,
      model: this.model,
      usage: {
        promptTokens: Math.ceil(promptChars / 4),
        completionTokens: Math.ceil(completionChars / 4),
        totalTokens: Math.ceil((promptChars + completionChars) / 4),
      },
      latencyMs,
    };
  }
}
