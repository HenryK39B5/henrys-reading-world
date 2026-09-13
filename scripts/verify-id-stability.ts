/**
 * Guard: the ids v1 already published must keep pointing at the same real material forever.
 *
 * A shared link or a private review note refers to `h-…` / `b-…`. Regenerating the snapshot must
 * therefore never re-bind those ids to different books or passages (docs/11 §2).
 *
 * The check is deliberately independent of the current snapshot builder: it reads the frozen v1
 * source map plus the raw candidate pool, so it also catches a builder that silently re-orders.
 *
 * Usage: npm run verify:ids   (private inputs required; exits 1 on any mismatch)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SEED_MAP_PATH = join(ROOT, '.private/curation/selection-source-map.json');
const SELECTION_PATH = join(ROOT, '.private/curation/selection.json');
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch {
        throw new Error(`缺少或无法解析 ${path.slice(ROOT.length + 1)}；先完成 V2-A 数据准备。`);
    }
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

async function main(): Promise<void> {
    const seedMap = await readJson(SEED_MAP_PATH);
    const selection = await readJson(SELECTION_PATH);
    const pool = await readJson(POOL_PATH);
    const plan = await readJson(PLAN_PATH);
    const snapshot = await readJson(SNAPSHOT_PATH);
    if (!isRecord(seedMap) || !isRecord(selection) || !isRecord(pool) || !isRecord(snapshot)) {
        throw new Error('输入文件结构不是对象');
    }

    const textByCandidateId = new Map<string, string>();
    for (const entry of asRecordArray(pool['entries'], 'pool.entries')) {
        textByCandidateId.set(String(entry['candidateId'] ?? ''), String(entry['text'] ?? ''));
    }
    const titleByPlanIndex = new Map<number, { title: string; author: string }>();
    for (const entry of asRecordArray(plan, 'plan')) {
        titleByPlanIndex.set(Number(entry['index']), {
            title: String(entry['title'] ?? ''),
            author: String(entry['author'] ?? '').trim(),
        });
    }

    const highlightById = new Map<string, Record<string, unknown>>();
    for (const entry of asRecordArray(snapshot['highlights'], 'snapshot.highlights')) {
        highlightById.set(String(entry['id'] ?? ''), entry);
    }
    const bookById = new Map<string, Record<string, unknown>>();
    for (const entry of asRecordArray(snapshot['books'], 'snapshot.books')) {
        bookById.set(String(entry['id'] ?? ''), entry);
    }

    const problems: string[] = [];

    // 1. Seeded book ids must still name the same real book.
    const seededBooks = asRecordArray(selection['books'], 'selection.books');
    for (const entry of seededBooks) {
        const id = String(entry['id'] ?? '');
        const planIndex = Number(entry['planIndex']);
        const expected = titleByPlanIndex.get(planIndex);
        const actual = bookById.get(id);
        if (expected === undefined) {
            problems.push(`${id}: planIndex ${String(planIndex)} 不在取数计划中`);
            continue;
        }
        if (actual === undefined) {
            problems.push(`${id}: 快照里已不存在`);
            continue;
        }
        if (actual['title'] !== expected.title) {
            problems.push(`${id}: 书名从 ${expected.title} 变成了 ${String(actual['title'])}`);
        }
    }

    // 2. Seeded highlight ids must still carry the same real passage text.
    const entries = asRecordArray(seedMap['entries'], 'sourceMap.entries');
    for (const entry of entries) {
        const id = String(entry['highlightId'] ?? '');
        const candidateId = String(entry['candidateId'] ?? '');
        const expectedText = textByCandidateId.get(candidateId);
        const actual = highlightById.get(id);
        if (expectedText === undefined) {
            problems.push(`${id}: 种子候选 ${candidateId} 不在候选池中`);
            continue;
        }
        if (actual === undefined) {
            problems.push(`${id}: 快照里已不存在`);
            continue;
        }
        if (actual['text'] !== expectedText) {
            problems.push(`${id}: 原文与种子候选 ${candidateId} 不再一致`);
        }
    }

    // 3. Ids must be unique, and no id may be reused for a different passage.
    const ids = [...highlightById.keys()];
    if (new Set(ids).size !== ids.length) {
        problems.push('快照里出现重复的划线 ID');
    }

    if (problems.length > 0) {
        console.error('id stability check failed:');
        for (const problem of problems) {
            console.error(`  - ${problem}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log(
        `id stability OK: ${String(seededBooks.length)} seeded books and ${String(entries.length)} seeded highlights still point at the same real material`,
    );
    console.log(`snapshot total: ${String(ids.length)} highlights, ${String(bookById.size)} books`);
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
