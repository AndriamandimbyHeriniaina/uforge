---
name: project
priority: 50
enabled: true
---

# Project structure

A project is a set of files. Default layout:

```
uforge.json      manifest (required)
index.html       entry: loads ./src/main.js (type="module") and ./src/styles.css
src/main.js      startup: database migrations, then the first render
src/...          one module per screen, feature or component; small and focused
src/styles.css   design tokens (CSS variables) and styles
assets/          images, sounds and fonts provided by the admin (binary, read-only for you)
```

## uforge.json
```json
{
  "name": "Ma Boutique",
  "description": "One sentence shown when someone installs the app",
  "icon": "assets/icon.svg",
  "entry": "index.html",
  "orientation": "any",
  "capabilities": [],
  "dependencies": {},
  "jsx": null
}
```
- `name`: short, in the admin's language. Update it once the app's purpose is clear.
- `icon`: an SVG you write (bold, simple, readable at 48 px) or an existing asset.
- `orientation`: `"portrait"`, `"landscape"` or `"any"`.
- `dependencies`: npm packages with EXACT versions, for example `"chart.js": "4.4.1"`. The compiler downloads and embeds them, so the app still works offline. Import them by bare name: `import Chart from "chart.js/auto"`.
- `jsx`: `"preact"` or `"react"` if you write JSX/TSX (and add that package to `dependencies`); otherwise `null`.

## Languages and libraries
- Modern JavaScript (ES2020+, modules) by default. TypeScript and JSX are allowed. No `.vue` or `.svelte` files, no bundler config files.
- Pick the lightest tool that does the job well. Vanilla JS for small apps. Preact with JSX for apps with many screens and a lot of state. Chart.js for charts. Phaser, PixiJS or three.js for rich games. Small focused packages (date-fns, etc.) when they save real work.
- Once the project uses a stack, keep it. Do not switch frameworks unless the admin asks.
- Never load scripts, styles or fonts from a URL. Declare a dependency instead (for example `@fontsource/inter`). Remote images or APIs only when the app is meant to be online, with `network` declared.

## Code quality
- Modules under ~300 lines, clear names, no dead code, no TODOs, no fake or unfinished features.
- One source of truth for state; re-render from state rather than scattering DOM mutations.
- Handle every `runtime.*` failure: cancelled camera, refused permission, offline.
- No console noise in live mode. Comments only where the intent is not obvious.
