import http from 'node:http';

const port = Number(process.env.COMPILER_PORT ?? 3001);

/**
 * Stub compile endpoint. A real implementation will run Vite with Runtime
 * externals and return a signed .happ to the Runtime. The compiler must not
 * persist the artefact; the gateway must never store a .happ.
 *
 * @example
 * fetch('http://localhost:3001/v1/compile', {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json' },
 *   body: JSON.stringify({ appId: '…', draftId: '…' }),
 * });
 */
const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'compiler' }));
    return;
  }
  if (req.method === 'POST' && url === '/v1/compile') {
    const body = await readBody(req);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'stub',
        message: 'Compiler stub: artefact packaging is not implemented yet.',
        request: body,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

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
