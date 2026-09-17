/**
 * Assemble the local-only development snapshot (schema v2) from the authorized real captures.
 *
 * v1 built a hand-picked 46-passage sample. v2 puts the whole real library on the page: every
 * structurally valid, de-duplicated candidate passage, with theme shelves owned by books.
 *
 * Inputs (private):
 *   .private/curation/candidate-pool.json - every usable real passage with a stable candidate id
 *   .private/curation/fetch-plan.json     - the real book list; titles and authors come from here
 *   .private/curation/id-map-v2.json      - permanent project-local ids for books and passages
 *   .private/curation/book-themes.json    - broad theme shelves, assigned per book (docs/11 §3)
 *   .private/curation/book-metadata-overrides.json - optional, user-approved title/author corrections
 *   .private/curation/covers.json         - index of locally downloaded cover art
 *
 * Outputs (private):
 *   .private/local-snapshot.json                  - what dev:local serves
 *   .private/curation/snapshot-source-map.json    - highlight id -> source ids, for traceability
 *
 * Book titles and authors come from the real capture unless a private, user-approved override corrects
 * imported-file debris or bad metadata. The capture remains untouched and every override is keyed by a
 * stable project ID. Passage text is never printed. Original book/bookmark ids stay in the private source map.
 *
 * Usage: npm run snapshot:local
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
    SNAPSHOT_SCHEMA_VERSION,
    UNKNOWN_AUTHOR_LABEL,
    type Book,
    type Highlight,
    type Snapshot,
    type Theme,
} from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { parseBookMetadataOverrides, type BookMetadataOverrides } from './bookMetadataOverrides.ts';

type Candidate = {
    candidateId: string;
    planIndex: number;
    sourceBookId: string;
    sourceBookmarkId: string;
    text: string;
    year: number | null;
};

const ROOT = process.cwd();
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const ID_MAP_PATH = join(ROOT, '.private/curation/id-map-v2.json');
const THEMES_PATH = join(ROOT, '.private/curation/book-themes.json');
const METADATA_OVERRIDES_PATH = join(ROOT, '.private/curation/book-metadata-overrides.json');
const COVERS_PATH = join(ROOT, '.private/curation/covers.json');
const COVERS_DIR = join(ROOT, '.private/covers');
const SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');
const MAP_PATH = join(ROOT, '.private/curation/snapshot-source-map.json');

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

/** Missing private inputs are the most likely first-run failure, so say what to run next. */
async function requireJson(path: string, hint: string): Promise<unknown> {
    try {
        return await readJson(path);
    } catch {
        throw new Error(`缺少 ${path.slice(ROOT.length + 1)}。${hint}`);
    }
}

function requireString(value: unknown, where: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${where}: expected a non-empty string`);
    }
    return value;
}

function asArray(value: unknown, where: string): unknown[] {
    if (!Array.isArray(value)) {
        throw new Error(`${where}: expected an array`);
    }
    return value;
}

function asRecordArray(value: unknown, where: string): Record<string, unknown>[] {
    return asArray(value, where).map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`${where}[${index}]: expected an object`);
        }
        return entry;
    });
}

/** Highest id first, so the numbering never collides with an existing assignment. */
function highlightNumber(id: string): number {
    const match = /^h-(\d+)$/u.exec(id);
    return match === null ? Number.MAX_SAFE_INTEGER : Number(match[1]);
}

async function main(): Promise<void> {
    const pool = await requireJson(
        POOL_PATH,
        '先运行 npm run pool（未抓过原始数据时，先执行 ./scripts/weread-fetch-highlights.ps1 -BuildPlan 再抓取，需要 WEREAD_API_KEY）。详见 docs/09-WEREAD-DATA-WORKFLOW.md。',
    );
    if (!isRecord(pool)) {
        throw new Error('candidate pool must be an object');
    }
    const candidates: Candidate[] = asRecordArray(pool['entries'], 'entries').map((entry, index) => ({
        candidateId: requireString(entry['candidateId'], `entries[${index}].candidateId`),
        planIndex: Number(entry['planIndex']),
        sourceBookId: String(entry['sourceBookId'] ?? ''),
        sourceBookmarkId: String(entry['sourceBookmarkId'] ?? ''),
        text: requireString(entry['text'], `entries[${index}].text`),
        year: typeof entry['year'] === 'number' ? entry['year'] : null,
    }));

    const plan = asRecordArray(
        await requireJson(PLAN_PATH, '先运行 scripts/weread-fetch-highlights.ps1 -BuildPlan 生成取数计划。'),
        'plan',
    );
    const planById = new Map<number, Record<string, unknown>>();
    for (const entry of plan) {
        planById.set(Number(entry['index']), entry);
    }

    const idMap = await requireJson(ID_MAP_PATH, '先运行 npm run idmap:v2 生成稳定 ID 映射（docs/11 §2）。');
    if (!isRecord(idMap)) {
        throw new Error('id map must be an object');
    }
    const bookIdByPlanIndex = new Map<number, string>();
    for (const entry of asRecordArray(idMap['books'], 'idMap.books')) {
        bookIdByPlanIndex.set(Number(entry['planIndex']), requireString(entry['id'], 'idMap.books[].id'));
    }
    const highlightIdByCandidateId = new Map<string, string>();
    for (const entry of asRecordArray(idMap['highlights'], 'idMap.highlights')) {
        highlightIdByCandidateId.set(requireString(entry['candidateId'], 'idMap.highlights[].candidateId'), requireString(entry['id'], 'idMap.highlights[].id'));
    }

    const themeSource = await requireJson(
        THEMES_PATH,
        '缺少书籍主题分配。先运行 npm run dossiers:v2 生成 book-dossiers.json，再据此写 book-themes.json（docs/11 §3）。',
    );
    if (!isRecord(themeSource)) {
        throw new Error('book-themes must be an object');
    }
    const themes: Theme[] = asRecordArray(themeSource['themes'], 'themes').map((entry, index) => {
        const description = entry['description'] === undefined ? undefined : requireString(entry['description'], `themes[${index}].description`);
        return {
            id: requireString(entry['id'], `themes[${index}].id`),
            title: requireString(entry['title'], `themes[${index}].title`),
            ...(description === undefined ? {} : { description }),
        };
    });
    let metadataOverrides: BookMetadataOverrides = new Map();
    try {
        metadataOverrides = parseBookMetadataOverrides(await readJson(METADATA_OVERRIDES_PATH));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    const themeIds = new Set(themes.map((theme) => theme.id));
    const themeIdsByPlanIndex = new Map<number, string[]>();
    for (const entry of asRecordArray(themeSource['books'], 'book themes')) {
        const planIndex = Number(entry['planIndex']);
        const ids = asArray(entry['themeIds'] ?? [], `book themes planIndex ${String(planIndex)}`).map((themeId, index) =>
            requireString(themeId, `book themes planIndex ${String(planIndex)}[${index}]`),
        );
        for (const themeId of ids) {
            if (!themeIds.has(themeId)) {
                throw new Error(`planIndex ${String(planIndex)} 引用了未知主题 ${themeId}`);
            }
        }
        themeIdsByPlanIndex.set(planIndex, ids);
    }

    // Covers are optional: when present they are served by the local development endpoint, so a
    // public build still ships no cover art until the release decision is made.
    const coverByPlanIndex = new Map<number, string>();
    try {
        const coverIndex = await readJson(COVERS_PATH);
        if (isRecord(coverIndex)) {
            for (const entry of asRecordArray(coverIndex['entries'], 'cover entries')) {
                const fileName = String(entry['fileName'] ?? '');
                if (!/^[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u.test(fileName)) {
                    continue;
                }
                try {
                    await access(join(COVERS_DIR, fileName));
                    coverByPlanIndex.set(Number(entry['planIndex']), fileName);
                } catch {
                    // Indexed but not on disk: fall back to the typeset title instead of a broken image.
                }
            }
        }
    } catch {
        console.log('note: no cover index found; run npm run covers:fetch to add real cover art');
    }

    const candidatesByPlanIndex = new Map<number, Candidate[]>();
    for (const candidate of candidates) {
        const list = candidatesByPlanIndex.get(candidate.planIndex);
        if (list === undefined) {
            candidatesByPlanIndex.set(candidate.planIndex, [candidate]);
        } else {
            list.push(candidate);
        }
    }

    const books: Book[] = [];
    const highlights: Highlight[] = [];
    const sourceMap: Record<string, unknown>[] = [];
    const warnings: string[] = [];
    const bookIds = new Set<string>();
    const appliedMetadataOverrideIds = new Set<string>();

    const planIndexes = [...candidatesByPlanIndex.keys()].sort((left, right) => left - right);
    for (const planIndex of planIndexes) {
        const planEntry = planById.get(planIndex);
        if (planEntry === undefined) {
            throw new Error(`planIndex ${String(planIndex)} 不在取数计划中`);
        }
        const bookId = bookIdByPlanIndex.get(planIndex);
        if (bookId === undefined) {
            throw new Error(`planIndex ${String(planIndex)} 没有分配到书籍 ID，先运行 npm run idmap:v2`);
        }
        if (bookIds.has(bookId)) {
            throw new Error(`书籍 ID ${bookId} 被多个 planIndex 使用`);
        }
        bookIds.add(bookId);

        const capturedTitle = requireString(planEntry['title'], `plan[${String(planIndex)}].title`);
        const capturedAuthor = String(planEntry['author'] ?? '').trim();
        const metadataOverride = metadataOverrides.get(bookId);
        if (metadataOverride !== undefined) {
            appliedMetadataOverrideIds.add(bookId);
        }
        const title = metadataOverride?.title ?? capturedTitle;
        const author = metadataOverride?.author ?? (capturedAuthor.length > 0 ? capturedAuthor : UNKNOWN_AUTHOR_LABEL);
        const assignedThemes = themeIdsByPlanIndex.get(planIndex) ?? [];
        if (assignedThemes.length === 0) {
            warnings.push(`book planIndex ${String(planIndex)} has no theme shelf assigned`);
        }
        const coverFileName = coverByPlanIndex.get(planIndex);

        books.push({
            id: bookId,
            title,
            author,
            themeIds: assignedThemes,
            ...(coverFileName === undefined ? {} : { coverPath: `local-covers/${coverFileName}` }),
        });

        for (const candidate of candidatesByPlanIndex.get(planIndex) ?? []) {
            const highlightId = highlightIdByCandidateId.get(candidate.candidateId);
            if (highlightId === undefined) {
                throw new Error(`${candidate.candidateId} 没有分配到划线 ID，先运行 npm run idmap:v2`);
            }
            highlights.push({
                id: highlightId,
                bookId,
                text: candidate.text,
                ...(candidate.year === null ? {} : { year: candidate.year }),
            });
            sourceMap.push({
                highlightId,
                candidateId: candidate.candidateId,
                planIndex,
                sourceBookId: candidate.sourceBookId,
                sourceBookmarkId: candidate.sourceBookmarkId,
            });
        }
    }

    const staleMetadataOverrideIds = [...metadataOverrides.keys()].filter((id) => !appliedMetadataOverrideIds.has(id));
    if (staleMetadataOverrideIds.length > 0) {
        throw new Error(`book metadata overrides reference unknown or empty books: ${staleMetadataOverrideIds.join(', ')}`);
    }

    highlights.sort((left, right) => highlightNumber(left.id) - highlightNumber(right.id));

    const ownerAbout = '一个可以随便抽一句、按主题书架或按书闲逛的个人阅读空间。';
    const snapshot: Snapshot = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'local-only',
        owner: { displayName: 'Henry', siteTitle: "Henry's Reading World", about: ownerAbout },
        themes,
        books,
        highlights,
    };

    const result = validateSnapshot(snapshot);
    if (!result.ok) {
        console.error('snapshot validation failed:');
        for (const error of result.errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
        return;
    }

    await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, JSON.stringify(result.snapshot, null, 2), 'utf8');
    await writeFile(MAP_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), entries: sourceMap }, null, 2), 'utf8');

    console.log(
        `local snapshot written: ${String(result.snapshot.highlights.length)} highlights, ${String(result.snapshot.books.length)} books, ${String(result.snapshot.themes.length)} theme shelves`,
    );
    const withCovers = result.snapshot.books.filter((book) => book.coverPath !== undefined).length;
    console.log(`books with a local cover: ${String(withCovers)}; without: ${String(result.snapshot.books.length - withCovers)}`);
    console.log(`source map entries: ${String(sourceMap.length)}`);
    console.log(`metadata overrides applied: ${String(appliedMetadataOverrideIds.size)}`);
    console.log(`coverage warnings: ${String(result.warnings.length + warnings.length)}`);
    for (const warning of [...warnings, ...result.warnings]) {
        console.log(`  - ${warning}`);
    }
    console.log('next: npm run dev:local');
}

try {
    await main();
} catch (error) {
    // Keep first-run failures readable: one line, no stack, no private data.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
