import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const argument = process.argv.find((value) => value.startsWith('--port='));
const port = argument === undefined ? 5199 : Number(argument.slice(7));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid loopback port');
const routes = new Map([
    ['/', { path: 'scripts/research/projection-window-viewer.html', type: 'text/html; charset=utf-8' }],
    ['/viewer.mjs', { path: 'scripts/research/projection-window-viewer.mjs', type: 'text/javascript; charset=utf-8' }],
    ['/viewer.css', { path: 'scripts/research/projection-window-viewer.css', type: 'text/css; charset=utf-8' }],
    ['/viewer-data.json', { path: '.private/research/map/projection-window/viewer-data.json', type: 'application/json; charset=utf-8' }],
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
    const route = routes.get(new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname);
    if (route === undefined) { response.writeHead(404).end('Not Found'); return; }
    try {
        let body = await readFile(route.path);
        const supplementPath = '.private/research/map/projection-pipeline-holdout/viewer-supplement.json';
        if (route.path.endsWith('/viewer-data.json') && existsSync(supplementPath)) {
            const base = JSON.parse(body.toString('utf8')) as { inputSha256: string; points: unknown[]; views: unknown[]; summary: unknown[]; crossBookReferences?: unknown[] };
            const extra = JSON.parse(await readFile(supplementPath, 'utf8')) as { inputSha256: string; views: { coordinates: number[][] }[]; summary: unknown[]; crossBookReferences: unknown[] };
            if (extra.inputSha256 !== base.inputSha256 || extra.views.some((v) => v.coordinates.length !== base.points.length || v.coordinates.some((row) => row.length !== 2 || row.some((n) => !Number.isFinite(n))))) throw new Error('supplement input mismatch');
            base.views.push(...extra.views); base.summary.push(...extra.summary); base.crossBookReferences = extra.crossBookReferences;
            body = Buffer.from(JSON.stringify(base));
        }
        response.writeHead(200, { 'Content-Type': route.type });
        response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(503).end('Research artifact unavailable; generate it first.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Projection research viewer: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
