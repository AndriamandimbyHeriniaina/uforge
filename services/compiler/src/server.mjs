import http from 'node:http';
import { packGuest } from './pack.mjs';

const port = Number(process.env.COMPILER_PORT ?? 3001);
const allowedOrigins = new Set(
  (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .concat([
      'http://localhost:5173',
      'https://localhost',
      'capacitor://localhost',
      'http://localhost',
    ]),
);

/**
 * Compile endpoint. Returns a minified guest bundle + seed SQL + manifest.
 * The compiler must not persist the artefact; the gateway must never store a .happ.
 *
 * @example
 * fetch('http://localhost:3001/v1/compile', {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json' },
 *   body: JSON.stringify({ spec, playerSource, appId, appName }),
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
  if (req.method === 'POST' && url === '/v1/compile') {
    try {
      const body = await readBody(req);
      const packed = await packGuest({
        spec: body.spec,
        playerSource: body.playerSource,
        appId: body.appId,
        appName: body.appName,
      });
      json(res, 200, packed);
    } catch (err) {
      json(res, 500, {
        status: 'error',
        message: err instanceof Error ? err.message : 'compile failed',
      });
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

function cors(req, res) {
  const requestOrigin = req.headers.origin;
  const allow = allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

server.listen(port, '0.0.0.0');
