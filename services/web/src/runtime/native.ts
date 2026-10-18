import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { parseDataUrl } from '../lib/bytes';
import { RuntimeCallError } from './errors';

/**
 * Device features used by the runtime.* bridge. Native plugins on Android
 * (Capacitor), browser APIs on the web. Runs in the HOST page, never in the guest.
 */

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type PickedFile = { name: string; mime: string; size: number; dataUrl: string };

const MAX_PICK_BYTES = 20 * 1024 * 1024;

/**
 * Opens a hidden file input in the host page (user activation propagates from the iframe).
 *
 * @example
 * const files = await pickFiles('image/*', false, 'environment');
 */
export function pickFiles(accept = '', multiple = false, capture?: 'environment' | 'user'): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (capture) {
      input.setAttribute('capture', capture);
    }
    input.style.display = 'none';
    let settled = false;
    const finish = (files: File[]): void => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    window.addEventListener(
      'focus',
      () => window.setTimeout(() => finish(Array.from(input.files ?? [])), 1000),
      { once: true },
    );
    document.body.append(input);
    input.click();
  });
}

/**
 * @example
 * const url = await readAsDataUrl(file);
 */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales an image (keeps the ratio) and re-encodes it.
 *
 * @example
 * const small = await resizeImage(dataUrl, 1280, 0.8, 'image/jpeg');
 */
export async function resizeImage(
  dataUrl: string,
  maxWidth: number,
  quality: number,
  mime = 'image/jpeg',
): Promise<{ dataUrl: string; width: number; height: number; mime: string }> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl, width: image.naturalWidth, height: image.naturalHeight, mime };
  }
  ctx.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL(mime, quality), width, height, mime };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new RuntimeCallError('invalid', 'image illisible'));
    image.src = src;
  });
}

/**
 * runtime.camera.capture
 *
 * @example
 * const photo = await capturePhoto({ maxWidth: 1280, quality: 0.8 });
 */
export async function capturePhoto(options: { maxWidth?: number; quality?: number }): Promise<{
  dataUrl: string;
  mime: string;
  width: number;
  height: number;
} | null> {
  const maxWidth = clampNumber(options.maxWidth, 64, 4096, 1280);
  const quality = clampNumber(options.quality, 0.1, 1, 0.8);
  let source: string | null = null;
  if (isNative()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: Math.round(quality * 100),
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: maxWidth,
      });
      source = photo.dataUrl ?? null;
    } catch {
      return null;
    }
  } else {
    const [file] = await pickFiles('image/*', false, 'environment');
    if (!file) {
      return null;
    }
    source = await readAsDataUrl(file);
  }
  if (!source) {
    return null;
  }
  return resizeImage(source, maxWidth, quality, 'image/jpeg');
}

/**
 * runtime.files.pick
 *
 * @example
 * const files = await pickAsDataUrls({ accept: '.csv', multiple: false });
 */
export async function pickAsDataUrls(options: { accept?: unknown; multiple?: unknown }): Promise<PickedFile[]> {
  const accept = typeof options.accept === 'string' ? options.accept : '';
  const files = await pickFiles(accept, options.multiple === true);
  const out: PickedFile[] = [];
  for (const file of files) {
    if (file.size > MAX_PICK_BYTES) {
      throw new RuntimeCallError('invalid', `${file.name} dépasse 20 Mo`);
    }
    out.push({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size, dataUrl: await readAsDataUrl(file) });
  }
  return out;
}

/**
 * Saves or shares a file. `data` is text or a data URL.
 *
 * @example
 * await saveFile('export.csv', 'text/csv', 'a,b\n1,2');
 */
export async function saveFile(name: string, mime: string, data: string | Blob): Promise<boolean> {
  const blob = typeof data === 'string' ? toBlob(data, mime) : data;
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const base64 = (parseDataUrl(await readAsDataUrl(blob)) ?? { base64: '' }).base64;
    const written = await Filesystem.writeFile({ path: safeName(name), data: base64, directory: Directory.Cache });
    try {
      await Share.share({ title: name, files: [written.uri] });
    } catch {
      return false;
    }
    return true;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName(name);
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

function toBlob(data: string, mime: string): Blob {
  const parsed = data.startsWith('data:') ? parseDataUrl(data) : null;
  if (parsed) {
    const binary = atob(parsed.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: parsed.mime || mime });
  }
  return new Blob([data], { type: mime || 'text/plain' });
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'fichier';
}

/**
 * runtime.share.send
 *
 * @example
 * await shareContent({ text: 'Regarde ça', url: 'https://example.com' });
 */
export async function shareContent(content: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share(content);
      return true;
    } catch {
      return false;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(content);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText([content.title, content.text, content.url].filter(Boolean).join('\n'));
    return true;
  } catch {
    return false;
  }
}

const OPENABLE = /^(https?:|tel:|mailto:|sms:|geo:|whatsapp:)/i;

/**
 * runtime.browser.open: outside the app (system browser, dialer, mail…).
 *
 * @example
 * await openExternal('tel:+33102030405');
 */
export async function openExternal(url: string): Promise<void> {
  if (typeof url !== 'string' || !OPENABLE.test(url)) {
    throw new RuntimeCallError('invalid', 'lien non autorisé (https, tel, mailto, sms, geo)');
  }
  if (/^https?:/i.test(url)) {
    if (isNative()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * runtime.http.request. Native HTTP on Android (no CORS); host fetch on the web (CORS applies).
 *
 * @example
 * const res = await httpRequest({ url: 'https://api.example.com/x', method: 'GET' });
 */
export async function httpRequest(options: {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  if (typeof options.url !== 'string' || !/^https?:\/\//i.test(options.url)) {
    throw new RuntimeCallError('invalid', 'url http(s) requise');
  }
  const method = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET';
  const headers =
    options.headers && typeof options.headers === 'object'
      ? Object.fromEntries(Object.entries(options.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
      : {};
  const body =
    options.body === undefined || options.body === null
      ? undefined
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  if (isNative()) {
    const res = await CapacitorHttp.request({
      url: options.url,
      method,
      headers,
      data: body,
      responseType: 'text',
    });
    return {
      status: res.status,
      headers: res.headers ?? {},
      body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
    };
  }
  try {
    const res = await fetch(options.url, { method, headers, body });
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: await res.text(),
    };
  } catch (err) {
    throw new RuntimeCallError(
      'unavailable',
      `requête impossible (réseau ou CORS) : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * @example
 * deviceInfo(); // { platform: 'web', online: true, language: 'fr-FR' }
 */
export function deviceInfo(): { platform: string; online: boolean; language: string } {
  return { platform: Capacitor.getPlatform(), online: navigator.onLine, language: navigator.language };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
