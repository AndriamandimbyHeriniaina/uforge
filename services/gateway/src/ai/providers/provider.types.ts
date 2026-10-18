/**
 * Provider-agnostic LLM contract. Adapters only stream text; the `uf-*`
 * protocol is parsed by the gateway, never by an adapter.
 */

export type ContentPart =
  | { type: 'text'; text: string; /** Prompt-cache breakpoint hint. */ cache?: boolean }
  | { type: 'image'; mime: ImageMime; dataBase64: string };

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export const IMAGE_MIMES: ImageMime[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export type LlmMessage = { role: 'user' | 'assistant'; parts: ContentPart[] };

export type LlmRequest = {
  /** Skills block (stable across turns, cached first). */
  system: string;
  messages: LlmMessage[];
};

export type LlmStopReason = 'end' | 'max_tokens' | 'refusal' | 'other';

export type LlmResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: LlmStopReason;
  refusalCategory?: string | null;
};

export type TextSink = (delta: string) => void;

export interface LlmProvider {
  readonly id: string;
  isConfigured(): boolean;
  /**
   * Streams the model answer as text deltas.
   *
   * @example
   * const out = await provider.stream(request, (delta) => parser.push(delta), signal);
   */
  stream(request: LlmRequest, onText: TextSink, signal?: AbortSignal): Promise<LlmResult>;
}
