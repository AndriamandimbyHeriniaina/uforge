import { guestPlayerSource } from './guestPlayerSource';
import type { AppSpec } from './types';

/**
 * Builds a null-origin guest document. Spec is JSON data; the player is a Runtime external.
 *
 * @example
 * iframe.srcdoc = buildGuestDocument(spec);
 */
export function buildGuestDocument(spec: AppSpec | null): string {
  const safe = JSON.stringify(spec ?? { pages: [], capabilities: [] }).replace(
    /</g,
    '\\u003c',
  );
  return wrapGuestDocument(`window.__HAPP_SPEC__ = ${safe};\n${guestPlayerSource()}`);
}

/**
 * Wraps already-minified guest JS (compiler output) with Runtime CSS.
 *
 * @example
 * iframe.srcdoc = wrapGuestDocument(packed.bundleJs);
 */
export function wrapGuestDocument(script: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; touch-action: manipulation; overscroll-behavior: none; }
    body {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #f4efe8;
      color: #1c1814;
      display: flex;
      flex-direction: column;
    }
    #root { flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; }
    header.hero { flex-shrink: 0; padding: 0.75rem 1rem 0.4rem; }
    header.hero h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    header.hero p { margin: 0.3rem 0 0; color: #5c564e; line-height: 1.4; font-size: 0.9rem; }
    @media (max-height: 480px) { header.hero p { display: none; } }
    main { flex: 1; overflow: auto; padding: 0 1.2rem 6rem; -webkit-overflow-scrolling: touch; min-height: 0; }
    main.play {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0 1rem 0.5rem;
      touch-action: none;
    }
    .card {
      background: #fffdf9;
      border: 1px solid #e4dcd0;
      border-radius: 16px;
      padding: 0.9rem 1rem;
      margin: 0 0 0.7rem;
    }
    .row { display: flex; gap: 0.5rem; align-items: center; }
    .row.wrap { flex-wrap: wrap; }
    .stack { display: flex; flex-direction: column; gap: 0.4rem; }
    .lbl { margin: 0; font-size: 0.78rem; color: #5c564e; }
    .grow { flex: 1; min-width: 0; }
    input, textarea {
      width: 100%;
      border: 1px solid #e4dcd0;
      border-radius: 12px;
      padding: 0.7rem 0.8rem;
      font: inherit;
      background: #fff;
      margin: 0 0 0.5rem;
    }
    button.act {
      border: 0;
      border-radius: 12px;
      padding: 0.7rem 0.9rem;
      font: inherit;
      font-weight: 600;
      background: var(--accent, #d4894a);
      color: #1a120c;
      cursor: pointer;
    }
    button.ghost {
      border: 1px solid #e4dcd0;
      background: transparent;
      color: #1c1814;
      border-radius: 12px;
      padding: 0.45rem 0.7rem;
      cursor: pointer;
    }
    nav.tabs {
      display: flex;
      border-top: 1px solid #e4dcd0;
      background: #fffdf9;
    }
    nav.tabs button {
      flex: 1;
      border: 0;
      background: transparent;
      padding: 0.85rem 0.3rem;
      font-size: 0.78rem;
      color: #8a8278;
      cursor: pointer;
    }
    nav.tabs button.on { color: #1c1814; font-weight: 600; }
    nav.tabs { flex-shrink: 0; }
    canvas {
      flex: 1 1 auto;
      width: 100%;
      min-height: 120px;
      height: auto;
      display: block;
      background: #1c1814;
      border-radius: 16px;
      touch-action: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button.act, button.ghost, nav.tabs button { touch-action: manipulation; }
    .muted { color: #5c564e; flex-shrink: 0; }
    img.shot { width: 100%; border-radius: 12px; margin-top: 0.6rem; }
    img.thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
    .score { font-size: 1.7rem; font-weight: 700; margin: 0.15rem 0; flex-shrink: 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
${script}
  </script>
</body>
</html>`;
}
