import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** Local-only Pages-like static probe. Never serves workspace files outside dist/. */
const root = resolve('dist');
const prefix = '/henrys-reading-world/';
const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg',
};

createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const relative = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : null;
    const file = relative === null ? null : resolve(root, relative || 'index.html');
    if (file !== null && file.startsWith(`${root}${sep}`)) {
        try {
            if ((await stat(file)).isDirectory()) {
                if (!url.pathname.endsWith('/')) {
                    response.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end();
                    return;
                }
                const entry = resolve(file, 'index.html');
                const bytes = await readFile(entry);
                response.writeHead(200, { 'Content-Type': mime['.html'] });
                response.end(bytes);
                return;
            }
            const bytes = await readFile(file);
            response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
            response.end(bytes);
            return;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                response.writeHead(500).end();
                return;
            }
        }
    }
    const fallback = await readFile(resolve(root, '404.html'));
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fallback);
}).listen(5198, '127.0.0.1');
