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
 * OpenAI Chat Completions adapter (also works with compatible proxies).
 *
 * @example
 * const out = await openai.generate({ prompt, currentSpec, skillsBlock });
 */
@Injectable()
export class OpenAiAdapter implements LlmProvider {
  readonly id = 'openai';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const baseUrl = this.config
      .get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const messages = buildGenerateMessages(input);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? `OpenAI HTTP ${response.status}`);
    }
    const content = body.choices?.[0]?.message?.content ?? '';
    const parsed = parseModelJson(content);
    if (parsed.refusal) {
      return {
        spec: input.currentSpec,
        reply: parsed.refusal,
        refusal: parsed.refusal,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
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
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      provider: this.id,
      model,
    };
  }
}
