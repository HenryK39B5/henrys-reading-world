/**
 * Assemble the local-only development snapshot from the curation pool plus an editorial selection.
 *
 * Inputs (both private):
 *   - .private/curation/candidate-pool.json : real passages with stable candidate ids
 *   - .private/curation/selection.json      : hand-made selection (topics, flags, ordering)
 *
 * Outputs (private):
 *   - .private/local-snapshot.json            : what dev:local serves
 *   - .private/curation/selection-source-map.json : highlight id -> source ids, for traceability
 *
 * Book titles and authors always come from the real capture, never from typed-in values.
 *
 * Usage: npm run snapshot:local
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
    SNAPSHOT_SCHEMA_VERSION,
    UNKNOWN_AUTHOR_LABEL,
    type Book,
    type Highlight,
    type Snapshot,
    type Topic,
} from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';

type Candidate = {
    candidateId: string;
    planIndex: number;
    sourceBookId: string;
    sourceBookmarkId: string;
    title: string;
    author: string;
    text: string;
    year: number | null;
};

const ROOT = process.cwd();
const POOL_PATH = join(ROOT, '.private/curation/candidate-pool.json');
const PLAN_PATH = join(ROOT, '.private/curation/fetch-plan.json');
const SELECTION_PATH = join(ROOT, '.private/curation/selection.json');
const SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');
const MAP_PATH = join(ROOT, '.private/curation/selection-source-map.json');

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function requireString(value: unknown, where: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${where}: expected a non-empty string`);
    }
    return value;
}

function requireBoolean(value: unknown, where: string): boolean {
    if (typeof value !== 'boolean') {
        throw new Error(`${where}: expected a boolean`);
    }
    return value;
}

function requireScore(value: unknown, where: string): 1 | 2 | 3 | 4 | 5 {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error(`${where}: expected an integer from 1 to 5`);
    }
    return value as 1 | 2 | 3 | 4 | 5;
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

async function main(): Promise<void> {
    const pool = await readJson(POOL_PATH);
    if (!isRecord(pool)) {
        throw new Error('candidate pool must be an object');
    }
    const candidates = new Map<string, Candidate>();
    for (const entry of asRecordArray(pool['entries'], 'entries')) {
        const candidate: Candidate = {
            candidateId: requireString(entry['candidateId'], 'candidateId'),
            planIndex: Number(entry['planIndex']),
            sourceBookId: requireString(entry['sourceBookId'], 'sourceBookId'),
            sourceBookmarkId: String(entry['sourceBookmarkId'] ?? ''),
            title: String(entry['title'] ?? ''),
            author: String(entry['author'] ?? ''),
            text: requireString(entry['text'], 'text'),
            year: typeof entry['year'] === 'number' ? entry['year'] : null,
        };
        candidates.set(candidate.candidateId, candidate);
    }

    const plan = asRecordArray(await readJson(PLAN_PATH), 'plan');
    const planById = new Map<number, Record<string, unknown>>();
    for (const entry of plan) {
        planById.set(Number(entry['index']), entry);
    }

    const selection = await readJson(SELECTION_PATH);
    if (!isRecord(selection)) {
        throw new Error('selection must be an object');
    }

    const ownerRaw = selection['owner'];
    if (!isRecord(ownerRaw)) {
        throw new Error('selection.owner is required');
    }
    const ownerAbout = ownerRaw['about'] === undefined ? undefined : requireString(ownerRaw['about'], 'owner.about');
    const owner = {
        displayName: requireString(ownerRaw['displayName'], 'owner.displayName'),
        siteTitle: requireString(ownerRaw['siteTitle'], 'owner.siteTitle'),
        ...(ownerAbout === undefined ? {} : { about: ownerAbout }),
    };

    const topics: Topic[] = asRecordArray(selection['topics'], 'topics').map((entry, index) => {
        const description = entry['description'] === undefined ? undefined : requireString(entry['description'], `topics[${index}].description`);
        return {
            id: requireString(entry['id'], `topics[${index}].id`),
            title: requireString(entry['title'], `topics[${index}].title`),
            ...(description === undefined ? {} : { description }),
        };
    });
    const topicIds = new Set(topics.map((topic) => topic.id));

    const books: Book[] = [];
    const bookIdByPlanIndex = new Map<number, string>();
    for (const [index, entry] of asRecordArray(selection['books'], 'books').entries()) {
        const id = requireString(entry['id'], `books[${index}].id`);
        const planIndex = Number(entry['planIndex']);
        const planEntry = planById.get(planIndex);
        if (planEntry === undefined) {
            throw new Error(`books[${index}]: unknown planIndex ${String(planIndex)}`);
        }
        if (bookIdByPlanIndex.has(planIndex)) {
            throw new Error(`books[${index}]: planIndex ${String(planIndex)} is already mapped`);
        }
        bookIdByPlanIndex.set(planIndex, id);
        const title = requireString(planEntry['title'], `plan[${planIndex}].title`);
        const authorRaw = String(planEntry['author'] ?? '').trim();
        const description = entry['description'] === undefined ? undefined : requireString(entry['description'], `books[${index}].description`);
        books.push({
            id,
            title,
            author: authorRaw.length > 0 ? authorRaw : UNKNOWN_AUTHOR_LABEL,
            ...(description === undefined ? {} : { description }),
        });
    }

    const highlights: Highlight[] = [];
    const sourceMap: Record<string, unknown>[] = [];
    for (const [index, entry] of asRecordArray(selection['highlights'], 'highlights').entries()) {
        const candidateId = requireString(entry['candidateId'], `highlights[${index}].candidateId`);
        const candidate = candidates.get(candidateId);
        if (candidate === undefined) {
            throw new Error(`highlights[${index}]: unknown candidate ${candidateId}`);
        }
        const bookId = bookIdByPlanIndex.get(candidate.planIndex);
        if (bookId === undefined) {
            throw new Error(
                `highlights[${index}]: book for planIndex ${String(candidate.planIndex)} is not listed in selection.books`,
            );
        }
        const highlightTopicIds = asArray(entry['topicIds'] ?? [], `highlights[${index}].topicIds`).map((topicId, topicIndex) =>
            requireString(topicId, `highlights[${index}].topicIds[${topicIndex}]`),
        );
        for (const topicId of highlightTopicIds) {
            if (!topicIds.has(topicId)) {
                throw new Error(`highlights[${index}]: unknown topic ${topicId}`);
            }
        }
        const highlightId = `h-${String(index + 1).padStart(3, '0')}`;
        highlights.push({
            id: highlightId,
            bookId,
            text: candidate.text,
            ...(candidate.year === null ? {} : { year: candidate.year }),
            topicIds: highlightTopicIds,
            qualityScore: requireScore(entry['qualityScore'], `highlights[${index}].qualityScore`),
            standaloneReadable: requireBoolean(entry['standaloneReadable'], `highlights[${index}].standaloneReadable`),
            pinned: requireBoolean(entry['pinned'], `highlights[${index}].pinned`),
            openingCandidate: requireBoolean(entry['openingCandidate'], `highlights[${index}].openingCandidate`),
            surpriseCandidate: requireBoolean(entry['surpriseCandidate'], `highlights[${index}].surpriseCandidate`),
        });
        sourceMap.push({
            highlightId,
            candidateId,
            planIndex: candidate.planIndex,
            sourceBookId: candidate.sourceBookId,
            sourceBookmarkId: candidate.sourceBookmarkId,
            reviewNote: entry['reviewNote'] === undefined ? null : String(entry['reviewNote']),
        });
    }

    const snapshot: Snapshot = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'local-only',
        owner,
        books,
        topics,
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
        `local snapshot written: ${String(result.snapshot.highlights.length)} highlights, ${String(result.snapshot.books.length)} books, ${String(result.snapshot.topics.length)} topics`,
    );
    console.log(`coverage warnings: ${String(result.warnings.length)}`);
    for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
    }
    console.log('next: npm run dev:local');
}

await main();
