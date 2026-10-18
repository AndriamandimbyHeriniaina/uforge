import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ContentPart,
  LlmProvider,
  LlmRequest,
  LlmResult,
  TextSink,
} from './provider.types';
import { mergeAbortSignals, readSseJson } from './stream.util';

/**
 * OpenAI Chat Completions adapter (also works with compatible proxies).
 *
 * Env: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, optional `OPENAI_MAX_TOKENS`.
 *
 * @example
 * const out = await openai.stream({ system, messages }, (delta) => parser.push(delta));
 */
@Injectable()
export class OpenAiAdapter implements LlmProvider {
  readonly id = 'openai';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  async stream(request: LlmRequest, onText: TextSink, signal?: AbortSignal): Promise<LlmResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const baseUrl = this.config
      .get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    const model = this.config.get<string>('OPENAI_MODEL', '').trim() || 'gpt-4.1';
    const maxTokens = Number(this.config.get<string>('OPENAI_MAX_TOKENS', '')) || undefined;
    const combined = mergeAbortSignals(signal, AbortSignal.timeout(15 * 60 * 1000));
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
        messages: [
          { role: 'system', content: request.system },
          ...request.messages.map((message) => ({
            role: message.role,
            content:
              message.role === 'assistant'
                ? message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
                : message.parts.map(toPart),
          })),
        ],
      }),
      signal: combined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(body.error?.message ?? `OpenAI HTTP ${response.status}`);
    }
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let finish: string | null = null;
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
          | Array<{ delta?: { content?: string }; finish_reason?: string | null }>
          | undefined;
        const choice = choices?.[0];
        if (choice?.finish_reason) {
          finish = choice.finish_reason;
        }
        const content = choice?.delta?.content;
        if (content) {
          text += content;
          onText(content);
        }
      },
      signal,
    );
    return {
      text,
      inputTokens,
      outputTokens,
      model,
      stopReason:
        finish === 'length'
          ? 'max_tokens'
          : finish === 'content_filter'
            ? 'refusal'
            : finish === 'stop'
              ? 'end'
              : 'other',
    };
  }
}

function toPart(part: ContentPart): Record<string, unknown> {
  if (part.type === 'image') {
    return {
      type: 'image_url',
      image_url: { url: `data:${part.mime};base64,${part.dataBase64}` },
    };
  }
  return { type: 'text', text: part.text };
}
