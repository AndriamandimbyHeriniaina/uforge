import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicAdapter } from './anthropic.adapter';
import { OpenAiAdapter } from './openai.adapter';
import { StubAdapter } from './stub.adapter';
import type { LlmProvider } from './provider.types';

/**
 * Picks the configured LLM adapter.
 * `AI_PROVIDER` = `anthropic` | `openai` | `stub`; unset → first adapter with a key, else stub.
 *
 * @example
 * const provider = router.active();
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
   * Returns the adapter for this turn. Throws when the chosen provider has no key.
   *
   * @example
   * const out = await router.active().stream(request, onText);
   */
  active(): LlmProvider {
    const wanted = this.config.get<string>('AI_PROVIDER', '').trim().toLowerCase();
    if (wanted === 'stub') {
      return this.stub;
    }
    if (wanted === 'anthropic') {
      if (!this.anthropic.isConfigured()) {
        throw new Error('ANTHROPIC_API_KEY is missing');
      }
      return this.anthropic;
    }
    if (wanted === 'openai') {
      if (!this.openai.isConfigured()) {
        throw new Error('OPENAI_API_KEY is missing');
      }
      return this.openai;
    }
    if (this.anthropic.isConfigured()) {
      return this.anthropic;
    }
    if (this.openai.isConfigured()) {
      return this.openai;
    }
    return this.stub;
  }
}
