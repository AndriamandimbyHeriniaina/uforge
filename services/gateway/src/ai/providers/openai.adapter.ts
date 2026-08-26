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

  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    return this.generateStream(input, () => undefined);
  }

  async generateStream(
    input: ProviderGenerateInput,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<ProviderGenerateResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const baseUrl = this.config
      .get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const messages = buildGenerateMessages(input);
    const timeout = AbortSignal.timeout(60_000);
    const combined = mergeAbortSignals(signal, timeout);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        stream: true,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: combined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(body.error?.message ?? `OpenAI HTTP ${response.status}`);
    }
    const extractor = new JsonReplyExtractor();
    let inputTokens = 0;
    let outputTokens = 0;
    await readSseJson(
      response.body,
      (row) => {
        const usage = row.usage as
          | { prompt_tokens?: number; completion_tokens?: number }
          | undefined;
        if (usage) {
          inputTokens = usage.prompt_tokens ?? inputTokens;
          outputTokens = usage.completion_tokens ?? outputTokens;
        }
        const choices = row.choices as
          | Array<{ delta?: { content?: string } }>
          | undefined;
        const content = choices?.[0]?.delta?.content;
        if (content) {
          extractor.push(content, onToken);
        }
      },
      signal,
    );
    return this.finish(input, extractor.raw, inputTokens, outputTokens, model);
  }

  private finish(
    input: ProviderGenerateInput,
    content: string,
    inputTokens: number,
    outputTokens: number,
    model: string,
  ): ProviderGenerateResult {
    const parsed = parseModelJson(content || '{}');
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
