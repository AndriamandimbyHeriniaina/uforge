export type AppSpec = {
  app?: { name?: string; runtime?: { min_version?: string } };
  pages?: Array<{ name: string; type: string }>;
  capabilities?: string[];
  conversation?: Array<{ role: 'user' | 'assistant'; text: string }>;
  seed?: Record<string, unknown[]>;
};

export type RuntimeRequest = {
  type: 'runtime';
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

export type RuntimeResponse = {
  type: 'runtime-result';
  id: string;
  result?: unknown;
  error?: string;
};
