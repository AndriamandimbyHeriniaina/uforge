import * as esbuild from 'esbuild';
import { parse } from 'node-html-parser';
import { posix } from 'node:path';
import { fetchCached, npmUrl } from './npm.mjs';

const CODE_LOADERS = {
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx', ts: 'ts', mts: 'ts', tsx: 'tsx',
  json: 'json', css: 'css', txt: 'text', md: 'text', csv: 'text', html: 'text',
};
const DATAURL_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'webm', 'glb', 'gltf',
]);
const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm',
};
const CAPABILITIES = new Set(['camera', 'network', 'geolocation', 'notifications', 'haptics']);
const RESOLVE_SUFFIXES = [
  '', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.json',
  '/index.js', '/index.ts', '/index.tsx', '/index.jsx',
];
const URL_ATTRIBUTES = [
  ['img', 'src'], ['source', 'src'], ['audio', 'src'], ['video', 'src'], ['video', 'poster'],
  ['link[rel~="icon"]', 'href'], ['link[rel="apple-touch-icon"]', 'href'], ['image', 'href'],
];
const MAX_BYTES = 15 * 1024 * 1024;
const WARN_BYTES = 5 * 1024 * 1024;

class BuildError extends Error {
  constructor(errors) {
    super(errors.map((error) => error.message).join('\n'));
    this.errors = errors;
  }
}

/**
 * Builds a workspace into one self-contained HTML document.
 *
 * @example
 * const out = await buildProject({
 *   mode: 'preview',
 *   files: [{ path: 'index.html', content: '<script type="module" src="./src/main.js"></script>' },
 *           { path: 'src/main.js', content: 'document.body.textContent = "ok"' }],
 *   assets: [],
 * });
 * // { status: 'ok', html: '<!doctype html>…', manifest: {…}, size, warnings: [] }
 */
export async function buildProject({ mode = 'preview', files = [], assets = [] }) {
  const production = mode === 'production';
  const ctx = {
    files: Object.fromEntries(files.map((file) => [file.path, String(file.content ?? '')])),
    assets: Object.fromEntries(
      assets.map((asset) => [
        asset.path,
        { mime: asset.mime || mimeOf(asset.path), bytes: Buffer.from(asset.dataBase64 ?? '', 'base64') },
      ]),
    ),
    warnings: [],
  };
  try {
    const manifest = readManifest(ctx);
    ctx.dependencies = manifest.dependencies ?? {};
    ctx.jsx = manifest.jsx === 'preact' || manifest.jsx === 'react' ? manifest.jsx : null;
    const entry = typeof manifest.entry === 'string' && manifest.entry ? manifest.entry : 'index.html';
    const html = ctx.files[entry];
    if (html === undefined) {
      throw new BuildError([{ file: entry, message: `Le point d’entrée ${entry} est introuvable.` }]);
    }
    ctx.htmlDir = posix.dirname(entry) === '.' ? '' : posix.dirname(entry);
    const document = await buildDocument(html, ctx, production);
    const size = Buffer.byteLength(document, 'utf8');
    if (size > MAX_BYTES) {
      throw new BuildError([{ message: `L’appli dépasse 15 Mo une fois construite (${mb(size)}).` }]);
    }
    if (size > WARN_BYTES) {
      ctx.warnings.push(`L’appli pèse ${mb(size)} : allège les images ou les dépendances.`);
    }
    return {
      status: 'ok',
      html: document,
      manifest: publicManifest(manifest, ctx),
      size,
      warnings: ctx.warnings,
    };
  } catch (err) {
    if (err instanceof BuildError) {
      return { status: 'error', errors: err.errors };
    }
    if (err && Array.isArray(err.errors) && err.errors.length) {
      return { status: 'error', errors: err.errors.map(fromEsbuildMessage) };
    }
    return { status: 'error', errors: [{ message: err instanceof Error ? err.message : String(err) }] };
  }
}

function readManifest(ctx) {
  const raw = ctx.files['uforge.json'];
  if (raw === undefined) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('must be an object');
    }
    return parsed;
  } catch (err) {
    throw new BuildError([{ file: 'uforge.json', message: `uforge.json invalide : ${err.message}` }]);
  }
}

function publicManifest(manifest, ctx) {
  const orientation = ['portrait', 'landscape', 'any'].includes(manifest.orientation)
    ? manifest.orientation
    : 'any';
  return {
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : 'Mon application',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    icon: typeof manifest.icon === 'string' ? dataUrlOf(manifest.icon.replace(/^\.\//, ''), ctx) : null,
    orientation,
    capabilities: Array.isArray(manifest.capabilities)
      ? [...new Set(manifest.capabilities.filter((cap) => CAPABILITIES.has(cap)))]
      : [],
  };
}

async function buildDocument(html, ctx, production) {
  const root = parse(html, {
    comment: true,
    blockTextElements: { script: true, noscript: true, style: true, pre: true },
  });
  const slots = [];
  const slot = (code) => {
    slots.push(code);
    return `/*__UF_SLOT_${slots.length - 1}__*/`;
  };
  const head = root.querySelector('head');
  const styles = [];

  for (const script of root.querySelectorAll('script')) {
    const src = script.getAttribute('src');
    const isModule = (script.getAttribute('type') ?? '').trim() === 'module';
    if (src) {
      if (isRemote(src)) {
        ctx.warnings.push(`Script distant ${src} : il ne marchera pas hors ligne.`);
        continue;
      }
      const path = resolveFromHtml(src, ctx);
      const out = await bundle(ctx, production, { entry: path, format: isModule ? 'esm' : 'iife' });
      script.removeAttribute('src');
      script.textContent = slot(escapeScript(out.js));
      styles.push(...out.css);
      continue;
    }
    const inline = script.textContent ?? '';
    if (isModule && /\bimport\b/.test(inline)) {
      const out = await bundle(ctx, production, { stdin: inline, format: 'esm' });
      script.textContent = slot(escapeScript(out.js));
      styles.push(...out.css);
    }
  }

  for (const link of root.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href');
    if (!href || isRemote(href)) {
      if (href) {
        ctx.warnings.push(`Feuille de style distante ${href} : elle ne marchera pas hors ligne.`);
      }
      continue;
    }
    const out = await bundle(ctx, production, { entry: resolveFromHtml(href, ctx), format: 'esm' });
    link.replaceWith(`<style>${slot(escapeStyle(out.css.join('\n')))}</style>`);
  }

  if (styles.length) {
    const block = `<style>${slot(escapeStyle(styles.join('\n')))}</style>`;
    if (head) {
      head.insertAdjacentHTML('beforeend', block);
    } else {
      root.insertAdjacentHTML('afterbegin', block);
    }
  }

  for (const [selector, attribute] of URL_ATTRIBUTES) {
    for (const node of root.querySelectorAll(selector)) {
      const value = node.getAttribute(attribute);
      if (!value || isRemote(value) || value.startsWith('data:') || value.startsWith('#')) {
        continue;
      }
      const path = posix.normalize(posix.join(ctx.htmlDir, value.split(/[?#]/)[0]));
      const url = dataUrlOf(path, ctx);
      if (url) {
        node.setAttribute(attribute, slot(url));
      } else {
        ctx.warnings.push(`Fichier introuvable : ${value}`);
      }
    }
  }

  let out = root.toString();
  out = out.replace(/\/\*__UF_SLOT_(\d+)__\*\//g, (_, index) => slots[Number(index)]);
  if (!/^\s*<!doctype/i.test(out)) {
    out = `<!doctype html>\n${out}`;
  }
  return out;
}

async function bundle(ctx, production, { entry, stdin, format }) {
  const result = await esbuild.build({
    ...(stdin !== undefined
      ? { stdin: { contents: stdin, loader: 'js', sourcefile: 'index.html' } }
      : { entryPoints: [`ws:${entry}`] }),
    bundle: true,
    write: false,
    outdir: '/out',
    entryNames: '[name]',
    assetNames: '[name]',
    platform: 'browser',
    format,
    target: 'es2020',
    minify: production,
    legalComments: production ? 'none' : 'inline',
    charset: 'utf8',
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
    ...(ctx.jsx ? { jsx: 'automatic', jsxImportSource: ctx.jsx } : {}),
    plugins: [workspacePlugin(ctx)],
  });
  for (const warning of result.warnings) {
    ctx.warnings.push(fromEsbuildMessage(warning).message);
  }
  const js = result.outputFiles.filter((file) => file.path.endsWith('.js')).map((file) => file.text).join('\n');
  const css = result.outputFiles.filter((file) => file.path.endsWith('.css')).map((file) => file.text);
  return { js, css };
}

function workspacePlugin(ctx) {
  return {
    name: 'uforge-workspace',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const spec = args.path;
        if (spec.startsWith('ws:')) {
          return resolveWorkspace(spec.slice(3), ctx);
        }
        if (/^https?:\/\//.test(spec)) {
          return { path: spec, namespace: 'http-url' };
        }
        if (args.namespace === 'http-url') {
          return { path: new URL(spec, args.importer).href, namespace: 'http-url' };
        }
        if (spec.startsWith('data:')) {
          return { path: spec, external: true };
        }
        if (spec.startsWith('.') || spec.startsWith('/')) {
          const base = args.namespace === 'ws' ? posix.dirname(args.importer) : ctx.htmlDir;
          const target = spec.startsWith('/') ? spec.slice(1) : posix.join(base, spec);
          return resolveWorkspace(posix.normalize(target), ctx, spec, args.importer);
        }
        try {
          return { path: npmUrl(spec, ctx.dependencies), namespace: 'http-url' };
        } catch (err) {
          return { errors: [{ text: err.message }] };
        }
      });

      build.onLoad({ filter: /.*/, namespace: 'ws' }, (args) => {
        const ext = extOf(args.path);
        if (args.path in ctx.files) {
          const loader = DATAURL_EXT.has(ext) ? 'dataurl' : (CODE_LOADERS[ext] ?? 'text');
          return { contents: ctx.files[args.path], loader };
        }
        const asset = ctx.assets[args.path];
        if (asset) {
          return { contents: asset.bytes, loader: DATAURL_EXT.has(ext) ? 'dataurl' : 'binary' };
        }
        return { errors: [{ text: `Fichier introuvable : ${args.path}` }] };
      });

      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
        const { contents, contentType } = await fetchCached(args.path);
        const ext = extOf(new URL(args.path).pathname);
        let loader = 'js';
        if (ext === 'css' || contentType.includes('text/css')) {
          loader = 'css';
        } else if (ext === 'json') {
          loader = 'json';
        } else if (DATAURL_EXT.has(ext)) {
          loader = 'dataurl';
        }
        return { contents, loader };
      });
    },
  };
}

function resolveWorkspace(target, ctx, spec = target, importer = '') {
  if (target.startsWith('..')) {
    return { errors: [{ text: `Import hors du projet : ${spec}` }] };
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${target}${suffix}`;
    if (candidate in ctx.files || candidate in ctx.assets) {
      return { path: candidate, namespace: 'ws' };
    }
  }
  const from = importer ? ` (importé depuis ${importer})` : '';
  return { errors: [{ text: `Fichier introuvable : ${spec}${from}` }] };
}

function resolveFromHtml(ref, ctx) {
  const clean = ref.split(/[?#]/)[0];
  const path = clean.startsWith('/') ? clean.slice(1) : posix.normalize(posix.join(ctx.htmlDir, clean));
  if (!(path in ctx.files) && !(path in ctx.assets)) {
    throw new BuildError([{ file: 'index.html', message: `Fichier introuvable : ${ref}` }]);
  }
  return path;
}

function dataUrlOf(path, ctx) {
  if (path in ctx.files) {
    const mime = mimeOf(path);
    return `data:${mime};base64,${Buffer.from(ctx.files[path], 'utf8').toString('base64')}`;
  }
  const asset = ctx.assets[path];
  if (asset) {
    return `data:${asset.mime || mimeOf(path)};base64,${asset.bytes.toString('base64')}`;
  }
  return null;
}

function fromEsbuildMessage(message) {
  const location = message.location;
  const file = location?.file?.replace(/^ws:/, '');
  return {
    ...(file ? { file } : {}),
    ...(location?.line ? { line: location.line } : {}),
    message: message.text ?? String(message),
  };
}

function escapeScript(code) {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function escapeStyle(code) {
  return code.replace(/<\/(style)/gi, '<\\/$1');
}

function isRemote(value) {
  return /^(https?:)?\/\//i.test(value);
}

function extOf(path) {
  const name = path.split('/').pop() ?? '';
  return name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
}

function mimeOf(path) {
  return MIME_BY_EXT[extOf(path)] ?? 'application/octet-stream';
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
