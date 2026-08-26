import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native Runtime shell. Guest UI stays in the sandboxed WebView iframe.
 *
 * @example
 * npx cap sync && npx cap open android
 */
const config: CapacitorConfig = {
  appId: 'app.uforge.runtime',
  appName: 'Uforge',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
