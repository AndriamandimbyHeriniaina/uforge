import http from 'node:http';
import { buildProject } from './build.mjs';

const port = Number(process.env.COMPILER_PORT ?? 3001);
const MAX_BODY = 60 * 1024 * 1024;
const allowedOrigins = new Set(
  (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .concat(['http://localhost:5173', 'https://localhost', 'capacitor://localhost', 'http://localhost']),
);

/**
 * Stateless build service. Never persists a workspace or an output.
 *
 * @example
 * fetch('http://localhost:3001/v1/build', {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json' },
 *   body: JSON.stringify({ mode: 'preview', files, assets }),
 * });
 */
const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && url === '/health') {
    json(res, 200, { status: 'ok', service: 'compiler' });
    return;
  }
  if (req.method === 'POST' && url === '/v1/build') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      json(res, 413, { status: 'error', errors: [{ message: err.message }] });
      return;
    }
    if (!Array.isArray(body.files)) {
      json(res, 400, { status: 'error', errors: [{ message: 'files must be an array' }] });
      return;
    }
    const started = Date.now();
    const out = await buildProject({
      mode: body.mode === 'production' ? 'production' : 'preview',
      files: body.files,
      assets: Array.isArray(body.assets) ? body.assets : [],
    });
    console.log(
      `build ${body.mode ?? 'preview'} ${out.status} ${body.files.length} files in ${Date.now() - started} ms`,
    );
    json(res, 200, out);
    return;
  }
  res.writeHead(404);
  res.end();
});

function cors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.has(origin) ? origin : 'http://localhost:5173');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

server.listen(port, '0.0.0.0', () => console.log(`compiler listening on ${port}`));
