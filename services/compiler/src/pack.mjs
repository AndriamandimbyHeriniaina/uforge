import * as esbuild from 'esbuild';
import { seedSqlFromSpec } from './seed-sql.mjs';

/**
 * Minifies the guest player + spec into a srcdoc HTML document.
 * Nothing is written to disk.
 *
 * @example
 * const out = await packGuest({ spec, playerSource, appId, appName });
 */
export async function packGuest({ spec, playerSource, appId, appName }) {
  const capabilities = Array.isArray(spec?.capabilities)
    ? spec.capabilities
    : ['storage', 'database'];
  const specJson = JSON.stringify(spec ?? {}).replace(/</g, '\\u003c');
  const source = `window.__HAPP_SPEC__=${specJson};\n${playerSource || ''}`;
  const minified = await esbuild.transform(source, {
    minify: true,
    target: 'es2018',
    legalComments: 'none',
  });
  return {
    status: 'ok',
    manifest: {
      id: appId || 'app',
      version: '1.0.0',
      runtime: { min_version: spec?.app?.runtime?.min_version || '1.0.0' },
      capabilities,
      name: appName || spec?.app?.name || 'Mon application',
    },
    bundleJs: minified.code,
    seedSql: seedSqlFromSpec(spec),
  };
}
