/**
 * Build per-book dossiers for theme-shelf classification (docs/11 §3).
 *
 * Each book gets its real title, author and up to 12 evenly spaced real passages. Sampling is
 * positional, not editorial: the goal is a representative slice of the book, never its best lines.
 *
 * The dossier exists so an Agent can assign a book-level shelf label without embeddings, without a
 * runtime model and without labelling 4,663 individual passages.
 *
 * Output: .private/curation/book-dossiers.json (private; contains real passages, never ships)
 * Usage:  npm run dossiers:v2
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const ID_MAP_PATH = join(ROOT, '.private/curation/id-map-v2.json');
const DOSSIER_PATH = join(ROOT, '.private/curation/book-dossiers.json');

const SAMPLES_PER_BOOK = 12;

type Candidate = {
    candidateId: string;
    planIndex: number;
    text: string;
    charCount: number;
    band: string;
    year: number | null;
};

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

function compareCandidateId(left: string, right: string): number {
    const leftMatch = /^c-(\d+)$/u.exec(left);
    const rightMatch = /^c-(\d+)$/u.exec(right);
    if (leftMatch !== null && rightMatch !== null) {
        const difference = Number(leftMatch[1]) - Number(rightMatch[1]);
        if (difference !== 0) {
            return difference;
        }
    }
    return left < right ? -1 : left > right ? 1 : 0;
}

/** Evenly spaced positions across the book, so short and long passages both show up. */
function samplePositions(total: number, wanted: number): number[] {    if (total <= wanted) {
        return Array.from({ length: total }, (_, index) => index);
    }
    const positions = new Set<number>();
    for (let index = 0; index < wanted; index += 1) {
        positions.add(Math.round((index * (total - 1)) / (wanted - 1)));
    }
    return [...positions].sort((left, right) => left - right);
}

async function main(): Promise<void> {
    const pool = await readJson(POOL_PATH, '先运行 npm run pool 生成候选池。');
    const plan = await readJson(PLAN_PATH, '先运行 ./scripts/weread-fetch-highlights.ps1 -BuildPlan 生成取数计划。');
    const idMap = await readJson(ID_MAP_PATH, '先运行 npm run idmap:v2 生成稳定 ID 映射。');
    if (!isRecord(pool) || !isRecord(idMap)) {
        throw new Error('输入文件结构不是对象');
    }

    const candidates: Candidate[] = asRecordArray(pool['entries'], 'pool.entries').map((entry) => ({
        candidateId: String(entry['candidateId'] ?? ''),
        planIndex: Number(entry['planIndex']),
        text: String(entry['text'] ?? ''),
        charCount: Number(entry['charCount'] ?? 0),
        band: String(entry['band'] ?? ''),
        year: typeof entry['year'] === 'number' ? entry['year'] : null,
    }));
    for (const [index, candidate] of candidates.entries()) {
        if (candidate.candidateId.length === 0 || !Number.isInteger(candidate.planIndex) || candidate.text.length === 0) {
            throw new Error(`pool.entries[${index}] 结构不完整`);
        }
    }

    const idByCandidateId = new Map<string, string>();
    for (const entry of asRecordArray(idMap['highlights'], 'idMap.highlights')) {
        idByCandidateId.set(String(entry['candidateId'] ?? ''), String(entry['id'] ?? ''));
    }

    const byPlanIndex = new Map<number, Candidate[]>();
    for (const candidate of candidates) {
        const list = byPlanIndex.get(candidate.planIndex);
        if (list === undefined) {
            byPlanIndex.set(candidate.planIndex, [candidate]);
        } else {
            list.push(candidate);
        }
    }

    const books = asRecordArray(plan, 'plan');
    const dossiers: Record<string, unknown>[] = [];
    let sampleTotal = 0;
    let coverlessBooks = 0;

    for (const entry of books) {
        const planIndex = Number(entry['index']);
        const list = (byPlanIndex.get(planIndex) ?? []).slice().sort((left, right) => compareCandidateId(left.candidateId, right.candidateId));
        const bands = { short: 0, medium: 0, long: 0 };
        for (const candidate of list) {
            if (candidate.band === 'short' || candidate.band === 'medium' || candidate.band === 'long') {
                bands[candidate.band] += 1;
            }
        }
        const years = [...new Set(list.map((candidate) => candidate.year).filter((year): year is number => year !== null))].sort(
            (left, right) => left - right,
        );
        if (list.length === 0) {
            coverlessBooks += 1;
        }

        const samples = samplePositions(list.length, SAMPLES_PER_BOOK).map((position) => {
            const candidate = list[position];
            if (candidate === undefined) {
                throw new Error(`planIndex ${String(planIndex)} 采样越界`);
            }
            return {
                highlightId: idByCandidateId.get(candidate.candidateId) ?? null,
                charCount: candidate.charCount,
                band: candidate.band,
                text: candidate.text,
            };
        });
        sampleTotal += samples.length;

        dossiers.push({
            planIndex,
            title: String(entry['title'] ?? ''),
            author: String(entry['author'] ?? ''),
            candidateCount: list.length,
            bands,
            years,
            samples,
        });
    }

    const output = {
        generatedAt: new Date().toISOString(),
        samplesPerBook: SAMPLES_PER_BOOK,
        note: '样本按位置等距抽取，用于归纳书籍书架标签；不是被评为最好的句子。',
        books: dossiers,
    };

    await writeFile(DOSSIER_PATH, JSON.stringify(output, null, 2), 'utf8');

    const withSamples = dossiers.filter((dossier) => (dossier['samples'] as unknown[]).length > 0).length;
    console.log(`dossiers written: ${String(dossiers.length)} books, ${String(sampleTotal)} sample passages`);
    console.log(`books with samples: ${String(withSamples)}; books without candidates: ${String(coverlessBooks)}`);
    if (coverlessBooks > 0) {
        console.log('note: books without candidates keep their real title and get no theme shelf claim.');
    }
    console.log('next: review book-dossiers.json and write .private/curation/book-themes.json');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
