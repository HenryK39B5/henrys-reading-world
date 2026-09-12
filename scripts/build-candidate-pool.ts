/**
 * Build the private curation pool from authorized real captures.
 *
 * Reads .private/weread/highlights/*.json (raw WeRead bookmark lists, highlights only) and
 * writes two private files:
 *   - .private/curation/candidate-pool.json  : every usable passage with a stable candidate id
 *   - .private/curation/candidate-shortlist.md : a readable, sampled subset for editorial review
 *
 * No passage text is printed to stdout. Output stays under .private/.
 *
 * Usage:
 *   npm run pool -- --books 30 --per-book 12
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { countNonWhitespace, hasOriginalLineBreak, lengthBand, normalizeForKey } from '../src/domain/length.ts';

type FetchPlanEntry = {
    index: number;
    bookId: string;
    noteCount: number;
    bookFile: string;
    title: string;
    author: string;
};

export type Candidate = {
    candidateId: string;
    planIndex: number;
    sourceBookId: string;
    sourceBookmarkId: string;
    title: string;
    author: string;
    text: string;
    year: number | null;
    charCount: number;
    band: 'short' | 'medium' | 'long';
    hasLineBreak: boolean;
};

const ROOT = process.cwd();
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const RAW_DIR = join(ROOT, '.private/weread/highlights');
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const SHORTLIST_PATH = join(ROOT, '.private/curation/candidate-shortlist.md');

const YEAR_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric' });

function readArg(name: string, fallback: number): number {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) {
        return fallback;
    }
    const raw = process.argv[index + 1];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`--${name} expects a positive number`);
    }
    return value;
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toYear(createTime: unknown): number | null {
    if (typeof createTime !== 'number' || !Number.isFinite(createTime) || createTime <= 0) {
        return null;
    }
    const millis = createTime * 1000;
    const year = Number(YEAR_FORMAT.format(new Date(millis)));
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        return null;
    }
    return year;
}

function readPlan(value: unknown): FetchPlanEntry[] {
    if (!Array.isArray(value)) {
        throw new Error('fetch plan must be an array');
    }
    return value.map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`fetch plan entry ${index} is not an object`);
        }
        return {
            index: Number(entry['index']),
            bookId: String(entry['bookId']),
            noteCount: Number(entry['noteCount']),
            bookFile: String(entry['bookFile']),
            title: String(entry['title'] ?? ''),
            author: String(entry['author'] ?? ''),
        };
    });
}

/** Evenly spaced pick so a book contributes from across its whole reading span. */
function spread<T>(items: T[], limit: number): T[] {
    if (items.length <= limit) {
        return items;
    }
    const picked: T[] = [];
    const step = items.length / limit;
    for (let i = 0; i < limit; i += 1) {
        const item = items[Math.floor(i * step)];
        if (item !== undefined) {
            picked.push(item);
        }
    }
    return picked;
}

async function main(): Promise<void> {
    const booksToReview = readArg('books', Number.MAX_SAFE_INTEGER);
    const perBook = readArg('per-book', 10);
    const minChars = readArg('min-chars', 8);
    const maxChars = readArg('max-chars', 400);

    const plan = readPlan(
        await (async () => {
            try {
                return await readJson(PLAN_PATH);
            } catch {
                throw new Error(
                    '缺少 .private/curation/fetch-plan.json。先运行 ./scripts/weread-fetch-highlights.ps1 -BuildPlan（需要当前进程设置 WEREAD_API_KEY）。',
                );
            }
        })(),
    );
    const byPlanIndex = new Map<number, Candidate[]>();
    const seen = new Set<string>();
    let skippedTooShort = 0;
    let skippedTooLong = 0;
    let skippedDuplicate = 0;
    let skippedMalformed = 0;

    for (const entry of plan) {
        let captured: unknown;
        try {
            captured = await readJson(join(RAW_DIR, entry.bookFile));
        } catch {
            continue;
        }
        if (!isRecord(captured)) {
            continue;
        }
        const updated = captured['updated'];
        if (!Array.isArray(updated)) {
            continue;
        }
        const bookCandidates: Candidate[] = [];
        for (const raw of updated) {
            if (!isRecord(raw)) {
                skippedMalformed += 1;
                continue;
            }
            const text = typeof raw['markText'] === 'string' ? raw['markText'] : '';
            if (text.trim().length === 0) {
                skippedMalformed += 1;
                continue;
            }
            const charCount = countNonWhitespace(text);
            if (charCount < minChars) {
                skippedTooShort += 1;
                continue;
            }
            if (charCount > maxChars) {
                skippedTooLong += 1;
                continue;
            }
            const key = normalizeForKey(text);
            if (seen.has(key)) {
                skippedDuplicate += 1;
                continue;
            }
            seen.add(key);
            bookCandidates.push({
                candidateId: '',
                planIndex: entry.index,
                sourceBookId: entry.bookId,
                sourceBookmarkId: String(raw['bookmarkId'] ?? ''),
                title: entry.title,
                author: entry.author,
                text,
                year: toYear(raw['createTime']),
                charCount,
                band: lengthBand(text),
                hasLineBreak: hasOriginalLineBreak(text),
            });
        }
        if (bookCandidates.length > 0) {
            byPlanIndex.set(entry.index, bookCandidates);
        }
    }

    const all: Candidate[] = [];
    for (const entry of plan) {
        for (const candidate of byPlanIndex.get(entry.index) ?? []) {
            candidate.candidateId = `c-${String(all.length + 1).padStart(4, '0')}`;
            all.push(candidate);
        }
    }

    await mkdir(dirname(POOL_PATH), { recursive: true });
    await writeFile(POOL_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), entries: all }, null, 2), 'utf8');

    const reviewed = [...byPlanIndex.keys()].slice(0, booksToReview);
    const lines: string[] = [
        '# 候选划线短名单（私有，勿公开）',
        '',
        `来源：.private/weread/highlights（授权真实划线）。共 ${all.length} 条可用候选，覆盖 ${byPlanIndex.size} 本书。`,
        '本文件用于人工挑选，正文属于私密材料，只允许留在 .private/。',
        '',
    ];
    let shown = 0;
    for (const planIndex of reviewed) {
        const candidates = byPlanIndex.get(planIndex) ?? [];
        const entry = plan.find((item) => item.index === planIndex);
        if (entry === undefined) {
            continue;
        }
        const sample = spread(candidates, perBook);
        shown += sample.length;
        lines.push(`## planIndex ${planIndex} · ${entry.title || '（书名缺失）'} — ${entry.author || '作者信息暂缺'}`);
        lines.push(`划线 ${entry.noteCount} 条 · 候选 ${candidates.length} 条 · 本次呈现 ${sample.length} 条`);
        lines.push('');
        for (const candidate of sample) {
            const flags = [candidate.year === null ? '年份缺失' : String(candidate.year), `${candidate.charCount}字`, candidate.band];
            if (candidate.hasLineBreak) {
                flags.push('原始换行');
            }
            lines.push(`- ${candidate.candidateId} · ${flags.join(' · ')}`);
            for (const textLine of candidate.text.split('\n')) {
                lines.push(`  > ${textLine}`);
            }
            lines.push('');
        }
    }
    await writeFile(SHORTLIST_PATH, lines.join('\n'), 'utf8');

    console.log(`pool candidates: ${all.length} across ${byPlanIndex.size} books`);
    console.log(
        `skipped -> too short: ${skippedTooShort}, too long: ${skippedTooLong}, duplicate: ${skippedDuplicate}, malformed: ${skippedMalformed}`,
    );
    console.log(`shortlist entries for review: ${shown} (books reviewed: ${reviewed.length}, per book: ${perBook})`);
    console.log('written: .private/curation/candidate-pool.json, .private/curation/candidate-shortlist.md');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
