import type { GenerateDto } from '../generate.dto';
import type { ContentPart, ImageMime } from '../providers/provider.types';
import type { OpFailure, WorkspaceFiles } from '../protocol/workspace';

/**
 * Builds the user content of a turn. No output-format instruction lives here:
 * the protocol is in skills/prompt/10-output-protocol.md. The project block
 * comes first and carries a cache breakpoint (stable between retries).
 *
 * @example
 * const parts = buildTurnParts(dto);
 */
export function buildTurnParts(dto: GenerateDto): ContentPart[] {
  const files = [...(dto.files ?? [])].sort((a, b) => a.path.localeCompare(b.path));
  const assets = [...(dto.assets ?? [])].sort((a, b) => a.path.localeCompare(b.path));
  const parts: ContentPart[] = [];

  const tree = [...files.map((file) => file.path), ...assets.map((asset) => asset.path)].sort();
  const project = [
    '# Project',
    '',
    '## Tree',
    tree.length ? tree.map((path) => `- ${path}`).join('\n') : '(empty project)',
    '',
    '## Text files',
    files.length
      ? files.map((file) => `<file path="${file.path}">\n${file.content}\n</file>`).join('\n\n')
      : '(none)',
    '',
    '## Binary assets (reference them by path; you cannot read or write them)',
    assets.length
      ? assets.map((asset) => `- ${asset.path} (${asset.mime}, ${formatSize(asset.size)})`).join('\n')
      : '(none)',
  ].join('\n');
  parts.push({ type: 'text', text: project, cache: true });

  const conversation = (dto.conversation ?? []).slice(-20);
  if (conversation.length) {
    parts.push({
      type: 'text',
      text: [
        '# Recent conversation',
        ...conversation.map(
          (turn) => `${turn.role === 'user' ? 'Admin' : 'You'}: ${clip(turn.text, 2000)}`,
        ),
      ].join('\n'),
    });
  }

  const errors = dto.errors ?? [];
  if (errors.length) {
    parts.push({
      type: 'text',
      text: [
        '# Errors reported by the preview or the build',
        ...errors.map((error) => {
          const where = error.file ? ` ${error.file}${error.line ? `:${error.line}` : ''}` : '';
          const stack = error.stack ? `\n  ${clip(error.stack, 1200).replace(/\n/g, '\n  ')}` : '';
          return `- [${error.source}]${where} ${error.message}${stack}`;
        }),
      ].join('\n'),
    });
  }

  for (const attachment of dto.attachments ?? []) {
    const added = attachment.assetPath
      ? ` It was added to the project as ${attachment.assetPath}.`
      : ' It is for reference only (not in the project).';
    if (attachment.kind === 'image' && attachment.dataBase64) {
      parts.push({ type: 'text', text: `# Attachment: ${attachment.name} (image).${added}` });
      parts.push({
        type: 'image',
        mime: attachment.mime as ImageMime,
        dataBase64: attachment.dataBase64,
      });
    } else if (attachment.kind === 'text' && attachment.content !== undefined) {
      parts.push({
        type: 'text',
        text: `# Attachment: ${attachment.name} (${attachment.mime})\n<attachment name="${attachment.name}">\n${attachment.content}\n</attachment>`,
      });
    }
  }

  parts.push({ type: 'text', text: `# Admin message\n${dto.message}` });
  return parts;
}

/**
 * Follow-up instruction when some operations could not be applied.
 *
 * @example
 * const text = buildRetryText(failures, files);
 */
export function buildRetryText(failures: OpFailure[], files: WorkspaceFiles): string {
  const paths = [...new Set(failures.map((failure) => failure.path))];
  const current = paths
    .filter((path) => files[path] !== undefined)
    .map((path) => `<file path="${path}">\n${files[path]}\n</file>`)
    .join('\n\n');
  return [
    'Some of your file operations could not be applied:',
    ...failures.map((failure) => `- ${failure.path}: ${failure.reason}`),
    '',
    'Every other operation was applied.',
    current ? `Current content of the affected files:\n\n${current}\n` : '',
    'Answer again with ONLY the corrective operations, preferably uf-write with the complete file. No chat text.',
  ].join('\n');
}

/**
 * Characters counted against `PlanQuota.maxContextChars`.
 *
 * @example
 * contextChars(dto); // 12345
 */
export function contextChars(dto: GenerateDto): number {
  const files = (dto.files ?? []).reduce((sum, file) => sum + file.content.length, 0);
  const attachments = (dto.attachments ?? []).reduce(
    (sum, attachment) => sum + (attachment.content?.length ?? 0),
    0,
  );
  const conversation = (dto.conversation ?? []).reduce((sum, turn) => sum + turn.text.length, 0);
  const errors = (dto.errors ?? []).reduce(
    (sum, error) => sum + error.message.length + (error.stack?.length ?? 0),
    0,
  );
  return files + attachments + conversation + errors;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
