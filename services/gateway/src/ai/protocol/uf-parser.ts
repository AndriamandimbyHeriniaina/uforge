/**
 * Streaming parser for the `uf-*` output protocol (see skills/prompt/10-output-protocol.md).
 * Text outside tags is chat for the admin; tags are file operations.
 *
 * @example
 * const parser = new UfStreamParser({ onText: (t) => send('token', t) });
 * parser.push('Je prépare.<uf-write path="a.js">x</uf-write>');
 * const result = parser.finish();
 */

export type UfOp =
  | { kind: 'write'; path: string; content: string }
  | { kind: 'edit'; path: string; pairs: Array<{ search: string; replace: string }> }
  | { kind: 'delete'; path: string }
  | { kind: 'rename'; from: string; to: string };

export type UfOpEvent = { op: UfOp['kind']; path: string; phase: 'start' | 'end' };

export type UfParseResult = {
  /** Chat text, trimmed. */
  text: string;
  ops: UfOp[];
  refusal: string | null;
  /** Protocol problems (unterminated tag, missing attribute…). */
  problems: string[];
};

export type UfParserHandlers = {
  onText?: (delta: string) => void;
  onOp?: (event: UfOpEvent) => void;
};

type Mode = 'text' | 'write' | 'edit' | 'search' | 'replace' | 'refusal';

const OPEN = '<uf-';
const CLOSE_WRITE = '</uf-write>';
const CLOSE_REFUSAL = '</uf-refusal>';
const CLOSE_EDIT = '</uf-edit>';
const OPEN_SEARCH = '<uf-search>';
const CLOSE_SEARCH = '</uf-search>';
const OPEN_REPLACE = '<uf-replace>';
const CLOSE_REPLACE = '</uf-replace>';

export class UfStreamParser {
  private buf = '';
  private mode: Mode = 'text';
  private text = '';
  private ops: UfOp[] = [];
  private refusal: string | null = null;
  private problems: string[] = [];
  private current: { path: string; content: string } | null = null;
  private edit: { path: string; pairs: Array<{ search: string; replace: string }> } | null = null;
  private search = '';
  private replace = '';

  constructor(private readonly handlers: UfParserHandlers = {}) {}

  /**
   * Feeds a chunk of model output.
   *
   * @example
   * parser.push(delta);
   */
  push(chunk: string): void {
    this.buf += chunk;
    let progressed = true;
    while (progressed) {
      progressed = this.step();
    }
  }

  /**
   * Flushes what is left. Unterminated tags become problems (usually a truncated answer).
   *
   * @example
   * const { ops, text } = parser.finish();
   */
  finish(): UfParseResult {
    if (this.mode === 'text') {
      this.emitText(this.buf);
    } else if (this.mode === 'refusal') {
      this.refusal = (this.refusal ?? '') + this.buf;
      this.emitText(this.buf);
      this.problems.push('unterminated <uf-refusal>');
    } else {
      const path = this.current?.path ?? this.edit?.path ?? '?';
      this.problems.push(`unterminated <uf-${this.mode === 'write' ? 'write' : 'edit'}> for ${path}`);
    }
    this.buf = '';
    return {
      text: tidyText(this.text),
      ops: this.ops,
      refusal: this.refusal?.trim() || null,
      problems: this.problems,
    };
  }

  private step(): boolean {
    switch (this.mode) {
      case 'text':
        return this.stepText();
      case 'write':
        return this.stepUntil(CLOSE_WRITE, (body) => {
          const current = this.current;
          this.current = null;
          this.mode = 'text';
          if (current) {
            const content = cleanContent(current.content + body);
            this.ops.push({ kind: 'write', path: current.path, content });
            this.handlers.onOp?.({ op: 'write', path: current.path, phase: 'end' });
          }
        }, (partial) => {
          if (this.current) {
            this.current.content += partial;
          }
        });
      case 'refusal':
        return this.stepUntil(CLOSE_REFUSAL, (body) => {
          this.refusal = (this.refusal ?? '') + body;
          this.emitText(body);
          this.mode = 'text';
        }, (partial) => {
          this.refusal = (this.refusal ?? '') + partial;
          this.emitText(partial);
        });
      case 'edit':
        return this.stepEdit();
      case 'search':
        return this.stepUntil(CLOSE_SEARCH, (body) => {
          this.search += body;
          this.mode = 'edit';
        }, (partial) => {
          this.search += partial;
        });
      case 'replace':
        return this.stepUntil(CLOSE_REPLACE, (body) => {
          this.replace += body;
          this.edit?.pairs.push({ search: trimOneNewline(this.search), replace: trimOneNewline(this.replace) });
          this.search = '';
          this.replace = '';
          this.mode = 'edit';
        }, (partial) => {
          this.replace += partial;
        });
    }
  }

  /** Plain text until the next `<uf-` tag. Holds back a possible partial tag. */
  private stepText(): boolean {
    const at = this.buf.indexOf(OPEN);
    if (at === -1) {
      const keep = partialSuffix(this.buf, OPEN);
      this.emitText(this.buf.slice(0, this.buf.length - keep));
      this.buf = this.buf.slice(this.buf.length - keep);
      return false;
    }
    this.emitText(this.buf.slice(0, at));
    this.buf = this.buf.slice(at);
    const end = this.buf.indexOf('>');
    if (end === -1) {
      return false;
    }
    const head = this.buf.slice(0, end + 1);
    this.buf = this.buf.slice(end + 1);
    this.openTag(head);
    return true;
  }

  private openTag(head: string): void {
    const match = /^<uf-([a-z]+)\b([^>]*?)(\/?)>$/s.exec(head);
    if (!match) {
      this.emitText(head);
      return;
    }
    const [, name, rawAttrs, selfClosing] = match;
    const attrs = parseAttrs(rawAttrs);
    if (name === 'write') {
      if (!attrs.path) {
        this.problems.push('<uf-write> without path');
      }
      if (selfClosing) {
        this.ops.push({ kind: 'write', path: attrs.path ?? '', content: '' });
        return;
      }
      this.current = { path: attrs.path ?? '', content: '' };
      this.mode = 'write';
      this.handlers.onOp?.({ op: 'write', path: this.current.path, phase: 'start' });
      return;
    }
    if (name === 'edit') {
      this.edit = { path: attrs.path ?? '', pairs: [] };
      if (!attrs.path) {
        this.problems.push('<uf-edit> without path');
      }
      this.mode = 'edit';
      this.handlers.onOp?.({ op: 'edit', path: this.edit.path, phase: 'start' });
      return;
    }
    if (name === 'delete') {
      const op: UfOp = { kind: 'delete', path: attrs.path ?? '' };
      this.ops.push(op);
      this.handlers.onOp?.({ op: 'delete', path: op.path, phase: 'start' });
      this.handlers.onOp?.({ op: 'delete', path: op.path, phase: 'end' });
      this.skipClosing('</uf-delete>');
      return;
    }
    if (name === 'rename') {
      const op: UfOp = { kind: 'rename', from: attrs.from ?? '', to: attrs.to ?? '' };
      this.ops.push(op);
      this.handlers.onOp?.({ op: 'rename', path: op.to, phase: 'start' });
      this.handlers.onOp?.({ op: 'rename', path: op.to, phase: 'end' });
      this.skipClosing('</uf-rename>');
      return;
    }
    if (name === 'refusal') {
      this.refusal = this.refusal ?? '';
      this.mode = 'refusal';
      return;
    }
    this.problems.push(`unknown tag <uf-${name}>`);
  }

  /** Tolerates `<uf-delete path="x"></uf-delete>` as well as the self-closing form. */
  private skipClosing(closing: string): void {
    const trimmed = this.buf.trimStart();
    if (trimmed.startsWith(closing)) {
      this.buf = trimmed.slice(closing.length);
    }
  }

  private stepEdit(): boolean {
    const candidates: Array<[string, number]> = [
      [OPEN_SEARCH, this.buf.indexOf(OPEN_SEARCH)],
      [OPEN_REPLACE, this.buf.indexOf(OPEN_REPLACE)],
      [CLOSE_EDIT, this.buf.indexOf(CLOSE_EDIT)],
    ];
    const found = candidates.filter(([, at]) => at !== -1).sort((a, b) => a[1] - b[1])[0];
    if (!found) {
      const keep = Math.max(
        partialSuffix(this.buf, OPEN_SEARCH),
        partialSuffix(this.buf, OPEN_REPLACE),
        partialSuffix(this.buf, CLOSE_EDIT),
      );
      this.buf = this.buf.slice(this.buf.length - keep);
      return false;
    }
    const [tag, at] = found;
    this.buf = this.buf.slice(at + tag.length);
    if (tag === OPEN_SEARCH) {
      this.search = '';
      this.mode = 'search';
    } else if (tag === OPEN_REPLACE) {
      this.replace = '';
      this.mode = 'replace';
    } else {
      const edit = this.edit;
      this.edit = null;
      this.mode = 'text';
      if (edit) {
        if (edit.pairs.length === 0) {
          this.problems.push(`<uf-edit> without search/replace for ${edit.path}`);
        }
        this.ops.push({ kind: 'edit', path: edit.path, pairs: edit.pairs });
        this.handlers.onOp?.({ op: 'edit', path: edit.path, phase: 'end' });
      }
    }
    return true;
  }

  /**
   * Consumes the buffer up to `closing`. Streams the safe part through `onPartial`
   * so long files do not sit in memory twice.
   */
  private stepUntil(
    closing: string,
    onClose: (body: string) => void,
    onPartial: (partial: string) => void,
  ): boolean {
    const at = this.buf.indexOf(closing);
    if (at === -1) {
      const keep = partialSuffix(this.buf, closing);
      const safe = this.buf.slice(0, this.buf.length - keep);
      if (safe) {
        onPartial(safe);
      }
      this.buf = this.buf.slice(this.buf.length - keep);
      return false;
    }
    const body = this.buf.slice(0, at);
    this.buf = this.buf.slice(at + closing.length);
    onClose(body);
    return true;
  }

  private emitText(delta: string): void {
    if (!delta) {
      return;
    }
    this.text += delta;
    this.handlers.onText?.(delta);
  }
}

/**
 * Length of the longest suffix of `value` that is a prefix of `token`.
 *
 * @example
 * partialSuffix('hello <uf', '<uf-'); // 3
 */
export function partialSuffix(value: string, token: string): number {
  const max = Math.min(value.length, token.length - 1);
  for (let size = max; size > 0; size -= 1) {
    if (token.startsWith(value.slice(value.length - size))) {
      return size;
    }
  }
  return 0;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    attrs[match[1]] = decodeEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Chat text without the blank lines left between file operations.
 *
 * @example
 * tidyText('Ok.\n\n\n\nFini.\n'); // 'Ok.\n\nFini.'
 */
export function tidyText(value: string): string {
  return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function trimOneNewline(value: string): string {
  return value.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
}

/**
 * File body as written between the tags: one leading/trailing newline removed,
 * and a markdown fence unwrapped if the model added one by mistake.
 *
 * @example
 * cleanContent('\n```js\nx\n```\n'); // 'x\n'
 */
export function cleanContent(value: string): string {
  let body = value.replace(/^\r?\n/, '');
  const fenced = /^```[\w-]*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(body);
  if (fenced) {
    body = `${fenced[1]}\n`;
  }
  if (!body.endsWith('\n') && body.length > 0) {
    body += '\n';
  }
  return body;
}
