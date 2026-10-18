import { GATEWAY_URL } from '../config';
import type { DonePayload } from './types';

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<number, string> = {
  401: 'Email ou mot de passe incorrect.',
  409: 'Un compte existe déjà avec cet email.',
  413: 'Le projet ou les pièces jointes sont trop gros pour ton forfait.',
  429: 'Quota du jour atteint. Réessaie demain.',
};

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set('content-type', 'application/json');
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  } catch {
    throw new GatewayError('Service Uforge injoignable. Vérifie ta connexion.', 0);
  }
  if (!response.ok) {
    throw await toError(response);
  }
  return (await response.json()) as T;
}

async function toError(response: Response): Promise<GatewayError> {
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  const raw = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  return new GatewayError(FRIENDLY[response.status] ?? raw ?? `Erreur ${response.status}`, response.status);
}

/**
 * @example
 * const { token } = await register('ada@example.com', 'correct-horse');
 */
export function register(email: string, password: string): Promise<{ token: string }> {
  return request('/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
}

/**
 * @example
 * const { token } = await login('ada@example.com', 'correct-horse');
 */
export function login(email: string, password: string): Promise<{ token: string }> {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export type GeneratePayload = {
  appId: string;
  message: string;
  files: Array<{ path: string; content: string }>;
  assets: Array<{ path: string; mime: string; size: number }>;
  attachments: Array<{
    name: string;
    kind: 'image' | 'text';
    mime: string;
    dataBase64?: string;
    content?: string;
    assetPath?: string;
  }>;
  errors: Array<{ source: 'runtime' | 'build'; message: string; stack?: string; file?: string; line?: number }>;
  conversation: Array<{ role: 'user' | 'assistant'; text: string }>;
};

export type GenerateHandlers = {
  onToken: (text: string) => void;
  onOp: (event: { op: 'write' | 'edit' | 'delete' | 'rename'; path: string; phase: 'start' | 'end' }) => void;
};

/**
 * One conversation turn over SSE. Resolves with the `done` payload.
 *
 * @example
 * const done = await generate(token, payload, { onToken, onOp }, abort.signal);
 */
export async function generate(
  token: string,
  payload: GeneratePayload,
  handlers: GenerateHandlers,
  signal?: AbortSignal,
): Promise<DonePayload> {
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}/v1/ai/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) {
      throw new GatewayError('Tour interrompu.', 0);
    }
    throw new GatewayError('Service Uforge injoignable. Vérifie ta connexion.', 0);
  }
  if (!response.ok || !response.body) {
    if (response.status === 401) {
      throw new GatewayError('Session expirée : rouvre l’atelier avec ton mot de passe.', 401);
    }
    throw await toError(response);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: DonePayload | null = null;
  while (true) {
    const { value, done: finished } = await reader.read();
    if (finished) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      let event = 'message';
      const data: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).trimStart());
        }
      }
      if (!data.length) {
        continue;
      }
      const parsed = JSON.parse(data.join('\n')) as Record<string, unknown>;
      if (event === 'token') {
        handlers.onToken(String(parsed.text ?? ''));
      } else if (event === 'op') {
        handlers.onOp(parsed as Parameters<GenerateHandlers['onOp']>[0]);
      } else if (event === 'done') {
        done = parsed as unknown as DonePayload;
      } else if (event === 'error') {
        throw new GatewayError(String(parsed.message ?? 'Erreur du service'), 500);
      }
    }
  }
  if (!done) {
    throw new GatewayError('La réponse a été coupée avant la fin. Réessaie.', 0);
  }
  return done;
}
