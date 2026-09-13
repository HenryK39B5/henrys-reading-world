/**
 * Build the permanent project-local ID map for schema v2 (docs/11 §2).
 *
 * The 46 highlights and 20 books that v1 already published keep their existing ids. Everything else
 * is appended in a stable order: books by planIndex, highlights by (planIndex, candidateId).
 *
 * Re-running is idempotent: an existing map is loaded first and only extended, never reassigned, so
 * a shared link or a private source-map reference can never silently point at different material.
 *
 * Output: .private/curation/id-map-v2.json  (private; never ships)
 * Usage:  npm run idmap:v2
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const SELECTION_PATH = join(ROOT, '.private/curation/selection.json');
const SOURCE_MAP_PATH = join(ROOT, '.private/curation/selection-source-map.json');
const ID_MAP_PATH = join(ROOT, '.private/curation/id-map-v2.json');

type PoolEntry = { candidateId: string; planIndex: number };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string, hint: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch {
        throw new Error(`缺少或无法解析 ${path.slice(ROOT.length + 1)}。${hint}`);
    }
}

async function tryReadJson(path: string): Promise<unknown | null> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch {
        return null;
    }
}

function requireString(value: unknown, where: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${where}: expected a non-empty string`);
    }
    return value;
}

function requireInteger(value: unknown, where: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${where}: expected a positive integer`);
    }
    return parsed;
}

function asRecordArray(value: unknown, where: string): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
        throw new Error(`${where}: expected an array`);
    }
    return value.map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`${where}[${index}]: expected an object`);
        }
        return entry;
    });
}

/** Candidate ids are zero-padded, but compare numerically when the shape allows it. */
function compareCandidateId(left: string, right: string): number {
    const leftMatch = /^c-(\d+)$/u.exec(left);
    const rightMatch = /^c-(\d+)$/u.exec(right);
    if (leftMatch !== null && rightMatch !== null) {
        const leftNumber = Number(leftMatch[1]);
        const rightNumber = Number(rightMatch[1]);
        if (leftNumber !== rightNumber) {
            return leftNumber - rightNumber;
        }
    }
    return left < right ? -1 : left > right ? 1 : 0;
}

function nextId(prefix: string, used: string[]): string {
    let highest = 0;
    const width = 3;
    for (const id of used) {
        const match = new RegExp(`^${prefix}-(\\d+)$`, 'u').exec(id);
        if (match !== null) {
            highest = Math.max(highest, Number(match[1]));
        }
    }
    const next = String(highest + 1).padStart(width, '0');
    return `${prefix}-${next}`;
}

async function main(): Promise<void> {
    const pool = await readJson(POOL_PATH, '先运行 npm run pool 生成候选池。');
    const selection = await readJson(SELECTION_PATH, '人工挑选文件缺失。');
    const sourceMap = await readJson(SOURCE_MAP_PATH, '先运行 npm run snapshot:local 生成 source map。');
    if (!isRecord(pool) || !isRecord(selection) || !isRecord(sourceMap)) {
        throw new Error('输入文件结构不是对象');
    }

    const entries: PoolEntry[] = asRecordArray(pool['entries'], 'pool.entries').map((entry, index) => ({
        candidateId: requireString(entry['candidateId'], `pool.entries[${index}].candidateId`),
        planIndex: requireInteger(entry['planIndex'], `pool.entries[${index}].planIndex`),
    }));
    if (new Set(entries.map((entry) => entry.candidateId)).size !== entries.length) {
        throw new Error('候选池里出现了重复 candidateId');
    }

    // Existing map (if any) is the authority for everything it already covers.
    const existing = await tryReadJson(ID_MAP_PATH);
    const bookIdsByPlanIndex = new Map<number, string>();
    const highlightIdsByCandidateId = new Map<string, string>();

    if (isRecord(existing)) {
        for (const entry of asRecordArray(existing['books'] ?? [], 'idMap.books')) {
            bookIdsByPlanIndex.set(requireInteger(entry['planIndex'], 'idMap.books[].planIndex'), requireString(entry['id'], 'idMap.books[].id'));
        }
        for (const entry of asRecordArray(existing['highlights'] ?? [], 'idMap.highlights')) {
            highlightIdsByCandidateId.set(
                requireString(entry['candidateId'], 'idMap.highlights[].candidateId'),
                requireString(entry['id'], 'idMap.highlights[].id'),
            );
        }
    }

    const seededBooks = bookIdsByPlanIndex.size;
    const seededHighlights = highlightIdsByCandidateId.size;

    // v1 seeds: the books and highlights that are already on the page keep exactly their ids.
    for (const entry of asRecordArray(selection['books'] ?? [], 'selection.books')) {
        const planIndex = requireInteger(entry['planIndex'], 'selection.books[].planIndex');
        const id = requireString(entry['id'], 'selection.books[].id');
        const current = bookIdsByPlanIndex.get(planIndex);
        if (current !== undefined && current !== id) {
            throw new Error(`planIndex ${String(planIndex)} 已被映射为 ${current}，不能再改成 ${id}`);
        }
        bookIdsByPlanIndex.set(planIndex, id);
    }
    for (const entry of asRecordArray(sourceMap['entries'] ?? [], 'sourceMap.entries')) {
        const candidateId = requireString(entry['candidateId'], 'sourceMap.entries[].candidateId');
        const id = requireString(entry['highlightId'], 'sourceMap.entries[].highlightId');
        const current = highlightIdsByCandidateId.get(candidateId);
        if (current !== undefined && current !== id) {
            throw new Error(`${candidateId} 已被映射为 ${current}，不能再改成 ${id}`);
        }
        highlightIdsByCandidateId.set(candidateId, id);
    }

    // Append the rest, deterministically.
    const planIndexes = [...new Set(entries.map((entry) => entry.planIndex))].sort((left, right) => left - right);
    for (const planIndex of planIndexes) {
        if (bookIdsByPlanIndex.has(planIndex)) {
            continue;
        }
        const id = nextId('b', [...bookIdsByPlanIndex.values()]);
        bookIdsByPlanIndex.set(planIndex, id);
    }

    const unmapped = entries
        .filter((entry) => !highlightIdsByCandidateId.has(entry.candidateId))
        .sort((left, right) => left.planIndex - right.planIndex || compareCandidateId(left.candidateId, right.candidateId));
    const usedHighlightIds = [...highlightIdsByCandidateId.values()];
    for (const entry of unmapped) {
        const id = nextId('h', usedHighlightIds);
        usedHighlightIds.push(id);
        highlightIdsByCandidateId.set(entry.candidateId, id);
    }

    const unknownPlanIndex = planIndexes.filter((planIndex) => !bookIdsByPlanIndex.has(planIndex));
    if (unknownPlanIndex.length > 0) {
        throw new Error(`有书籍没有分配到 ID：${unknownPlanIndex.join(', ')}`);
    }

    const output = {
        generatedAt: new Date().toISOString(),
        source: 'candidate-pool.json + selection.json + selection-source-map.json',
        books: [...bookIdsByPlanIndex.entries()]
            .sort((left, right) => left[0] - right[0])
            .map(([planIndex, id]) => ({ planIndex, id })),
        highlights: entries
            .slice()
            .sort((left, right) => left.planIndex - right.planIndex || compareCandidateId(left.candidateId, right.candidateId))
            .map((entry) => ({
                candidateId: entry.candidateId,
                id: highlightIdsByCandidateId.get(entry.candidateId) ?? '',
            })),
    };

    for (const entry of output.highlights) {
        if (entry.id.length === 0) {
            throw new Error(`${entry.candidateId} 没有分配到 ID`);
        }
    }

    await writeFile(ID_MAP_PATH, JSON.stringify(output, null, 2), 'utf8');

    console.log(`id map written: ${String(output.books.length)} books, ${String(output.highlights.length)} highlights`);
    console.log(`seeded from existing map: ${String(seededBooks)} books, ${String(seededHighlights)} highlights`);
    console.log(`preserved v1 ids: books b-001…b-${String(seededBooks).padStart(3, '0')}, highlights h-001…h-${String(seededHighlights).padStart(3, '0')}`);
    console.log('next: npm run dossiers:v2');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
