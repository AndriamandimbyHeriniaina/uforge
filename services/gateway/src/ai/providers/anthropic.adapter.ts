import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LlmProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from './provider.types';
import { parseModelJson, sanitizeSpec } from './spec.util';
import { buildGenerateMessages } from './prompt';

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

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
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
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? `Anthropic HTTP ${response.status}`);
    }
    const content =
      body.content?.filter((part) => part.type === 'text').map((part) => part.text) ?? [];
    const parsed = parseModelJson(content.join('\n'));
    if (parsed.refusal) {
      return {
        spec: input.currentSpec,
        reply: parsed.refusal,
        refusal: parsed.refusal,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
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
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      provider: this.id,
      model,
    };
  }
}
