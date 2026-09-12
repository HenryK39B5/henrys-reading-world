/**
 * Fetch real cover images for the books in the capture plan.
 *
 * Covers are remote CDN URLs in the API response, so they are downloaded once into
 * .private/covers/ and served by the local development endpoint. Nothing is hot-linked, and the
 * public build ships no cover until the release decision is made (PUB-06).
 *
 * Usage: npm run covers:fetch [-- --limit 5]   (omit --limit for all books in the plan)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const RAW_DIR = join(ROOT, '.private/weread');
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const COVERS_DIR = join(ROOT, '.private/covers');
const INDEX_PATH = join(ROOT, '.private/curation/covers.json');

type CoverIndexEntry = { planIndex: number; bookId: string; fileName: string; source: 'notebook' };

function readArg(name: string, fallback: number): number {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`--${name} expects a positive number`);
    }
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

/** Collect the cover URL the notebook response already carries for each book. */
async function coverUrlsByBookId(): Promise<Map<string, string>> {
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(RAW_DIR)).filter((name) => name.startsWith('notebooks-page-') && name.endsWith('.json'));
    const urls = new Map<string, string>();
    for (const file of files) {
        const parsed = await readJson(join(RAW_DIR, file));
        if (!isRecord(parsed) || !Array.isArray(parsed['books'])) {
            continue;
        }
        for (const entry of parsed['books']) {
            if (!isRecord(entry)) {
                continue;
            }
            const bookId = typeof entry['bookId'] === 'string' ? entry['bookId'] : '';
            const book = entry['book'];
            const cover = isRecord(book) && typeof book['cover'] === 'string' ? book['cover'] : '';
            if (bookId !== '' && cover !== '' && !urls.has(bookId)) {
                urls.set(bookId, cover);
            }
        }
    }
    return urls;
}

function extensionFor(url: string): string {
    const match = /\.(jpe?g|png|webp)(?:\?|$)/iu.exec(url);
    return match?.[1] === undefined ? 'jpg' : match[1].toLowerCase();
}

async function main(): Promise<void> {
    const limit = readArg('limit', Number.MAX_SAFE_INTEGER);
    let plan: unknown;
    try {
        plan = await readJson(PLAN_PATH);
    } catch {
        throw new Error('缺少 .private/curation/fetch-plan.json。先运行 ./scripts/weread-fetch-highlights.ps1 -BuildPlan。');
    }
    if (!Array.isArray(plan)) {
        throw new Error('取数计划格式不正确。');
    }

    const urls = await coverUrlsByBookId();
    await mkdir(COVERS_DIR, { recursive: true });

    const index: CoverIndexEntry[] = [];
    let downloaded = 0;
    let reused = 0;
    let missing = 0;

    for (const raw of plan.slice(0, limit)) {
        if (!isRecord(raw)) {
            continue;
        }
        const planIndex = Number(raw['index']);
        const bookId = String(raw['bookId']);
        const url = urls.get(bookId);
        if (url === undefined) {
            missing += 1;
            continue;
        }
        const fileName = `p${String(planIndex).padStart(3, '0')}.${extensionFor(url)}`;
        const target = join(COVERS_DIR, fileName);
        index.push({ planIndex, bookId, fileName, source: 'notebook' });

        try {
            await readFile(target);
            reused += 1;
            continue;
        } catch {
            // Not downloaded yet.
        }

        const response = await fetch(url);
        if (!response.ok) {
            missing += 1;
            continue;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > 400_000) {
            missing += 1;
            continue;
        }
        await writeFile(target, bytes);
        downloaded += 1;
    }

    await writeFile(INDEX_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), entries: index }, null, 2), 'utf8');
    console.log(`covers downloaded: ${String(downloaded)}, already present: ${String(reused)}, no cover in source: ${String(missing)}`);
    console.log(`index written: .private/curation/covers.json (${String(index.length)} books)`);
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
