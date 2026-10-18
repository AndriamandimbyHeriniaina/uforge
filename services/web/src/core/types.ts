import type { AdminKeyWrap } from '../lib/crypto';

/** Binary file of the workspace (image, sound, font). */
export type Asset = { mime: string; dataBase64: string; size: number };

/** Materialised project: text files + binary assets. */
export type Workspace = {
  files: Record<string, string>;
  assets: Record<string, Asset>;
};

/** Manifest returned by the compiler (from uforge.json). */
export type AppManifest = {
  name: string;
  description: string;
  icon: string | null;
  orientation: 'portrait' | 'landscape' | 'any';
  capabilities: string[];
};

/** Clear header of the installed app and of a .happ file (doc/features/happ.md). */
export type HappHeader = {
  format: 1;
  runtimeMin: string;
  appId: string;
  name: string;
  description?: string;
  icon: string | null;
  owner: string;
  /** Validated version (Builder). 0 = never built. */
  version: number;
  builtAt?: string;
  exportedAt?: string;
  options: { frozen: boolean; withData: boolean };
  capabilities: string[];
  crypto: {
    admin?: AdminKeyWrap;
    /** Export file only. Not a secret: the recipient opens the app without a password. */
    shareKey?: string;
  };
  /** Export file only. */
  blocks?: Partial<Record<'app' | 'data' | 'admin', { iv: string; sha256: string; size: number }>>;
};

/** The validated build, encrypted with K_device on the device. */
export type AppBlock = {
  html: string;
  manifest: AppManifest;
  version: number;
  builtAt: string;
};

export type ChatOp = { op: 'write' | 'edit' | 'delete' | 'rename'; path: string; done: boolean };

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  ops?: ChatOp[];
  status?: 'streaming' | 'ok' | 'failed' | 'refused';
  error?: string;
  /** Version created by this turn. */
  version?: number;
  attachments?: string[];
};

/** path → content hash. */
export type Snapshot = { files: Record<string, string>; assets: Record<string, string> };

export type VersionEntry = Snapshot & { n: number; at: string; message: string };

/** Everything only the admin may see, encrypted with K_admin. */
export type AdminBlock = {
  format: 1;
  current: Snapshot;
  currentVersion: number;
  builtVersion: number;
  versions: VersionEntry[];
  blobs: Record<string, string>;
  assetBlobs: Record<string, Asset>;
  conversation: ChatTurn[];
  settings: { previewData: 'live' | 'empty' };
};

export type RuntimeErrorItem = {
  source: 'runtime' | 'build';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
};

export type PendingAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'text';
  mime: string;
  size: number;
  dataBase64?: string;
  content?: string;
  useInApp: boolean;
  previewUrl?: string;
};

export type FileChange =
  | { op: 'write'; path: string; content: string }
  | { op: 'delete'; path: string };

export type DonePayload = {
  requestId: string;
  status: 'SUCCEEDED' | 'REFUSED' | 'FAILED';
  reply: string;
  changes: FileChange[];
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  model: string;
  message?: string;
};
