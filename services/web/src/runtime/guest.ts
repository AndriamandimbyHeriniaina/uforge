/**
 * Builds what the Runtime injects at the top of the app document, before any
 * app script (doc/features/runtime.md § Affichage de l’appli):
 * CSP meta, `window.runtime` client, localStorage shim, error collector (preview).
 */

export type GuestConfig = {
  channel: string;
  app: { id: string; name: string; version: number; mode: 'preview' | 'live' };
  /** Preloaded values of the localStorage shim. */
  ls: Record<string, string>;
};

/**
 * CSP from the declared capabilities. Without `network`, nothing leaves the app.
 *
 * @example
 * cspFor(['camera']); // "default-src 'none'; … connect-src blob: data:"
 */
export function cspFor(capabilities: string[]): string {
  const net = capabilities.includes('network');
  const remote = net ? ' https: wss:' : '';
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' blob: data:${net ? ' https:' : ''}`,
    `style-src 'unsafe-inline' blob: data:${net ? ' https:' : ''}`,
    `img-src blob: data:${net ? ' https:' : ''}`,
    `font-src data:${net ? ' https:' : ''}`,
    `media-src blob: data:${net ? ' https:' : ''}`,
    `connect-src blob: data:${remote}`,
    'worker-src blob:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/**
 * Inserts CSP + bootstrap right after `<head>` (creates it when missing).
 *
 * @example
 * iframe.srcdoc = prepareDocument(build.html, config, manifest.capabilities);
 */
export function prepareDocument(html: string, config: GuestConfig, capabilities: string[]): string {
  const injection =
    `<meta http-equiv="Content-Security-Policy" content="${cspFor(capabilities)}">` +
    `<script>${guestBootstrap(config)}</script>`;
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + injection + html.slice(at);
  }
  const root = /<html\b[^>]*>/i.exec(html);
  if (root) {
    const at = root.index + root[0].length;
    return `${html.slice(0, at)}<head>${injection}</head>${html.slice(at)}`;
  }
  return `<!doctype html><head>${injection}</head>${html}`;
}

/**
 * Source of the guest-side bootstrap (classic inline script, runs first).
 *
 * @example
 * const code = guestBootstrap({ channel, app, ls: {} });
 */
export function guestBootstrap(config: GuestConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  return `(function () {
  'use strict';
  var CONFIG = ${json};
  var CH = CONFIG.channel;
  var pending = new Map();
  var seq = 0;
  function call(method, params) {
    return new Promise(function (resolve, reject) {
      seq += 1;
      pending.set(seq, { resolve: resolve, reject: reject });
      parent.postMessage({ __uforge: CH, kind: 'call', id: seq, method: method, params: params || {} }, '*');
    });
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== parent || !data || data.__uforge !== CH || data.kind !== 'result') return;
    var entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) { entry.resolve(data.value); return; }
    var error = new Error(data.error && data.error.message || 'runtime error');
    error.code = data.error && data.error.code || 'invalid';
    entry.reject(error);
  });
  function fn(method) { return function (params) { return call(method, params); }; }
  var runtime = {
    app: Object.freeze(CONFIG.app),
    capabilities: { has: function (name) { return call('capabilities.has', { name: name }); } },
    storage: {
      get: function (key) { return call('storage.get', { key: key }); },
      set: function (key, value) { return call('storage.set', { key: key, value: value }); },
      remove: function (key) { return call('storage.remove', { key: key }); },
      keys: function () { return call('storage.keys', {}); }
    },
    db: {
      query: function (sql, params) { return call('db.query', { sql: sql, params: params }); },
      exec: function (sql, params) { return call('db.exec', { sql: sql, params: params }); },
      batch: function (statements) { return call('db.batch', { statements: statements }); },
      migrate: function (steps) { return call('db.migrate', { steps: steps }); }
    },
    camera: { capture: fn('camera.capture') },
    files: { pick: fn('files.pick'), save: fn('files.save') },
    share: { send: fn('share.send') },
    browser: { open: function (url) { return call('browser.open', { url: url }); } },
    device: { info: fn('device.info') },
    http: { request: fn('http.request') },
    geo: { position: fn('geo.position') },
    notify: { schedule: fn('notify.schedule') },
    haptics: { impact: fn('haptics.impact') }
  };
  Object.defineProperty(window, 'runtime', { value: Object.freeze(runtime), enumerable: true });

  function makeStore(initial, persist) {
    var data = Object.assign(Object.create(null), initial);
    return {
      getItem: function (k) { k = String(k); return k in data ? data[k] : null; },
      setItem: function (k, v) { k = String(k); v = String(v); data[k] = v; if (persist) call('storage.set', { key: 'ls:' + k, value: v }).catch(function () {}); },
      removeItem: function (k) { k = String(k); delete data[k]; if (persist) call('storage.remove', { key: 'ls:' + k }).catch(function () {}); },
      clear: function () { var self = this; Object.keys(data).forEach(function (k) { self.removeItem(k); }); },
      key: function (i) { return Object.keys(data)[i] || null; },
      get length() { return Object.keys(data).length; }
    };
  }
  try { Object.defineProperty(window, 'localStorage', { value: makeStore(CONFIG.ls, true), configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, 'sessionStorage', { value: makeStore({}, false), configurable: true }); } catch (e) {}

  if (CONFIG.app.mode === 'preview') {
    var sent = 0;
    var report = function (kind, message, stack, line) {
      if (sent >= 20) return;
      sent += 1;
      parent.postMessage({ __uforge: CH, kind: 'error', error: {
        kind: kind,
        message: String(message || 'Erreur').slice(0, 2000),
        stack: stack ? String(stack).slice(0, 4000) : undefined,
        line: line || undefined
      } }, '*');
    };
    window.addEventListener('error', function (event) {
      if (event.target && event.target !== window && event.target.tagName) {
        report('resource', 'Ressource introuvable : ' + (event.target.src || event.target.href || event.target.tagName));
        return;
      }
      report('error', event.message, event.error && event.error.stack, event.lineno);
    }, true);
    window.addEventListener('unhandledrejection', function (event) {
      var reason = event.reason;
      report('rejection', reason && reason.message || String(reason), reason && reason.stack);
    });
    var original = console.error;
    console.error = function () {
      try {
        var args = Array.prototype.slice.call(arguments);
        var first = args[0];
        report('console', args.map(function (a) {
          if (a instanceof Error) return a.message;
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }).join(' '), first && first.stack);
      } catch (e) {}
      return original.apply(console, arguments);
    };
  }
})();`;
}

/**
 * Maps a line of the srcdoc document back to a project file, using the
 * `// ws:path` module markers of preview builds.
 *
 * @example
 * locate(documentText, 120); // { file: 'src/cart.js', line: 12, code: 'total += x.price' }
 */
export function locate(documentText: string, line: number): { file?: string; line?: number; code?: string } {
  const lines = documentText.split('\n');
  const index = line - 1;
  if (index < 0 || index >= lines.length) {
    return {};
  }
  for (let i = index; i >= 0; i -= 1) {
    const marker = /\/\/ ws:(\S+)\s*$/.exec(lines[i]);
    if (marker) {
      return { file: marker[1], line: index - i, code: lines[index].trim().slice(0, 200) };
    }
  }
  return { code: lines[index].trim().slice(0, 200) };
}

/**
 * First `about:srcdoc:LINE` of a stack trace.
 *
 * @example
 * stackLine('at f (about:srcdoc:42:7)'); // 42
 */
export function stackLine(stack: string | undefined): number | undefined {
  const match = /about:srcdoc:(\d+)(?::\d+)?/.exec(stack ?? '');
  return match ? Number(match[1]) : undefined;
}
