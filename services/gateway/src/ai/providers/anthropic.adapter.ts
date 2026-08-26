import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LlmProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  StreamTokenFn,
} from './provider.types';
import { parseModelJson, sanitizeSpec } from './spec.util';
import { buildGenerateMessages } from './prompt';
import { JsonReplyExtractor, mergeAbortSignals, readSseJson } from './stream.util';

/**
 * Anthropic Messages adapter.
 *
 * @example
 * const out = await anthropic.generate({ prompt, currentSpec, skillsBlock });
 */
@Injectable()
export class AnthropicAdapter implements LlmProvider {
  readonly id = 'anthropic';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY', '').trim());
  }

  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    return this.generateStream(input, () => undefined);
  }

  async generateStream(
    input: ProviderGenerateInput,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<ProviderGenerateResult> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '').trim();
    const model = this.config.get<string>(
      'ANTHROPIC_MODEL',
      'claude-sonnet-4-20250514',
    );
    const messages = buildGenerateMessages(input);
    const system = messages.find((item) => item.role === 'system')?.content ?? '';
    const user = messages
      .filter((item) => item.role === 'user')
      .map((item) => item.content)
      .join('\n\n');
    const timeout = AbortSignal.timeout(60_000);
    const combined = mergeAbortSignals(signal, timeout);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.4,
        stream: true,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: combined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(body.error?.message ?? `Anthropic HTTP ${response.status}`);
    }
    const extractor = new JsonReplyExtractor();
    let inputTokens = 0;
    let outputTokens = 0;
    await readSseJson(
      response.body,
      (row) => {
        const type = String(row.type ?? '');
        if (type === 'message_delta') {
          const usage = row.usage as { output_tokens?: number } | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
        }
        if (type === 'message_start') {
          const message = row.message as {
            usage?: { input_tokens?: number };
          } | undefined;
          inputTokens = message?.usage?.input_tokens ?? inputTokens;
        }
        if (type === 'content_block_delta') {
          const delta = row.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === 'text_delta' && delta.text) {
            extractor.push(delta.text, onToken);
          }
        }
      },
      signal,
    );
    const parsed = parseModelJson(extractor.raw || '{}');
    if (parsed.refusal) {
      return {
        spec: input.currentSpec,
        reply: parsed.refusal,
        refusal: parsed.refusal,
        inputTokens,
        outputTokens,
        provider: this.id,
        model,
      };
    }
    const reply =
      parsed.reply?.trim() ||
      'C’est noté. Dis-moi la suite, ou utilise l’appli quand c’est bon.';
    return {
      spec: sanitizeSpec(parsed.spec, input.currentSpec, input.prompt, reply),
      reply,
      inputTokens,
      outputTokens,
      provider: this.id,
      model,
    };
  }
}
