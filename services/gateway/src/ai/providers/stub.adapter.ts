import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResult, TextSink } from './provider.types';

/**
 * Offline adapter used when no provider key is set. It answers with a small
 * but real project in the `uf-*` protocol, so the whole pipeline (gateway →
 * compiler → Runtime → runtime.db) can be tested end to end without an AI.
 *
 * @example
 * const out = await stub.stream({ system, messages }, (delta) => parser.push(delta));
 */
@Injectable()
export class StubAdapter implements LlmProvider {
  readonly id = 'stub';

  isConfigured(): boolean {
    return true;
  }

  async stream(request: LlmRequest, onText: TextSink, signal?: AbortSignal): Promise<LlmResult> {
    const last = request.messages[request.messages.length - 1];
    const lastText = last?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('\n') ?? '';
    const isRetry = request.messages.length > 1;
    const message = extractAdminMessage(lastText);
    const text = isRetry ? '' : stubAnswer(message);
    for (let i = 0; i < text.length; i += 48) {
      if (signal?.aborted) {
        throw new Error('aborted');
      }
      onText(text.slice(i, i + 48));
      await new Promise((resolve) => setTimeout(resolve, 4));
    }
    return {
      text,
      inputTokens: Math.round(lastText.length / 4),
      outputTokens: Math.round(text.length / 4),
      model: 'stub',
      stopReason: 'end',
    };
  }
}

function extractAdminMessage(prompt: string): string {
  const marker = '# Admin message';
  const at = prompt.lastIndexOf(marker);
  const raw = at === -1 ? prompt : prompt.slice(at + marker.length);
  return raw.trim().split('\n')[0]?.slice(0, 140) || 'Mon carnet';
}

/**
 * The demo answer: chat text + file operations.
 *
 * @example
 * stubAnswer('Une appli de notes');
 */
export function stubAnswer(message: string): string {
  const subtitle = JSON.stringify(`Ta demande : « ${message} »`);
  return `Mode démo (aucune IA configurée) : je pose un carnet de notes pour tester Uforge de bout en bout.
<uf-write path="uforge.json">
{
  "name": "Carnet",
  "description": "Un carnet de notes rapide, créé par le mode démo de Uforge.",
  "icon": "assets/icon.svg",
  "entry": "index.html",
  "orientation": "any",
  "capabilities": [],
  "dependencies": {},
  "jsx": null
}
</uf-write>
<uf-write path="assets/icon.svg">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#d4894a"/><path d="M20 18h20l6 6v22H20z" fill="#fff8f0"/><path d="M25 32h14M25 38h10" stroke="#d4894a" stroke-width="3" stroke-linecap="round"/></svg>
</uf-write>
<uf-write path="index.html">
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Carnet</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main id="app" class="app"></main>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
</uf-write>
<uf-write path="src/db.js">
export async function setupDb() {
  await runtime.db.migrate([
    'CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL, created_at TEXT NOT NULL)',
  ]);
}

export function listNotes() {
  return runtime.db.query('SELECT id, text, created_at FROM notes ORDER BY id DESC');
}

export function addNote(text) {
  return runtime.db.exec('INSERT INTO notes (text, created_at) VALUES (?, ?)', [
    text,
    new Date().toISOString(),
  ]);
}

export function removeNote(id) {
  return runtime.db.exec('DELETE FROM notes WHERE id = ?', [id]);
}
</uf-write>
<uf-write path="src/main.js">
import { addNote, listNotes, removeNote, setupDb } from './db.js';

const SUBTITLE = ${subtitle};
const app = document.getElementById('app');
let notes = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function render() {
  app.replaceChildren();
  const header = el('header', 'top');
  header.append(el('h1', '', 'Carnet'), el('p', 'sub', SUBTITLE));

  const form = el('form', 'composer');
  const input = el('input');
  input.placeholder = 'Écris une note…';
  input.setAttribute('aria-label', 'Nouvelle note');
  const add = el('button', 'primary', 'Ajouter');
  add.type = 'submit';
  form.append(input, add);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    await addNote(text);
    await refresh();
  });

  const list = el('ul', 'list');
  if (notes.length === 0) {
    list.append(el('li', 'empty', 'Aucune note pour l’instant. Écris la première ci-dessus.'));
  }
  for (const note of notes) {
    const item = el('li', 'note');
    const body = el('div', 'body');
    body.append(el('span', 'text', note.text), el('small', 'date', formatDate(note.created_at)));
    const remove = el('button', 'ghost', 'Supprimer');
    remove.setAttribute('aria-label', 'Supprimer cette note');
    remove.addEventListener('click', async () => {
      await removeNote(note.id);
      await refresh();
    });
    item.append(body, remove);
    list.append(item);
  }
  app.append(header, form, list);
}

async function refresh() {
  notes = await listNotes();
  render();
}

async function start() {
  await setupDb();
  await refresh();
}

start();
</uf-write>
<uf-write path="src/styles.css">
:root {
  --bg: #f6f1ea;
  --card: #fffdf9;
  --line: #e5dccf;
  --text: #1f1a15;
  --muted: #6b6258;
  --accent: #d4894a;
  --radius: 16px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #14110e; --card: #1d1914; --line: #332c25; --text: #f3eee6; --muted: #a39a8f; }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.45 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.app {
  max-width: 640px;
  margin: 0 auto;
  padding: max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
}
.top h1 { margin: 8px 0 4px; font-size: 1.8rem; }
.sub { margin: 0 0 16px; color: var(--muted); }
.composer { display: flex; gap: 8px; margin-bottom: 16px; }
.composer input {
  flex: 1; min-width: 0; font: inherit; padding: 12px 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--text);
}
button { font: inherit; min-height: 44px; border-radius: 12px; cursor: pointer; }
.primary { border: 0; padding: 0 18px; background: var(--accent); color: #1a120c; font-weight: 600; }
.ghost { border: 1px solid var(--line); background: transparent; color: var(--muted); padding: 0 12px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.note {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
}
.body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.text { overflow-wrap: anywhere; }
.date { color: var(--muted); }
.empty { color: var(--muted); padding: 24px 8px; text-align: center; }
</uf-write>
Le carnet est prêt : ajoute une note, recharge l’aperçu, elle doit toujours être là.`;
}
