import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProject } from './build.mjs';
import { npmUrl, parseSpecifier } from './npm.mjs';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const base = () => [
  {
    path: 'uforge.json',
    content: JSON.stringify({ name: 'Test', icon: 'assets/icon.svg', capabilities: ['camera', 'bogus'] }),
  },
  { path: 'assets/icon.svg', content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
  {
    path: 'index.html',
    content: `<!doctype html><html><head><link rel="stylesheet" href="./src/styles.css"></head>
<body><img src="assets/logo.png" alt=""><main id="app"></main>
<script type="module" src="./src/main.js"></script></body></html>`,
  },
  { path: 'src/main.js', content: "import { label } from './util';\ndocument.getElementById('app').textContent = label('</script>');\n" },
  { path: 'src/util.js', content: 'export const label = (value) => `ok ${value}`;\n' },
  { path: 'src/styles.css', content: 'body { background: url(../assets/logo.png); color: red; }\n' },
];
const assets = [{ path: 'assets/logo.png', mime: 'image/png', dataBase64: PNG_1PX }];

test('builds a vanilla project into one self-contained document', async () => {
  const out = await buildProject({ mode: 'production', files: base(), assets });
  assert.equal(out.status, 'ok', JSON.stringify(out.errors));
  assert.match(out.html, /^<!doctype html>/i);
  assert.ok(!out.html.includes('src="./src/main.js"'), 'module script is inlined');
  assert.ok(!out.html.includes('href="./src/styles.css"'), 'stylesheet is inlined');
  assert.ok(out.html.includes('<img src="data:image/png;base64,'), 'img src is a data URL');
  assert.ok(out.html.includes('url(data:image/png;base64,'), 'css url() is a data URL');
  assert.ok(out.html.includes('<\\/script>'), 'closing script tags inside code are escaped');
  assert.equal(out.manifest.name, 'Test');
  assert.deepEqual(out.manifest.capabilities, ['camera']);
  assert.match(out.manifest.icon, /^data:image\/svg\+xml;base64,/);
});

test('preview keeps module markers for error mapping', async () => {
  const out = await buildProject({ mode: 'preview', files: base(), assets });
  assert.equal(out.status, 'ok');
  assert.match(out.html, /\/\/ ws:src\/util\.js/);
});

test('a missing import is a located build error', async () => {
  const files = base().map((file) =>
    file.path === 'src/main.js' ? { ...file, content: "import './nope.js';\n" } : file,
  );
  const out = await buildProject({ mode: 'preview', files, assets });
  assert.equal(out.status, 'error');
  assert.equal(out.errors[0].file, 'src/main.js');
  assert.match(out.errors[0].message, /introuvable/);
});

test('an undeclared npm package is refused with a clear message', async () => {
  const files = base().map((file) =>
    file.path === 'src/main.js' ? { ...file, content: "import confetti from 'canvas-confetti';\nconfetti();\n" } : file,
  );
  const out = await buildProject({ mode: 'preview', files, assets });
  assert.equal(out.status, 'error');
  assert.match(out.errors[0].message, /canvas-confetti.*dependencies/);
});

test('invalid uforge.json is reported on that file', async () => {
  const files = base().map((file) => (file.path === 'uforge.json' ? { ...file, content: '{ nope' } : file));
  const out = await buildProject({ mode: 'preview', files, assets });
  assert.equal(out.status, 'error');
  assert.equal(out.errors[0].file, 'uforge.json');
});

test('npm specifiers are pinned to the declared versions', () => {
  assert.deepEqual(parseSpecifier('@scope/pkg/sub/x.css'), { name: '@scope/pkg', subpath: '/sub/x.css' });
  assert.equal(
    npmUrl('preact/hooks', { preact: '10.24.3', 'chart.js': '4.4.1' }),
    'https://esm.sh/preact@10.24.3/hooks?target=es2020&deps=chart.js@4.4.1',
  );
});

test('embeds npm dependencies with JSX (network)', { skip: process.env.OFFLINE === '1' }, async () => {
  const files = [
    { path: 'uforge.json', content: JSON.stringify({ name: 'Jsx', jsx: 'preact', dependencies: { preact: '10.24.3' } }) },
    { path: 'index.html', content: '<!doctype html><div id="app"></div><script type="module" src="./src/main.jsx"></script>' },
    {
      path: 'src/main.jsx',
      content:
        "import { render } from 'preact';\nimport { useState } from 'preact/hooks';\n" +
        'function App() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }\n' +
        "render(<App />, document.getElementById('app'));\n",
    },
  ];
  const out = await buildProject({ mode: 'production', files, assets: [] });
  assert.equal(out.status, 'ok', JSON.stringify(out.errors));
  assert.ok(!/from\s*["']https?:/.test(out.html), 'no remote import left');
  assert.ok(!/import\s*["']/.test(out.html), 'no bare import left');
  assert.ok(out.size < 200_000);
});
