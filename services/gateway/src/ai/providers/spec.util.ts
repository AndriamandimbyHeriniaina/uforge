import type { AppSpec, ChatTurn } from './provider.types';

const PAGE_TYPES = new Set(['crud', 'dashboard', 'custom', 'game', 'home']);

const TYPE_ALIASES: Record<string, string> = {
  list: 'crud',
  table: 'crud',
  form: 'crud',
  vitrine: 'custom',
  brochure: 'custom',
  home: 'custom',
  stats: 'dashboard',
  canvas: 'game',
  photos: 'custom',
};

/**
 * Normalizes a model spec so the Runtime guest player can render it.
 *
 * @example
 * const spec = sanitizeSpec(raw, previous, prompt, reply);
 */
export function sanitizeSpec(
  raw: unknown,
  previous: AppSpec,
  prompt: string,
  reply: string,
): AppSpec {
  const incoming = raw && typeof raw === 'object' ? (raw as AppSpec) : {};
  const prevApp = previous.app ?? {};
  const name =
    incoming.app?.name?.trim() ||
    prevApp.name ||
    'Mon application';

  const pages = normalizePages(
    Array.isArray(incoming.pages) ? incoming.pages : previous.pages,
  );
  const capabilities = uniqueStrings(
    Array.isArray(incoming.capabilities)
      ? incoming.capabilities
      : previous.capabilities ?? ['storage', 'database'],
  );

  const conversation = mergeConversation(previous.conversation, prompt, reply);

  return {
    app: {
      name,
      runtime: { min_version: incoming.app?.runtime?.min_version ?? '1.0.0' },
    },
    pages: pages.length ? pages : [{ name: 'Accueil', type: 'custom' }],
    capabilities: capabilities.length ? capabilities : ['storage', 'database'],
    conversation,
    seed:
      incoming.seed && typeof incoming.seed === 'object'
        ? incoming.seed
        : previous.seed,
  };
}

function normalizePages(
  pages: Array<{ name?: string; title?: string; label?: string; type?: string }> | undefined,
): Array<{ name: string; type: string }> {
  if (!pages?.length) {
    return [];
  }
  const seen = new Set<string>();
  const next: Array<{ name: string; type: string }> = [];
  for (const page of pages) {
    const name = String(page?.name ?? page?.title ?? page?.label ?? '')
      .trim()
      .slice(0, 40);
    if (!name || seen.has(name.toLowerCase())) {
      continue;
    }
    seen.add(name.toLowerCase());
    let type = String(page?.type ?? 'custom').toLowerCase();
    type = TYPE_ALIASES[type] ?? type;
    if (!PAGE_TYPES.has(type)) {
      type = 'custom';
    }
    if (type === 'home') {
      type = 'custom';
    }
    next.push({ name, type });
  }
  return next.slice(0, 8);
}

function uniqueStrings(values: string[]): string[] {
  const allowed = new Set([
    'storage',
    'database',
    'camera',
    'files',
    'share',
    'bluetooth',
  ]);
  const out: string[] = [];
  for (const value of values) {
    const cap = String(value).toLowerCase().trim();
    if (!allowed.has(cap) || out.includes(cap)) {
      continue;
    }
    out.push(cap);
  }
  return out;
}

function mergeConversation(
  previous: ChatTurn[] | undefined,
  prompt: string,
  reply: string,
): ChatTurn[] {
  const thread = Array.isArray(previous) ? [...previous] : [];
  thread.push({ role: 'user', text: prompt });
  thread.push({ role: 'assistant', text: reply });
  return thread.slice(-40);
}

/**
 * Parses a model JSON payload that may be wrapped in markdown fences.
 *
 * @example
 * const payload = parseModelJson(text);
 */
export function parseModelJson(text: string): {
  spec?: AppSpec;
  reply?: string;
  refusal?: string;
} {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('model did not return JSON');
  }
  return JSON.parse(raw.slice(start, end + 1)) as {
    spec?: AppSpec;
    reply?: string;
    refusal?: string;
  };
}
