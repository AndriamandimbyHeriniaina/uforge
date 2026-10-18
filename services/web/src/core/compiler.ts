import { COMPILER_URL } from '../config';
import type { AppManifest, Workspace } from './types';

export type BuildOk = {
  status: 'ok';
  html: string;
  manifest: AppManifest;
  size: number;
  warnings: string[];
};

export type BuildFail = {
  status: 'error';
  errors: Array<{ file?: string; line?: number; message: string }>;
};

/**
 * Asks the compiler for a self-contained document (doc/features/compiler.md).
 *
 * @example
 * const out = await buildWorkspace('preview', ws);
 * if (out.status === 'ok') frame.srcdoc = prepare(out.html);
 */
export async function buildWorkspace(mode: 'preview' | 'production', ws: Workspace): Promise<BuildOk | BuildFail> {
  try {
    const response = await fetch(`${COMPILER_URL}/v1/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        files: Object.entries(ws.files).map(([path, content]) => ({ path, content })),
        assets: Object.entries(ws.assets).map(([path, asset]) => ({
          path,
          mime: asset.mime,
          dataBase64: asset.dataBase64,
        })),
      }),
    });
    if (!response.ok) {
      return { status: 'error', errors: [{ message: `Compilateur : erreur HTTP ${response.status}` }] };
    }
    return (await response.json()) as BuildOk | BuildFail;
  } catch {
    return {
      status: 'error',
      errors: [{ message: 'Compilateur injoignable. Vérifie ta connexion puis réessaie.' }],
    };
  }
}
