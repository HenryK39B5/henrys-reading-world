import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
    LOCAL_COVER_PREFIX,
    LOCAL_SNAPSHOT_ROUTE,
    POLICY_BODY_LIMIT,
    PUBLICATION_POLICY_ROUTE,
    TAG_ASSIGNMENTS_BODY_LIMIT,
    TAG_ASSIGNMENTS_ROUTE,
    TAG_VOCABULARY_ROUTE,
    publicationPaths,
} from './src/app/privatePaths.ts';
import { tagPaths } from './src/app/privateTagPaths.ts';
import { validatePublicationPolicy } from './src/domain/publication.ts';
import { validateTopicTagAssignments, validateTopicTagVocabulary } from './src/domain/topicTags.ts';
import type { Snapshot } from './src/domain/types.ts';
import { validateSnapshot } from './src/domain/validate.ts';
import { publicRoomPaths } from './scripts/public-route-entries.ts';
import { matchesMapTerrain } from './scripts/embeddings/mapTerrainArtifact.ts';

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
 * Serves the private publication policy, and accepts a new one under strict conditions.
 *
 * The write side only exists in `publication:review`. It refuses a request that is not a same-origin
 * request from this loopback port, refuses a body that is not `application/json`, caps the body size,
 * validates the whole policy against the real snapshot *before* touching the disk, and replaces the file
 * with a rename so a crash mid-write cannot leave a half-written decision behind.
 */
async function handlePolicyRequest(req: IncomingMessage, res: ServerResponse, port: number): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');

    if (req.method !== 'GET' && req.method !== 'PUT') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, PUT');
        res.end('Method Not Allowed');
        return;
    }

    const file = resolve(process.cwd(), publicationPaths().policy);
    if (req.method === 'GET') {
        try {
            const raw = await readFile(file, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ policy: JSON.parse(raw) as unknown }));
        } catch {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ policy: null, note: 'No policy yet. Run npm run publication:init.' }));
        }
        return;
    }

    if (!isAllowedReviewOrigin(req.headers.origin, port)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
        res.statusCode = 415;
        res.end('Unsupported Media Type');
        return;
    }

    let body: string;
    try {
        body = await readLimitedBody(req, POLICY_BODY_LIMIT);
    } catch {
        res.statusCode = 413;
        res.end('Payload Too Large');
        return;
    }

    let candidate: unknown;
    try {
        candidate = JSON.parse(body);
    } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
    }

    try {
        const snapshotRaw = await readFile(resolve(process.cwd(), LOCAL_SNAPSHOT_FILE), 'utf8');
        const snapshot = JSON.parse(snapshotRaw) as Snapshot;
        const validated = validatePublicationPolicy(candidate, snapshot);
        if (!validated.ok) {
            // Errors name ids and fields only; the policy never carries passage text.
            res.statusCode = 422;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, errors: validated.errors }));
            return;
        }
        const temporary = `${file}.tmp`;
        await mkdir(dirname(file), { recursive: true });
        await writeFile(temporary, `${JSON.stringify(validated.policy, null, 2)}\n`, 'utf8');
        await rename(temporary, file);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true }));
    } catch {
        res.statusCode = 500;
        res.end('Could not save the policy');
    }
}

async function handleTagStudioRequest(req: IncomingMessage, res: ServerResponse, port: number, path: string): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    const vocabularyFile = resolve(process.cwd(), tagPaths().vocabulary);
    const assignmentsFile = resolve(process.cwd(), tagPaths().assignments);
    if (path === TAG_VOCABULARY_ROUTE) {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
        try {
            const vocabulary = validateTopicTagVocabulary(JSON.parse(await readFile(vocabularyFile, 'utf8')) as unknown);
            if (!vocabulary.ok) { res.statusCode = 500; res.end('Invalid vocabulary'); return; }
            res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(vocabulary.value));
        } catch { res.statusCode = 404; res.end('Vocabulary not found'); }
        return;
    }
    if (path !== TAG_ASSIGNMENTS_ROUTE || (req.method !== 'GET' && req.method !== 'PUT')) { res.statusCode = 405; res.end('Method Not Allowed'); return; }
    if (req.method === 'GET') {
        try { res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(await readFile(assignmentsFile, 'utf8')); }
        catch { res.statusCode = 404; res.end('Assignments not found'); }
        return;
    }
    if (!isAllowedReviewOrigin(req.headers.origin, port)) { res.statusCode = 403; res.end('Forbidden'); return; }
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { res.statusCode = 415; res.end('Unsupported Media Type'); return; }
    try {
        const candidate = JSON.parse(await readLimitedBody(req, TAG_ASSIGNMENTS_BODY_LIMIT)) as unknown;
        const snapshot = JSON.parse(await readFile(resolve(process.cwd(), LOCAL_SNAPSHOT_FILE), 'utf8')) as Snapshot;
        const vocabularyResult = validateTopicTagVocabulary(JSON.parse(await readFile(vocabularyFile, 'utf8')) as unknown);
        if (!vocabularyResult.ok) throw new Error('invalid vocabulary');
        const required = new Set((candidate as { assignments?: Array<{ highlightId?: string }> }).assignments?.map((entry) => String(entry.highlightId)) ?? []);
        const checked = validateTopicTagAssignments(candidate, snapshot, vocabularyResult.value, required);
        if (!checked.ok) { res.statusCode = 422; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ ok: false, errors: checked.errors })); return; }
        const temporary = `${assignmentsFile}.tmp`; await writeFile(temporary, `${JSON.stringify(checked.value, null, 2)}\n`, 'utf8'); await rename(temporary, assignmentsFile);
        res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ ok: true }));
    } catch { res.statusCode = 500; res.end('Could not save assignments'); }
}

/** Only this machine, only over http, only this port: a page anywhere else may not rewrite the policy. */
function isAllowedReviewOrigin(origin: string | undefined, port: number): boolean {
    if (typeof origin !== 'string') {
        return false;
    }
    try {
        const url = new URL(origin);
        return (
            url.protocol === 'http:' &&
            (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
            url.port === String(port)
        );
    } catch {
        return false;
    }
}

function readLimitedBody(req: IncomingMessage, limit: number): Promise<string> {
    return new Promise((resolvePromise, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
                reject(new Error('too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            resolvePromise(Buffer.concat(chunks).toString('utf8'));
        });
        req.on('error', reject);
    });
}

/**
 * Local-only development endpoints.
 *
 * `snapshot` serves the private development snapshot and its covers; `publication` additionally serves the
 * private publication policy and accepts a new one. Both are reachable exclusively from a named local mode,
 * bind to loopback, use one fixed route each and are refused during a production build.
 */
function localSnapshotPlugin(flags: { snapshot: boolean; publication: boolean; tags: boolean }): Plugin {
    return {
        name: 'reading-world-local-snapshot',
        config(_config, env) {
            if ((flags.snapshot || flags.publication || flags.tags) && env.command === 'build') {
                throw new Error(
                    'Local mode cannot be used for a production build. Public builds read src/data/public-snapshot.json only.',
                );
            }
        },
        configureServer(server) {
            if (!flags.snapshot && !flags.publication && !flags.tags) {
                return;
            }
            const port = server.config.server.port ?? 5173;
            if (flags.publication) {
                // The review screen is a separate document, so the terminal says where to find it.
                console.log(
                    `\n  publication review: http://127.0.0.1:${String(port)}/publication-review.html\n  policy file: ${publicationPaths().policy}\n  (write access to it is only open in this mode)\n`,
                );
            }
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? '').split('?')[0] ?? '';
                if (flags.publication && path === PUBLICATION_POLICY_ROUTE) {
                    void handlePolicyRequest(req, res, port);
                    return;
                }
                if (flags.tags && (path === TAG_VOCABULARY_ROUTE || path === TAG_ASSIGNMENTS_ROUTE)) {
                    void handleTagStudioRequest(req, res, port, path);
                    return;
                }
                if (!flags.snapshot) {
                    next();
                    return;
                }
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

function localMapTerrainPlugin(enabled: boolean): Plugin {
    return {
        name: 'reading-world-local-map-terrain',
        configureServer(server) {
            if (!enabled) return;
            server.middlewares.use((req, res, next) => {
                if ((req.url ?? '').split('?')[0] !== '/__local_map_terrain') { next(); return; }
                if (req.method !== 'GET') { sendText(res, 405, 'Method Not Allowed'); return; }
                void (async () => {
                    try {
                        const snapshot = JSON.parse(await readFile(resolve(LOCAL_SNAPSHOT_FILE), 'utf8')) as Snapshot;
                        const artifact = JSON.parse(await readFile(resolve('.private/local-map-terrain.json'), 'utf8')) as unknown;
                        if (snapshot.visibility !== 'local-only' || !matchesMapTerrain(artifact, snapshot)) throw new Error('stale terrain');
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-store');
                        res.setHeader('X-Robots-Tag', 'noindex');
                        res.end(JSON.stringify(artifact));
                    } catch { sendText(res, 404, 'Local terrain unavailable; run npm run map:terrain:local.'); }
                })();
            });
        },
    };
}

function mapStudyPlugin(): Plugin {
    return {
        name: 'reading-world-map-study',
        config(_config, env) {
            if (env.command === 'build') throw new Error('The map study is only available on a loopback development server.');
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if ((req.url ?? '').split('?')[0] !== '/__map_study') { next(); return; }
                if (req.method !== 'GET') { sendText(res, 405, 'Method Not Allowed'); return; }
                void (async () => {
                    try {
                        const snapshot = JSON.parse(await readFile(resolve('src/data/public-snapshot.json'), 'utf8')) as Snapshot;
                        const study = JSON.parse(await readFile(resolve('.private/review/maintenance/m04/resolution/field-comparison.json'), 'utf8')) as {
                            sourceVersion: string;
                            pointsHash: string;
                            fields: Array<{ density: { columns: number; rows: number; values: number[] }; contours: unknown[] }>;
                            midBands: unknown[];
                        };
                        const map = snapshot.map;
                        const pointsHash = createHash('sha256').update(JSON.stringify(map?.points)).digest('hex');
                        const candidate = study.fields[1];
                        if (snapshot.visibility !== 'public' || map === undefined || study.sourceVersion !== map.version ||
                            study.pointsHash !== pointsHash || candidate?.density.columns !== 128 || candidate.density.rows !== 80 ||
                            !Array.isArray(study.midBands)) throw new Error('map study is stale');
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-store');
                        res.setHeader('X-Robots-Tag', 'noindex');
                        res.end(JSON.stringify({ density: candidate.density, contours: candidate.contours, bands: study.midBands }));
                    } catch {
                        sendText(res, 404, 'Run npm run map:terrain:study before opening the map study.');
                    }
                })();
            });
        },
    };
}

export default defineConfig(({ command, mode }) => {
    // Vite reserves `local` for .env postfix handling, so the private development mode is named
    // `local-private` and is only reachable through the `dev:local` script. The publication reviewer is a
    // third mode: it reads the same private snapshot and adds the policy endpoints and the review screen.
    const localMode = mode === 'local-private';
    const reviewMode = mode === 'review-private';
    const tagStudioMode = mode === 'tag-studio-private';
    const mapStudyMode = mode === 'map-study';
    const anyLocalMode = localMode || reviewMode || tagStudioMode;

    return {
        base: command === 'build' ? '/henrys-reading-world/' : '/',
        plugins: [
            react(),
            localSnapshotPlugin({ snapshot: anyLocalMode, publication: reviewMode, tags: tagStudioMode }),
            localMapTerrainPlugin(anyLocalMode),
            ...(mapStudyMode ? [mapStudyPlugin()] : []),
            {
                name: 'pages-room-entries',
                apply: 'build',
                async closeBundle() {
                    const root = resolve('dist');
                    const entry = resolve(root, 'index.html');
                    const result = validateSnapshot(JSON.parse(await readFile(resolve('src/data/public-snapshot.json'), 'utf8')) as unknown,
                        { expectedVisibility: 'public' });
                    if (!result.ok) throw new Error(`public route entries require a valid public snapshot: ${result.errors.join('; ')}`);
                    for (const path of publicRoomPaths(result.snapshot)) {
                        const target = resolve(root, `.${path}/index.html`);
                        await mkdir(dirname(target), { recursive: true });
                        await copyFile(entry, target);
                    }
                    // Unknown routes still receive an honest 404 page with an in-app way home.
                    await copyFile(entry, resolve(root, '404.html'));
                },
            },
        ],
        server: {
            host: '127.0.0.1',
            strictPort: true,
            // Its own port, so the reviewer and the reading preview can be open side by side.
            port: reviewMode ? 5174 : tagStudioMode ? 5175 : mapStudyMode ? 5176 : 5173,
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
            __LOCAL_MODE__: JSON.stringify(anyLocalMode && command === 'serve'),
            // Historical feature flag: the accepted study visuals now run in public and local map modes.
            __MAP_STUDY__: JSON.stringify(mapStudyMode || localMode || (!anyLocalMode && command === 'serve') || command === 'build'),
            __MAP_STUDY_ENDPOINT__: JSON.stringify(mapStudyMode && command === 'serve'),
        },
    };
});
