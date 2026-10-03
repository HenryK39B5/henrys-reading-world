import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// A static-file-only local host, not an application API or a deployment command.
const root = path.resolve('.private/play-static-check');
const prefix = '/henrys-reading-world';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
http.createServer((req,res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let url;
    try { url = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (url !== prefix && !url.startsWith(`${prefix}/`)) { res.writeHead(404); res.end(); return; }
    let file = path.resolve(root, `.${url.slice(prefix.length) || '/'}`);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
        if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
        const content = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type':types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store' });
        res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(5316,'127.0.0.1',() => console.log(`Static Pages check: http://127.0.0.1:5316${prefix}/`));
