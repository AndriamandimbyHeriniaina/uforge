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
  return AbortSignal.any([first, second]);
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
      if (data === '[DONE]') {
        return;
      }
      if (!data) {
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
