import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { normalizeEmbeddingText, sha256, type EmbeddingCache } from './embeddings/core.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { apiKeyForProviderOrEnvFile, createEmbeddingProvider } from './embeddings/providers.ts';

const PROVIDER = 'siliconflow';
const MODEL = 'BAAI/bge-large-zh-v1.5';
const DIMENSIONS = 1024;
const SEEDS_PER_TAG = 8;
const BOUNDARY_CASES_PER_PAIR = 3;

type CandidateTag = {
    id: string;
    title: string;
    familyId: string;
    definition: string;
    includes: string[];
    excludes: string[];
    aliases: string[];
};

type Vocabulary = {
    schemaVersion: number;
    status: string;
    generatedAt: string;
    families: Array<{ id: string; title: string }>;
    tags: CandidateTag[];
    boundaries: Array<{ left: string; right: string; note: string }>;
};

type BookCandidate = { id: string; bookId: string };

function safeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
}

async function writeAtomic(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
}

function vectorNorm(values: number[]): number {
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) {
        throw new Error('candidate seed ranking encountered an invalid vector');
    }
    return norm;
}

function similarity(left: number[], leftNorm: number, right: number[], rightNorm: number): number {
    if (left.length !== right.length || left.length === 0) {
        throw new Error('candidate seed vectors have mismatched dimensions');
    }
    let dot = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return dot / (leftNorm * rightNorm);
}

function selectAcrossBooks<T extends BookCandidate>(ranked: T[], count: number): T[] {
    const books = new Set<string>();
    const selected: T[] = [];
    for (const candidate of ranked) {
        if (books.has(candidate.bookId)) {
            continue;
        }
        selected.push(candidate);
        books.add(candidate.bookId);
        if (selected.length === count) {
            break;
        }
    }
    return selected;
}

function validateVocabulary(value: unknown): Vocabulary {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('candidate vocabulary must be an object');
    }
    const vocabulary = value as Partial<Vocabulary>;
    if (
        vocabulary.schemaVersion !== 1 ||
        vocabulary.status !== 'draft' ||
        !Array.isArray(vocabulary.families) ||
        !Array.isArray(vocabulary.tags) ||
        vocabulary.tags.length < 30 ||
        vocabulary.tags.length > 60 ||
        !Array.isArray(vocabulary.boundaries)
    ) {
        throw new Error('candidate vocabulary has an invalid top-level shape');
    }
    const tagIds = new Set<string>();
    const titles = new Set<string>();
    for (const tag of vocabulary.tags) {
        if (
            typeof tag.id !== 'string' ||
            !/^ct-\d{3}$/u.test(tag.id) ||
            typeof tag.title !== 'string' ||
            [...tag.title].length < 2 ||
            [...tag.title].length > 4 ||
            typeof tag.familyId !== 'string' ||
            typeof tag.definition !== 'string' ||
            !Array.isArray(tag.includes) ||
            tag.includes.length === 0 ||
            !Array.isArray(tag.excludes) ||
            tag.excludes.length === 0 ||
            !Array.isArray(tag.aliases)
        ) {
            throw new Error(`candidate vocabulary contains an invalid tag ${tag.id ?? ''}`);
        }
        if (tagIds.has(tag.id) || titles.has(tag.title)) {
            throw new Error(`candidate vocabulary contains a duplicate tag ${tag.id}`);
        }
        tagIds.add(tag.id);
        titles.add(tag.title);
    }
    for (const boundary of vocabulary.boundaries) {
        if (!tagIds.has(boundary.left) || !tagIds.has(boundary.right) || boundary.left === boundary.right || boundary.note.trim().length === 0) {
            throw new Error('candidate vocabulary contains an invalid boundary');
        }
    }
    return vocabulary as Vocabulary;
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const vocabularyPath = resolve(tagsRoot, 'candidate-vocabulary.json');
    const vocabulary = validateVocabulary(JSON.parse(await readFile(vocabularyPath, 'utf8')) as unknown);
    const snapshotRaw = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshotRaw, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    const embeddingPaths = embeddingPrivatePaths();
    const highlightCachePath = resolve(embeddingPaths.cache, `${PROVIDER}--${safeName(MODEL)}--${String(DIMENSIONS)}.json`);
    const highlightCache = JSON.parse(await readFile(highlightCachePath, 'utf8')) as EmbeddingCache;
    if (highlightCache.model !== MODEL || highlightCache.dimensions !== DIMENSIONS || Object.keys(highlightCache.vectors).length < snapshot.highlights.length) {
        throw new Error('full default embedding cache is missing or incomplete');
    }

    const queryTexts = Object.fromEntries(
        vocabulary.tags.map((tag) => [
            tag.id,
            normalizeEmbeddingText(`${tag.title}。${tag.definition} 包括：${tag.includes.join('、')}。不包括：${tag.excludes.join('、')}。`),
        ]),
    );
    const vocabularyHash = sha256(JSON.stringify(queryTexts));
    const queryCachePath = resolve(tagsRoot, 'candidate-query-vectors.json');
    let queryCache: {
        schemaVersion: 1;
        generatedAt: string;
        provider: typeof PROVIDER;
        model: typeof MODEL;
        dimensions: typeof DIMENSIONS;
        vocabularyHash: string;
        requests: number;
        inputTokens: number | null;
        vectors: Record<string, number[]>;
    } = {
        schemaVersion: 1,
        generatedAt: new Date(0).toISOString(),
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        vocabularyHash,
        requests: 0,
        inputTokens: null,
        vectors: {},
    };
    if (existsSync(queryCachePath)) {
        const stored = JSON.parse(await readFile(queryCachePath, 'utf8')) as typeof queryCache;
        if (
            stored.schemaVersion === 1 &&
            stored.provider === PROVIDER &&
            stored.model === MODEL &&
            stored.dimensions === DIMENSIONS &&
            stored.vocabularyHash === vocabularyHash &&
            typeof stored.vectors === 'object' &&
            stored.vectors !== null
        ) {
            queryCache = stored;
        }
    }
    const pendingTags = vocabulary.tags.filter((tag) => queryCache.vectors[tag.id]?.length !== DIMENSIONS);
    if (pendingTags.length > 0) {
        const provider = createEmbeddingProvider(PROVIDER, { apiKey: await apiKeyForProviderOrEnvFile(PROVIDER), model: MODEL, dimensions: DIMENSIONS });
        const batchSize = Math.min(32, provider.batchLimit);
        for (let offset = 0; offset < pendingTags.length; offset += batchSize) {
            const batch = pendingTags.slice(offset, offset + batchSize);
            const result = await provider.embed(batch.map((tag) => queryTexts[tag.id] ?? ''));
            batch.forEach((tag, index) => {
                const vector = result.vectors[index];
                if (vector === undefined) {
                    throw new Error('provider returned an incomplete candidate query batch');
                }
                queryCache.vectors[tag.id] = vector;
            });
            queryCache.requests += 1;
            if (result.usage.inputTokens !== undefined) {
                queryCache.inputTokens = (queryCache.inputTokens ?? 0) + result.usage.inputTokens;
            }
            queryCache.generatedAt = new Date().toISOString();
            await writeAtomic(queryCachePath, `${JSON.stringify(queryCache, null, 2)}\n`);
        }
    }

    const highlights = [...snapshot.highlights].sort((left, right) => left.id.localeCompare(right.id));
    const highlightNorms = new Map(highlights.map((highlight) => [highlight.id, vectorNorm(highlightCache.vectors[highlight.id]?.values ?? [])]));
    const scores = new Map<string, Map<string, number>>();
    for (const tag of vocabulary.tags) {
        const queryVector = queryCache.vectors[tag.id];
        if (queryVector === undefined) {
            throw new Error(`candidate query vector is missing for ${tag.id}`);
        }
        const queryNorm = vectorNorm(queryVector);
        const tagScores = new Map<string, number>();
        for (const highlight of highlights) {
            const vector = highlightCache.vectors[highlight.id]?.values;
            const highlightNorm = highlightNorms.get(highlight.id);
            if (vector === undefined || highlightNorm === undefined) {
                throw new Error(`highlight vector is missing for ${highlight.id}`);
            }
            tagScores.set(highlight.id, similarity(queryVector, queryNorm, vector, highlightNorm));
        }
        scores.set(tag.id, tagScores);
    }

    const seeds = vocabulary.tags.map((tag) => {
        const tagScores = scores.get(tag.id);
        if (tagScores === undefined) {
            throw new Error(`candidate scores are missing for ${tag.id}`);
        }
        const ranked = highlights
            .map((highlight) => ({ id: highlight.id, bookId: highlight.bookId, similarity: tagScores.get(highlight.id) ?? -1 }))
            .sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id));
        return { tagId: tag.id, candidates: selectAcrossBooks(ranked, SEEDS_PER_TAG) };
    });
    const boundaryCases = vocabulary.boundaries.map((boundary) => {
        const leftScores = scores.get(boundary.left);
        const rightScores = scores.get(boundary.right);
        if (leftScores === undefined || rightScores === undefined) {
            throw new Error('candidate boundary scores are missing');
        }
        const ranked = highlights
            .map((highlight) => {
                const leftSimilarity = leftScores.get(highlight.id) ?? -1;
                const rightSimilarity = rightScores.get(highlight.id) ?? -1;
                return {
                    id: highlight.id,
                    bookId: highlight.bookId,
                    leftSimilarity,
                    rightSimilarity,
                    intersectionScore: Math.min(leftSimilarity, rightSimilarity) - Math.abs(leftSimilarity - rightSimilarity) * 0.5,
                };
            })
            .sort((left, right) => right.intersectionScore - left.intersectionScore || left.id.localeCompare(right.id));
        return { ...boundary, candidates: selectAcrossBooks(ranked, BOUNDARY_CASES_PER_PAIR) };
    });
    const generatedAt = new Date().toISOString();
    const outputPath = resolve(tagsRoot, 'candidate-seeds.json');
    await writeAtomic(
        outputPath,
        `${JSON.stringify(
            {
                schemaVersion: 1,
                generatedAt,
                provider: PROVIDER,
                model: MODEL,
                dimensions: DIMENSIONS,
                vocabularyHash,
                seedsPerTag: SEEDS_PER_TAG,
                boundaryCasesPerPair: BOUNDARY_CASES_PER_PAIR,
                seeds,
                boundaries: boundaryCases,
            },
            null,
            2,
        )}\n`,
    );

    const tagById = new Map(vocabulary.tags.map((tag) => [tag.id, tag]));
    const bookById = new Map(snapshot.books.map((book) => [book.id, book]));
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const lines: string[] = [
        '# V3 Batch 2 候选标签种子与边界',
        '',
        `- 生成时间：${generatedAt}`,
        `- 候选标签：${String(vocabulary.tags.length)}`,
        `- 每标签候选种子：${String(SEEDS_PER_TAG)} 条，按书去重`,
        `- 相邻边界：${String(vocabulary.boundaries.length)} 组，每组 ${String(BOUNDARY_CASES_PER_PAIR)} 条交界候选`,
        '',
        '> 这些是 embedding 辅助候选，不是正式 assignment。人工审核时可以接受、替换或删除。',
        '',
    ];
    for (const seed of seeds) {
        const tag = tagById.get(seed.tagId);
        if (tag === undefined) {
            throw new Error(`seed references unknown tag ${seed.tagId}`);
        }
        lines.push(
            `## ${tag.id} · ${tag.title}`,
            '',
            tag.definition,
            '',
            `- includes：${tag.includes.join('；')}`,
            `- excludes：${tag.excludes.join('；')}`,
            `- aliases：${tag.aliases.join('；')}`,
            '',
        );
        for (const candidate of seed.candidates.slice(0, 5)) {
            const highlight = highlightById.get(candidate.id);
            const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
            if (highlight === undefined || book === undefined) {
                throw new Error(`seed ${candidate.id} cannot be rendered`);
            }
            lines.push(`### ${candidate.id} · ${book.title} · ${candidate.similarity.toFixed(4)}`, '', highlight.text, '');
        }
    }
    lines.push('# 相邻标签边界', '');
    for (const boundary of boundaryCases) {
        const left = tagById.get(boundary.left);
        const right = tagById.get(boundary.right);
        if (left === undefined || right === undefined) {
            throw new Error('boundary references an unknown tag');
        }
        lines.push(`## ${left.title} ↔ ${right.title}`, '', boundary.note, '');
        for (const candidate of boundary.candidates.slice(0, 2)) {
            const highlight = highlightById.get(candidate.id);
            const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
            if (highlight === undefined || book === undefined) {
                throw new Error(`boundary candidate ${candidate.id} cannot be rendered`);
            }
            lines.push(
                `### ${candidate.id} · ${book.title} · ${candidate.leftSimilarity.toFixed(4)} / ${candidate.rightSimilarity.toFixed(4)}`,
                '',
                highlight.text,
                '',
            );
        }
    }
    const workbookPath = resolve(tagsRoot, 'candidate-review.md');
    await writeAtomic(workbookPath, `${lines.join('\n')}\n`);
    console.log(`candidate tags: ${String(vocabulary.tags.length)}`);
    console.log(`seed candidates: ${String(seeds.length * SEEDS_PER_TAG)}`);
    console.log(`boundary pairs: ${String(boundaryCases.length)}`);
    console.log(`private seed data: ${outputPath}`);
    console.log(`private review workbook: ${workbookPath}`);
}

await main();
