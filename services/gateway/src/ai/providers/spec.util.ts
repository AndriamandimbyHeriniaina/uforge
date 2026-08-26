import type {
  AppSpec,
  ChatTurn,
  SpecAction,
  SpecField,
  SpecGame,
  SpecPage,
} from './provider.types';

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
  agenda: 'custom',
  shop: 'crud',
};

const FIELD_KINDS = new Set(['text', 'number', 'note', 'photo']);
const ACTION_RUNS = new Set(['camera', 'files', 'share', 'goto']);

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
    previous.pages,
  );
  let capabilities = uniqueStrings(
    Array.isArray(incoming.capabilities)
      ? incoming.capabilities
      : previous.capabilities ?? ['storage', 'database'],
  );
  capabilities = inferCapabilities(pages, capabilities);

  const conversation = mergeConversation(previous.conversation, prompt, reply);

  return {
    app: {
      name,
      runtime: { min_version: incoming.app?.runtime?.min_version ?? '1.0.0' },
    },
    pages: pages.length
      ? pages
      : [{ name: 'Accueil', type: 'custom', description: 'Décris ce que tu veux.' }],
    capabilities: capabilities.length ? capabilities : ['storage', 'database'],
    conversation,
    seed: normalizeSeed(
      incoming.seed && typeof incoming.seed === 'object'
        ? incoming.seed
        : previous.seed,
    ),
  };
}

function normalizePages(
  pages: SpecPage[] | undefined,
  previous: SpecPage[] | undefined,
): SpecPage[] {
  if (!pages?.length) {
    return [];
  }
  const prevByName = new Map(
    (previous ?? []).map((page) => [page.name.toLowerCase(), page]),
  );
  const seen = new Set<string>();
  const next: SpecPage[] = [];
  for (const raw of pages) {
    const page = (raw ?? {}) as SpecPage & {
      title?: string;
      label?: string;
    };
    const name = String(page.name ?? page.title ?? page.label ?? '')
      .trim()
      .slice(0, 40);
    if (!name || seen.has(name.toLowerCase())) {
      continue;
    }
    seen.add(name.toLowerCase());
    let type = String(page.type ?? 'custom').toLowerCase();
    type = TYPE_ALIASES[type] ?? type;
    if (!PAGE_TYPES.has(type)) {
      type = 'custom';
    }
    if (type === 'home') {
      type = 'custom';
    }
    const prev = prevByName.get(name.toLowerCase());
    const fields = normalizeFields(page.fields) ?? prev?.fields;
    const actions = normalizeActions(page.actions) ?? prev?.actions;
    const items = normalizeItems(page.items) ?? prev?.items;
    const description = clip(
      page.description ?? prev?.description,
      240,
    );
    const collection = slug(
      page.collection ?? prev?.collection ?? (type === 'crud' ? name : ''),
    );
    const game =
      type === 'game' ? mergeGame(normalizeGame(page.game), prev?.game) : undefined;
    const specPage: SpecPage = { name, type };
    if (description) specPage.description = description;
    if (type === 'crud' && collection) specPage.collection = collection;
    if (fields?.length) specPage.fields = fields;
    if (actions?.length) specPage.actions = actions;
    if (items?.length) specPage.items = items;
    if (game) specPage.game = game;
    next.push(specPage);
  }
  return next.slice(0, 8);
}

function normalizeFields(value: unknown): SpecField[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const seen = new Set<string>();
  const fields: SpecField[] = [];
  for (const raw of value.slice(0, 8)) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const label = clip(String(row.label ?? row.name ?? row.key ?? ''), 32);
    const key = slug(String(row.key ?? label));
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    let kind = String(row.kind ?? row.type ?? 'text').toLowerCase();
    if (kind === 'textarea' || kind === 'long') kind = 'note';
    if (kind === 'image' || kind === 'camera') kind = 'photo';
    if (!FIELD_KINDS.has(kind)) kind = 'text';
    fields.push({ key, label: label || key, kind: kind as SpecField['kind'] });
  }
  return fields.length ? fields : undefined;
}

function normalizeActions(value: unknown): SpecAction[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const actions: SpecAction[] = [];
  for (const raw of value.slice(0, 6)) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const run = String(row.run ?? row.action ?? row.type ?? '').toLowerCase();
    if (!ACTION_RUNS.has(run)) {
      continue;
    }
    const label = clip(String(row.label ?? row.name ?? run), 32) || run;
    const action: SpecAction = {
      label,
      run: run as SpecAction['run'],
    };
    const page = clip(String(row.page ?? row.target ?? ''), 40);
    if (page) action.page = page;
    const text = clip(String(row.text ?? row.shareText ?? ''), 160);
    if (text) action.text = text;
    actions.push(action);
  }
  return actions.length ? actions : undefined;
}

function normalizeItems(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const items = value
    .map((item) => clip(String(item), 80))
    .filter(Boolean)
    .slice(0, 12);
  return items.length ? items : undefined;
}

function mergeGame(
  incoming: SpecGame | undefined,
  previous: SpecGame | undefined,
): SpecGame | undefined {
  if (!incoming && !previous) {
    return undefined;
  }
  const game: SpecGame = { ...(previous ?? {}), ...(incoming ?? {}) };
  if (incoming?.source) {
    game.source = incoming.source;
  } else if (previous?.source && !incoming?.source) {
    game.source = previous.source;
  }
  if (game.source) {
    game.kind = 'script';
  }
  return game.kind || game.source || game.goal ? game : undefined;
}

function normalizeGame(value: unknown): SpecGame | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const source = clipSource(
    row.source ?? row.code ?? row.js ?? row.script ?? row.program,
  );
  const rawKind = String(row.kind ?? row.mode ?? '').toLowerCase();
  const game: SpecGame = {};
  if (source) {
    game.kind = 'script';
    game.source = source;
  } else if (rawKind === 'tap' || rawKind === 'catch') {
    game.kind = rawKind;
  } else if (rawKind === 'script' || rawKind === 'custom' || rawKind === 'canvas') {
    game.kind = 'script';
  }
  const goal = clip(String(row.goal ?? row.hint ?? ''), 120);
  if (goal) {
    game.goal = goal;
  }
  return game.kind || game.source || game.goal ? game : undefined;
}

function clipSource(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 80_000);
}

function normalizeSeed(
  seed: Record<string, unknown[]> | undefined,
): Record<string, unknown[]> | undefined {
  if (!seed) {
    return undefined;
  }
  const out: Record<string, unknown[]> = {};
  for (const [key, rows] of Object.entries(seed)) {
    const col = slug(key);
    if (!col || !Array.isArray(rows)) {
      continue;
    }
    out[col] = rows.slice(0, 40).map((row, index) => {
      if (row && typeof row === 'object') {
        const rec = { ...(row as Record<string, unknown>) };
        rec.id = String(rec.id ?? `seed-${index + 1}`);
        return rec;
      }
      return { id: `seed-${index + 1}`, title: String(row) };
    });
  }
  return Object.keys(out).length ? out : undefined;
}

function inferCapabilities(pages: SpecPage[], caps: string[]): string[] {
  const next = [...caps];
  const add = (name: string) => {
    if (!next.includes(name)) next.push(name);
  };
  add('storage');
  add('database');
  for (const page of pages) {
    if (page.fields?.some((field) => field.kind === 'photo')) {
      add('camera');
    }
    for (const action of page.actions ?? []) {
      if (action.run === 'camera') add('camera');
      if (action.run === 'files') add('files');
      if (action.run === 'share') add('share');
    }
    if (page.type === 'game') {
      add('database');
    }
  }
  return uniqueStrings(next);
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

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function clip(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
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
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    spec?: AppSpec;
    reply?: string;
    refusal?: string;
    pages?: AppSpec['pages'];
    app?: AppSpec['app'];
  };
  if (!parsed.spec && Array.isArray(parsed.pages)) {
    return {
      spec: parsed as AppSpec,
      reply: parsed.reply,
      refusal: parsed.refusal,
    };
  }
  return parsed;
}
