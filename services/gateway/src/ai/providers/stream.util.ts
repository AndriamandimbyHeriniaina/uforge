/**
 * Pulls the JSON string value of `reply` out of a streamed JSON object.
 *
 * @example
 * const ext = new JsonReplyExtractor();
 * ext.push('{"reply":"Salut', (delta) => process.stdout.write(delta));
 */
export class JsonReplyExtractor {
  raw = '';
  private pos = 0;
  private mode: 'key' | 'string' | 'done' = 'key';
  private reply = '';
  private emitted = 0;
  private escape = false;
  private hex = '';

  /**
   * Appends a provider chunk and emits newly completed reply characters.
   *
   * @example
   * extractor.push(chunk, (delta) => sink.token(delta));
   */
  push(chunk: string, emit: (delta: string) => void): void {
    this.raw += chunk;
    this.step(emit);
  }

  private step(emit: (delta: string) => void): void {
    while (this.pos < this.raw.length && this.mode !== 'done') {
      if (this.mode === 'key') {
        const slice = this.raw.slice(this.pos);
        const match = slice.match(/"reply"\s*:\s*"/);
        if (!match || match.index === undefined) {
          this.pos = Math.max(this.pos, this.raw.length - 16);
          return;
        }
        this.pos += match.index + match[0].length;
        this.mode = 'string';
        continue;
      }
      const char = this.raw[this.pos];
      this.pos += 1;
      if (this.hex) {
        this.hex += char;
        if (this.hex.length === 4) {
          this.reply += String.fromCharCode(Number.parseInt(this.hex, 16));
          this.hex = '';
          this.flush(emit);
        }
        continue;
      }
      if (this.escape) {
        this.escape = false;
        if (char === 'u') {
          this.hex = '';
          continue;
        }
        const mapped: Record<string, string> = {
          n: '\n',
          t: '\t',
          r: '\r',
          '"': '"',
          '\\': '\\',
          '/': '/',
        };
        this.reply += mapped[char] ?? char;
        this.flush(emit);
        continue;
      }
      if (char === '\\') {
        this.escape = true;
        continue;
      }
      if (char === '"') {
        this.mode = 'done';
        return;
      }
      this.reply += char;
      this.flush(emit);
    }
  }

  private flush(emit: (delta: string) => void): void {
    if (this.reply.length <= this.emitted) {
      return;
    }
    emit(this.reply.slice(this.emitted));
    this.emitted = this.reply.length;
  }
}

/**
 * Combines two abort signals (client disconnect + timeout).
 *
 * @example
 * const signal = mergeAbortSignals(reqSignal, AbortSignal.timeout(60_000));
 */
export function mergeAbortSignals(
  first?: AbortSignal,
  second?: AbortSignal,
): AbortSignal | undefined {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  const ctrl = new AbortController();
  const abort = (): void => ctrl.abort();
  if (first.aborted || second.aborted) {
    ctrl.abort();
    return ctrl.signal;
  }
  first.addEventListener('abort', abort, { once: true });
  second.addEventListener('abort', abort, { once: true });
  return ctrl.signal;
}

/**
 * Emits a finished reply in small chunks (stub / fallback).
 *
 * @example
 * await emitReplySlowly('Salut', onToken, signal);
 */
export async function emitReplySlowly(
  text: string,
  onToken: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (let i = 0; i < text.length; i += 4) {
    if (signal?.aborted) {
      throw new Error('aborted');
    }
    onToken(text.slice(i, i + 4));
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

type SseJson = Record<string, unknown>;

/**
 * Reads an SSE body and calls `onEvent` for each `data:` JSON payload.
 *
 * @example
 * await readSseJson(response.body, (row) => { ... });
 */
export async function readSseJson(
  body: ReadableStream<Uint8Array> | null,
  onEvent: (row: SseJson) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!body) {
    throw new Error('empty stream');
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new Error('aborted');
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        if (data === '[DONE]') {
          return;
        }
        continue;
      }
      try {
        onEvent(JSON.parse(data) as SseJson);
      } catch {
        /* keep reading */
      }
    }
  }
}
