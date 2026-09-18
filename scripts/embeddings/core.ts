import { createHash } from 'node:crypto';
import type { Highlight, Snapshot } from '../../src/domain/types.ts';

export const EMBEDDING_INPUT_VERSION = 'highlight-text-nfc-lf-v1';
export const EMBEDDING_CACHE_SCHEMA_VERSION = 1;
export const EMBEDDING_EVALUATION_SCHEMA_VERSION = 1;

export type EmbeddingProviderName = 'voyage' | 'cohere' | 'openai';

export type EmbeddingUsage = {
    inputTokens?: number;
};

export type EmbeddingBatch = {
    vectors: number[][];
    usage: EmbeddingUsage;
};

export type EmbeddingProvider = {
    name: EmbeddingProviderName;
    model: string;
    dimensions: number;
    batchLimit: number;
    embed(texts: string[]): Promise<EmbeddingBatch>;
};

export type CachedEmbedding = {
    textHash: string;
    values: number[];
};

export type EmbeddingCache = {
    schemaVersion: typeof EMBEDDING_CACHE_SCHEMA_VERSION;
    provider: EmbeddingProviderName | 'baseline';
    model: string;
    dimensions: number;
    inputVersion: typeof EMBEDDING_INPUT_VERSION;
    snapshotHash: string;
    generatedAt: string;
    requests: number;
    inputTokens?: number;
    vectors: Record<string, CachedEmbedding>;
};

export type EvaluationCorpusEntry = {
    id: string;
    bookId: string;
    themeIds: string[];
    lengthBand: 'short' | 'medium' | 'long';
};

export type EvaluationCorpus = {
    schemaVersion: typeof EMBEDDING_EVALUATION_SCHEMA_VERSION;
    selectionVersion: 'all-books-theme-length-v1';
    generatedAt: string;
    snapshotHash: string;
    targetCount: number;
    entries: EvaluationCorpusEntry[];
};

export type EvaluationCaseKind = 'cross-book-related' | 'near-boundary' | 'keyword-false-friend';

export type EvaluationCase = {
    id: string;
    kind: EvaluationCaseKind;
    queryId: string;
    positiveIds: string[];
    negativeIds: string[];
    note?: string;
};

export type EvaluationLabels = {
    schemaVersion: typeof EMBEDDING_EVALUATION_SCHEMA_VERSION;
    cases: EvaluationCase[];
};

export function normalizeEmbeddingText(text: string): string {
    return text.normalize('NFC').replace(/\r\n?/gu, '\n');
}

export function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function highlightTextHash(highlight: Pick<Highlight, 'text'>): string {
    return sha256(`${EMBEDDING_INPUT_VERSION}\0${normalizeEmbeddingText(highlight.text)}`);
}

export function snapshotEmbeddingHash(snapshot: Pick<Snapshot, 'highlights'>): string {
    const lines = [...snapshot.highlights]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((highlight) => `${highlight.id}\0${highlight.bookId}\0${highlightTextHash(highlight)}`);
    return sha256(lines.join('\n'));
}

export function cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || left.length !== right.length) {
        throw new Error('cosine similarity requires non-empty vectors with equal dimensions');
    }
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index];
        const rightValue = right[index];
        if (leftValue === undefined || rightValue === undefined) {
            throw new Error('cosine similarity encountered a missing vector value');
        }
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm === 0 || rightNorm === 0) {
        throw new Error('cosine similarity requires non-zero vectors');
    }
    return dot / Math.sqrt(leftNorm * rightNorm);
}

export function validateVectors(vectors: number[][], expectedCount: number, dimensions: number): void {
    if (vectors.length !== expectedCount) {
        throw new Error(`embedding response count mismatch: expected ${String(expectedCount)}, received ${String(vectors.length)}`);
    }
    for (const vector of vectors) {
        if (vector.length !== dimensions) {
            throw new Error(`embedding dimension mismatch: expected ${String(dimensions)}, received ${String(vector.length)}`);
        }
        if (vector.some((value) => !Number.isFinite(value))) {
            throw new Error('embedding response contains a non-finite value');
        }
    }
}

export function lengthBand(text: string): EvaluationCorpusEntry['lengthBand'] {
    const length = [...text.replace(/\s/gu, '')].length;
    if (length <= 40) {
        return 'short';
    }
    if (length <= 120) {
        return 'medium';
    }
    return 'long';
}

function fnv1a(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * A deterministic character n-gram floor for the private evaluation harness.
 * It is not a semantic-model candidate and must never be presented as the selected embedding provider.
 */
export function lexicalHashEmbedding(text: string, dimensions = 512): number[] {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
        throw new Error('lexical hash dimensions must be a positive integer');
    }
    const characters = [...normalizeEmbeddingText(text)].filter((character) => /[\p{L}\p{N}]/u.test(character));
    const vector = Array.from<number>({ length: dimensions }).fill(0);
    const addFeature = (feature: string, weight: number): void => {
        const hash = fnv1a(feature);
        const index = hash % dimensions;
        const sign = (hash & 0x80000000) === 0 ? 1 : -1;
        const current = vector[index] ?? 0;
        vector[index] = current + sign * weight;
    };
    for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index];
        if (character === undefined) {
            continue;
        }
        addFeature(`u:${character}`, 1);
        const next = characters[index + 1];
        if (next !== undefined) {
            addFeature(`b:${character}${next}`, 2);
        }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
        vector[0] = 1;
        return vector;
    }
    return vector.map((value) => value / norm);
}
