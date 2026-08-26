export type SpecFieldKind = 'text' | 'number' | 'note' | 'photo';

export type SpecField = {
  key: string;
  label: string;
  kind?: SpecFieldKind;
};

export type SpecAction = {
  label: string;
  run: 'camera' | 'files' | 'share' | 'goto';
  page?: string;
  text?: string;
};

export type SpecGame = {
  kind?: 'catch' | 'tap' | 'script';
  goal?: string;
  /** Playable canvas JS (function body). Catch/tap are toys, not the default. */
  source?: string;
};

export type SpecPage = {
  name: string;
  type: string;
  description?: string;
  collection?: string;
  fields?: SpecField[];
  actions?: SpecAction[];
  items?: string[];
  game?: SpecGame;
};

export type HappManifest = {
  id: string;
  version: string;
  name?: string;
  runtime?: { min_version?: string };
  capabilities?: string[];
};

export type AppSpec = {
  app?: { name?: string; runtime?: { min_version?: string } };
  pages?: SpecPage[];
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
