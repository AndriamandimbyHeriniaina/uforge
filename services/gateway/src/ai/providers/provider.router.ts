import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicAdapter } from './anthropic.adapter';
import { OpenAiAdapter } from './openai.adapter';
import { StubAdapter } from './stub.adapter';
import type { LlmProvider, ProviderGenerateInput, ProviderGenerateResult, StreamTokenFn } from './provider.types';

/**
 * Picks the configured LLM adapter. Falls back to the stub if no key is set.
 *
 * @example
 * const out = await router.generate(input);
 */
@Injectable()
export class ProviderRouter {
  constructor(
    private readonly config: ConfigService,
    private readonly openai: OpenAiAdapter,
    private readonly anthropic: AnthropicAdapter,
    private readonly stub: StubAdapter,
  ) {}

  /**
   * Runs one Builder turn on the active provider.
   *
   * @example
   * const result = await router.generate(input);
   */
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    return this.active().generate(input);
  }

  /**
   * Streams the user-facing reply, then returns the finished spec.
   *
   * @example
   * const result = await router.generateStream(input, (delta) => write(delta));
   */
  generateStream(
    input: ProviderGenerateInput,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<ProviderGenerateResult> {
    return this.active().generateStream(input, onToken, signal);
  }

  activeName(): string {
    const wanted = this.config.get<string>('AI_PROVIDER', '').trim().toLowerCase();
    if (wanted === 'openai' || wanted === 'anthropic' || wanted === 'stub') {
      return wanted;
    }
    if (this.openai.isConfigured()) {
      return 'openai';
    }
    if (this.anthropic.isConfigured()) {
      return 'anthropic';
    }
    return 'stub';
  }

  private active(): LlmProvider {
    const wanted = this.config.get<string>('AI_PROVIDER', '').trim().toLowerCase();
    if (wanted === 'stub') {
      return this.stub;
    }
    if (wanted === 'openai') {
      if (!this.openai.isConfigured()) {
        throw new Error('OPENAI_API_KEY is missing');
      }
      return this.openai;
    }
    if (wanted === 'anthropic') {
      if (!this.anthropic.isConfigured()) {
        throw new Error('ANTHROPIC_API_KEY is missing');
      }
      return this.anthropic;
    }
    if (this.openai.isConfigured()) {
      return this.openai;
    }
    if (this.anthropic.isConfigured()) {
      return this.anthropic;
    }
    return this.stub;
  }
}
