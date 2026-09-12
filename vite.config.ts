import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { validateSnapshot } from './src/domain/validate.ts';

const LOCAL_SNAPSHOT_ROUTE = '/__local_snapshot';
const LOCAL_COVER_PREFIX = '/__local_cover/';
const LOCAL_SNAPSHOT_FILE = '.private/local-snapshot.json';
const LOCAL_COVER_DIR = '.private/covers';
const COVER_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u;
const COVER_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};

function sendText(res: ServerResponse, status: number, body: string): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(body);
}

/** Serves one locally held cover. File names are pattern-checked, so no traversal is possible. */
async function sendLocalCover(path: string, res: ServerResponse): Promise<void> {
    const fileName = path.slice(LOCAL_COVER_PREFIX.length);
    if (!COVER_FILE_PATTERN.test(fileName)) {
        sendText(res, 404, 'Not Found');
        return;
    }
    const extension = fileName.split('.').pop() ?? '';
    try {
        const bytes = await readFile(resolve(process.cwd(), LOCAL_COVER_DIR, fileName));
        res.statusCode = 200;
        res.setHeader('Content-Type', COVER_CONTENT_TYPES[extension] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex');
        res.end(bytes);
    } catch {
        sendText(res, 404, 'Not Found');
    }
}

/**
 * Local-only development snapshot endpoint.
 *
 * The approved-as-public snapshot is the only data source for normal `dev`, `build`
 * and `preview`. Private material is reachable exclusively through `dev:local`, which
 * binds to loopback, serves one fixed route and is denied during production builds.
 */
function localSnapshotPlugin(enabled: boolean): Plugin {
    return {
        name: 'reading-world-local-snapshot',
        config(_config, env) {
            if (enabled && env.command === 'build') {
                throw new Error(
                    'Local mode cannot be used for a production build. Public builds read src/data/public-snapshot.json only.',
                );
            }
        },
        configureServer(server) {
            if (!enabled) {
                return;
            }
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? '').split('?')[0] ?? '';
                if (path !== LOCAL_SNAPSHOT_ROUTE && !path.startsWith(LOCAL_COVER_PREFIX)) {
                    next();
                    return;
                }
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    res.statusCode = 405;
                    res.setHeader('Allow', 'GET, HEAD');
                    res.end('Method Not Allowed');
                    return;
                }
                if (path.startsWith(LOCAL_COVER_PREFIX)) {
                    void sendLocalCover(path, res);
                    return;
                }
                void (async () => {
                    try {
                        const raw = await readFile(resolve(process.cwd(), LOCAL_SNAPSHOT_FILE), 'utf8');
                        const result = validateSnapshot(JSON.parse(raw));
                        if (!result.ok) {
                            // Validation messages never include highlight text.
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json; charset=utf-8');
                            res.end(JSON.stringify({ error: 'invalid local snapshot', errors: result.errors }));
                            return;
                        }
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-store');
                        res.setHeader('X-Robots-Tag', 'noindex');
                        res.end(JSON.stringify(result.snapshot));
                    } catch {
                        res.statusCode = 404;
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                        res.end('No validated local snapshot is available.');
                    }
                })();
            });
        },
    };
}

export default defineConfig(({ command, mode }) => {
    // Vite reserves `local` for .env postfix handling, so the private development mode is named
    // `local-private` and is only reachable through the `dev:local` script.
    const localMode = mode === 'local-private';

    return {
        plugins: [react(), localSnapshotPlugin(localMode)],
        server: {
            host: '127.0.0.1',
            strictPort: true,
            fs: {
                strict: true,
                deny: [
                    '**/.private/**',
                    '**/.private',
                    '**/.agents/**',
                    '**/scripts/**',
                    '**/.git/**',
                    '**/.env',
                    '**/.env.*',
                    '**/.sandbox-secrets/**',
                ],
            },
        },
        preview: {
            host: '127.0.0.1',
            strictPort: true,
        },
        build: {
            sourcemap: false,
        },
        test: {
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
            environment: 'node',
        },
        define: {
            __LOCAL_MODE__: JSON.stringify(localMode && command === 'serve'),
        },
    };
});
