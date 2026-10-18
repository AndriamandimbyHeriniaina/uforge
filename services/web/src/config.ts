/** Runtime version, compared with `header.runtimeMin` on import. */
export const RUNTIME_VERSION = '1.0.0';

/** Gateway (AI, accounts). Never an AI provider directly. */
export const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Compiler (esbuild). The browser calls it on the host, not the Docker hostname. */
export const COMPILER_URL = (import.meta.env.VITE_COMPILER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

/** Admin session closes after this much inactivity. */
export const SESSION_IDLE_MS = 15 * 60 * 1000;

/** Versions kept in the admin block. */
export const MAX_VERSIONS = 50;

/** Conversation turns kept in the admin block. */
export const MAX_TURNS = 200;
