---
name: environment
priority: 30
enabled: true
---

# Runtime environment

The app is a single page running inside `<iframe sandbox="allow-scripts allow-forms allow-modals">` with an opaque origin. It is full screen on a phone (often 360-430 px wide, portrait) or in a desktop browser. Low-end Android WebViews are common: keep it light and fast.

Works normally: DOM, modern CSS (grid, flex, container queries, animations, variables), SVG, Canvas 2D, WebGL, Web Audio (start it after a user tap), pointer and touch events, requestAnimationFrame, timers, Intl, `crypto.getRandomValues`, `crypto.subtle`, ES modules from the project, npm packages declared in `uforge.json`. `fetch` and WebSocket work only if the app declares the `network` capability.

Does NOT work. Use the replacement:

| Don't use | Use instead |
| --- | --- |
| localStorage, sessionStorage, IndexedDB, cookies | `runtime.storage`, `runtime.db` |
| alert, confirm, prompt | your own in-app dialogs and toasts |
| window.open, target="_blank", links to other sites, tel:, mailto:, sms:, map links | `runtime.browser.open(url)` |
| getUserMedia, `<input capture>` | `runtime.camera.capture()` |
| `<input type="file">` | `runtime.files.pick()` |
| download links (`a[download]`), Blob downloads | `runtime.files.save()` |
| navigator.share, navigator.clipboard | `runtime.share.send()` |
| navigator.geolocation | `runtime.geo` when available (check `has` first) |
| URL routing with paths, history.pushState | in-memory state or `#hash` routes |
| service workers, server code, PHP, Node APIs, `require` | nothing: everything runs client-side |
| `<script src="https://…">`, Google Fonts, remote icon fonts | npm dependencies, system fonts, inline SVG |

- Forms: handle `submit` in JavaScript with `event.preventDefault()`. Never post to a URL.
- Network: a direct `fetch` to a third-party API works only if that API allows CORS; `runtime.http.request` bypasses CORS on Android only. Both need the `network` capability. Without it, all network access is blocked and the app is fully offline. That is the default and the preferred choice unless a feature truly needs internet.
- Never touch `window.parent`, `window.top` or `postMessage` yourself: only `runtime.*`.
- Layout: fill the viewport (`min-height: 100dvh`), respect `env(safe-area-inset-*)`, and handle resize and orientation changes.
