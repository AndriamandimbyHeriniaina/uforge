const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * UTF-8 string → bytes.
 *
 * @example
 * utf8('é'); // Uint8Array [195, 169]
 */
export function utf8(value: string): Uint8Array {
  return encoder.encode(value);
}

/**
 * Bytes → UTF-8 string.
 *
 * @example
 * fromUtf8(utf8('salut')); // 'salut'
 */
export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Bytes → base64 (chunked, safe for large buffers).
 *
 * @example
 * toBase64(new Uint8Array([1, 2])); // 'AQI='
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Base64 → bytes.
 *
 * @example
 * fromBase64('AQI='); // Uint8Array [1, 2]
 */
export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * SHA-256 hex digest.
 *
 * @example
 * await sha256Hex(utf8('a')); // 'ca978112…'
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Splits a data URL into mime type and base64 payload.
 *
 * @example
 * parseDataUrl('data:image/png;base64,AQI='); // { mime: 'image/png', base64: 'AQI=' }
 */
export function parseDataUrl(url: string): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!match) {
    return null;
  }
  const mime = match[1] || 'application/octet-stream';
  if (match[2]) {
    return { mime, base64: match[3] };
  }
  return { mime, base64: toBase64(utf8(decodeURIComponent(match[3]))) };
}

/**
 * Human size in French.
 *
 * @example
 * formatBytes(2048); // '2 Ko'
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} o`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
