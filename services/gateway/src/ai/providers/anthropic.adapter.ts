import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentPart,
  LlmProvider,
  LlmRequest,
  LlmResult,
  LlmStopReason,
  TextSink,
} from './provider.types';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Anthropic Messages adapter (official SDK, streaming).
 *
 * Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5-5`),
 * `ANTHROPIC_MAX_TOKENS` (default 64000), `ANTHROPIC_EFFORT` (default `high`,
 * empty to omit), `ANTHROPIC_FALLBACKS` (`default` or `off`).
 *
 * @example
 * const out = await anthropic.stream({ system, messages }, (delta) => parser.push(delta));
 */
@Injectable()
export class AnthropicAdapter implements LlmProvider {
  readonly id = 'anthropic';
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY', '').trim());
  }

  async stream(request: LlmRequest, onText: TextSink, signal?: AbortSignal): Promise<LlmResult> {
    const model = this.config.get<string>('ANTHROPIC_MODEL', '').trim() || 'claude-opus-5-5';
    const maxTokens = Number(this.config.get<string>('ANTHROPIC_MAX_TOKENS', '')) || 64000;
    const effortRaw = this.config.get<string>('ANTHROPIC_EFFORT', 'high').trim() as Effort;
    const effort = EFFORTS.includes(effortRaw) ? effortRaw : undefined;
    const fallbacks = this.config.get<string>('ANTHROPIC_FALLBACKS', 'default').trim() !== 'off';

    const stream = this.sdk().beta.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        ...(effort ? { output_config: { effort } } : {}),
        ...(fallbacks
          ? { fallbacks: 'default' as const, betas: ['server-side-fallback-2026-07-01'] }
          : {}),
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.parts.map(toBlock),
        })),
      },
      { signal },
    );

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onText(event.delta.text);
        }
      }
      const final = await stream.finalMessage();
      const text = final.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
      const usage = final.usage;
      return {
        text,
        inputTokens:
          usage.input_tokens +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens,
        model: final.model,
        stopReason: mapStop(final.stop_reason),
        refusalCategory: final.stop_details?.category ?? null,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(`Anthropic ${err.status ?? ''} ${err.message}`.trim());
      }
      throw err;
    }
  }

  private sdk(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.config.get<string>('ANTHROPIC_API_KEY', '').trim(),
        timeout: 15 * 60 * 1000,
        maxRetries: 2,
      });
    }
    return this.client;
  }
}

function toBlock(part: ContentPart): Anthropic.Beta.BetaContentBlockParam {
  if (part.type === 'image') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: part.mime, data: part.dataBase64 },
    };
  }
  return {
    type: 'text',
    text: part.text,
    ...(part.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
  };
}

function mapStop(reason: string | null): LlmStopReason {
  if (reason === 'end_turn' || reason === 'stop_sequence') {
    return 'end';
  }
  if (reason === 'max_tokens') {
    return 'max_tokens';
  }
  if (reason === 'refusal') {
    return 'refusal';
  }
  return 'other';
}
