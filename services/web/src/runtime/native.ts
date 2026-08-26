/**
 * Optional Capacitor plugins. Web preview ignores them and uses DOM pickers.
 *
 * @example
 * const shot = await nativeCaptureImage();
 */
export async function nativeCaptureImage(): Promise<string | null | undefined> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
    });
    return photo.dataUrl ?? null;
  } catch {
    return undefined;
  }
}

/**
 * Native share sheet. Returns false when the web fallback should run.
 *
 * @example
 * const used = await nativeShare('Salut');
 */
export async function nativeShare(text: string): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const { Share } = await import('@capacitor/share');
    await Share.share({ text });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads overlay.sqlite from the device data directory.
 *
 * @example
 * const bytes = await nativeReadOverlay('app-id');
 */
export async function nativeReadOverlay(appId: string): Promise<Uint8Array | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const file = await Filesystem.readFile({
      path: `data/${appId}/overlay.sqlite`,
      directory: Directory.Data,
    });
    if (typeof file.data !== 'string') {
      return null;
    }
    return base64ToBytes(file.data);
  } catch {
    return null;
  }
}

/**
 * Writes overlay.sqlite outside the .happ.
 *
 * @example
 * await nativeWriteOverlay('app-id', bytes);
 */
export async function nativeWriteOverlay(
  appId: string,
  bytes: Uint8Array,
): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.mkdir({
      path: `data/${appId}`,
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined);
    await Filesystem.writeFile({
      path: `data/${appId}/overlay.sqlite`,
      directory: Directory.Data,
      data: bytesToBase64(bytes),
    });
    return true;
  } catch {
    return false;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
