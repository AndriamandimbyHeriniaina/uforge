const TOKEN_KEY = 'uforge-token';
const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';

export type UforgeApp = {
  id: string;
  publicId: string;
  name: string;
  status: string;
  updatedAt: string;
  drafts?: Array<{ id: string; revision: number; specJson: unknown }>;
};

export type GenerateResult = {
  requestId: string;
  status: string;
  skillsApplied: string[];
  spec?: {
    app?: { name?: string };
    capabilities?: string[];
    pages?: Array<{ name: string; type: string }>;
    notes?: string;
  };
  provider?: string;
  message?: string;
  refusal?: string;
};

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  const token = getToken();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${GATEWAY}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string | string[];
  };
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? `Erreur ${response.status}`;
    throw new Error(message);
  }
  return body;
}

/**
 * Authenticates against the Uforge gateway.
 *
 * @example
 * await login('ada@uforge.app', 'correct-horse');
 */
export function login(email: string, password: string) {
  return request<{ token: string }>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return request<{ token: string }>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function me() {
  return request<{ id: string; email: string; role: string }>('/v1/me');
}

export function listApps() {
  return request<UforgeApp[]>('/v1/apps');
}

export function createApp(name: string) {
  return request<UforgeApp>('/v1/apps', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getApp(id: string) {
  return request<UforgeApp>(`/v1/apps/${id}`);
}

export function generate(prompt: string, appId: string, draftId?: string) {
  return request<GenerateResult>('/v1/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, appId, draftId }),
  });
}
