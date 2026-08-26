export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

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

export type AppSpec = {
  app?: { name?: string; runtime?: { min_version?: string } };
  pages?: SpecPage[];
  capabilities?: string[];
  conversation?: ChatTurn[];
  seed?: Record<string, unknown[]>;
};

export type ProviderGenerateInput = {
  skillsBlock: string;
  prompt: string;
  currentSpec: AppSpec;
};

export type ProviderGenerateResult = {
  spec: AppSpec;
  reply: string;
  refusal?: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
};

export type StreamTokenFn = (delta: string) => void;

export type LlmProvider = {
  readonly id: string;
  isConfigured(): boolean;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
  generateStream(
    input: ProviderGenerateInput,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<ProviderGenerateResult>;
};
