export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AppSpec = {
  app?: { name?: string; runtime?: { min_version?: string } };
  pages?: Array<{ name: string; type: string }>;
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

export type LlmProvider = {
  readonly id: string;
  isConfigured(): boolean;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
};
