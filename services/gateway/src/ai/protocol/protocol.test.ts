import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UfStreamParser, cleanContent, partialSuffix, type UfOpEvent } from './uf-parser';
import { applyOps, checkPath, diffFiles, replaceOnce } from './workspace';

/** Feeds the answer in random-sized chunks to exercise the streaming paths. */
function parseChunked(answer: string, seed = 7) {
  const tokens: string[] = [];
  const events: UfOpEvent[] = [];
  const parser = new UfStreamParser({
    onText: (delta) => tokens.push(delta),
    onOp: (event) => events.push(event),
  });
  let rnd = seed;
  for (let i = 0; i < answer.length; ) {
    rnd = (rnd * 1103515245 + 12345) % 2147483648;
    const size = 1 + (rnd % 9);
    parser.push(answer.slice(i, i + size));
    i += size;
  }
  return { result: parser.finish(), tokens: tokens.join(''), events };
}

const ANSWER = `Je crée une liste de courses.
<uf-write path="index.html">
<!doctype html>
<p>a < b && c > d</p>
</uf-write>
<uf-edit path="src/app.js">
<uf-search>
const a = 1;
</uf-search>
<uf-replace>
const a = 2;
</uf-replace>
<uf-search>
let b;
</uf-search>
<uf-replace>
let b = 3;
</uf-replace>
</uf-edit>
<uf-delete path="old.js"/>
<uf-rename from="x.js" to="y.js"/>
C'est prêt : ajoute un article pour tester.`;

test('parses every operation and keeps chat text out of files', () => {
  for (const seed of [1, 7, 42, 99]) {
    const { result, tokens, events } = parseChunked(ANSWER, seed);
    assert.deepEqual(result.problems, []);
    assert.equal(result.refusal, null);
    assert.equal(result.ops.length, 4);
    assert.deepEqual(result.ops[0], {
      kind: 'write',
      path: 'index.html',
      content: '<!doctype html>\n<p>a < b && c > d</p>\n',
    });
    assert.deepEqual(result.ops[1], {
      kind: 'edit',
      path: 'src/app.js',
      pairs: [
        { search: 'const a = 1;', replace: 'const a = 2;' },
        { search: 'let b;', replace: 'let b = 3;' },
      ],
    });
    assert.deepEqual(result.ops[2], { kind: 'delete', path: 'old.js' });
    assert.deepEqual(result.ops[3], { kind: 'rename', from: 'x.js', to: 'y.js' });
    assert.ok(tokens.startsWith('Je crée une liste de courses.'));
    assert.ok(tokens.includes("C'est prêt"));
    assert.ok(!tokens.includes('uf-'));
    assert.ok(!tokens.includes('doctype'));
    assert.equal(result.text.split('\n')[0], 'Je crée une liste de courses.');
    assert.deepEqual(
      events.filter((e) => e.phase === 'start').map((e) => `${e.op}:${e.path}`),
      ['write:index.html', 'edit:src/app.js', 'delete:old.js', 'rename:y.js'],
    );
  }
});

test('refusal is streamed as text and flagged', () => {
  const { result, tokens } = parseChunked('<uf-refusal>Je ne peux pas faire ça.</uf-refusal>');
  assert.equal(result.refusal, 'Je ne peux pas faire ça.');
  assert.equal(tokens, 'Je ne peux pas faire ça.');
  assert.equal(result.ops.length, 0);
});

test('truncated answer reports an unterminated tag', () => {
  const { result } = parseChunked('Ok.<uf-write path="a.js">const x =');
  assert.equal(result.ops.length, 0);
  assert.match(result.problems[0], /unterminated <uf-write> for a.js/);
});

test('text that merely contains "<" is not swallowed', () => {
  const { result, tokens } = parseChunked('Prix < 10 € et <b>gras</b>.');
  assert.equal(tokens, 'Prix < 10 € et <b>gras</b>.');
  assert.equal(result.ops.length, 0);
});

test('cleanContent unwraps an accidental markdown fence', () => {
  assert.equal(cleanContent('\n```js\nconst a = 1;\n```\n'), 'const a = 1;\n');
  assert.equal(cleanContent('\nplain'), 'plain\n');
});

test('partialSuffix holds back a possible tag start', () => {
  assert.equal(partialSuffix('hello <u', '<uf-'), 2);
  assert.equal(partialSuffix('hello', '<uf-'), 0);
});

test('checkPath rejects escapes and binary targets', () => {
  assert.equal(checkPath('src/main.js'), null);
  assert.equal(checkPath('assets/icon.svg'), null);
  assert.ok(checkPath('../x.js'));
  assert.ok(checkPath('/abs.js'));
  assert.ok(checkPath('a//b.js'));
  assert.ok(checkPath('img.png'));
  assert.ok(checkPath('assets/logo.svg', new Set(['assets/logo.svg'])));
});

test('replaceOnce requires a unique match, tolerates trailing spaces', () => {
  assert.equal(replaceOnce('a\nb\n', 'b', 'c'), 'a\nc\n');
  assert.deepEqual(replaceOnce('x x', 'x', 'y'), { reason: 'found 2 times, add more context so it is unique' });
  assert.equal(replaceOnce('a  \nb\n', 'a\nb', 'z'), 'z\n');
  assert.deepEqual(replaceOnce('a', 'q', 'z'), { reason: 'not found in the current file' });
});

test('applyOps applies in order and reports failures without throwing', () => {
  const files = { 'src/app.js': 'const a = 1;\n', 'x.js': 'x', 'uforge.json': '{}' };
  const { files: next, failures } = applyOps(
    files,
    [
      { kind: 'write', path: 'index.html', content: '<p></p>\n' },
      { kind: 'edit', path: 'src/app.js', pairs: [{ search: 'const a = 1;', replace: 'const a = 2;' }] },
      { kind: 'rename', from: 'x.js', to: 'y.js' },
      { kind: 'edit', path: 'missing.js', pairs: [{ search: 'a', replace: 'b' }] },
      { kind: 'write', path: 'uforge.json', content: '{ broken' },
    ],
    new Set(),
  );
  assert.equal(next['index.html'], '<p></p>\n');
  assert.equal(next['src/app.js'], 'const a = 2;\n');
  assert.equal(next['y.js'], 'x');
  assert.equal(next['x.js'], undefined);
  assert.deepEqual(failures.map((f) => f.path), ['missing.js', 'uforge.json']);
});

test('diffFiles returns full contents and deletions', () => {
  assert.deepEqual(diffFiles({ 'a.js': '1', 'b.js': '2' }, { 'a.js': '1', 'c.js': '3' }), [
    { op: 'delete', path: 'b.js' },
    { op: 'write', path: 'c.js', content: '3' },
  ]);
});

test('the stub answer is a valid project in the protocol', async () => {
  const { stubAnswer } = await import('../providers/stub.adapter');
  const { result } = parseChunked(stubAnswer('Une appli de notes'));
  assert.deepEqual(result.problems, []);
  const { files, failures } = applyOps({}, result.ops, new Set());
  assert.deepEqual(failures, []);
  assert.deepEqual(Object.keys(files).sort(), [
    'assets/icon.svg',
    'index.html',
    'src/db.js',
    'src/main.js',
    'src/styles.css',
    'uforge.json',
  ]);
  assert.equal(JSON.parse(files['uforge.json']).name, 'Carnet');
  assert.ok(files['src/main.js'].includes('Une appli de notes'));
});

test('chat text keeps no blank-line runs from between operations', () => {
  const { result } = parseChunked('Je commence.\n<uf-write path="a.js">\nx\n</uf-write>\n\n<uf-delete path="b.js"/>\n\nC’est fait.\n');
  assert.equal(result.text, 'Je commence.\n\nC’est fait.');
});
