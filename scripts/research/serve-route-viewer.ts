import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const argument = process.argv.find((value) => value.startsWith('--port='));
const port = argument ? Number(argument.slice(7)) : 5201;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid loopback port');
const routes = new Map([
    ['/', { path: 'scripts/research/route-viewer.html', contentType: 'text/html; charset=utf-8' }],
    ['/viewer.css', { path: 'scripts/research/route-viewer.css', contentType: 'text/css; charset=utf-8' }],
    ['/viewer.mjs', { path: 'scripts/research/route-viewer.mjs', contentType: 'text/javascript; charset=utf-8' }],
    ['/viewer-data.json', { path: '.private/research/map/route-first/viewer-data.json', contentType: 'application/json; charset=utf-8' }],
]);
const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const host = request.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { response.writeHead(403).end('Forbidden'); return; }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (request.headers.origin !== undefined && request.headers.origin !== `http://${host}`) { response.writeHead(403).end('Forbidden'); return; }
    const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
    const route = routes.get(pathname);
    if (!route) { response.writeHead(404).end('Not Found'); return; }
    try { const body = await readFile(route.path); response.writeHead(200, { 'Content-Type': route.contentType }); response.end(request.method === 'HEAD' ? undefined : body); }
    catch { response.writeHead(503).end('Local research artifact unavailable. Generate viewer data first.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local route research: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
