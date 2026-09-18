import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../src/domain/types.ts';
import {
    EMBEDDING_EVALUATION_SCHEMA_VERSION,
    type CachedEmbedding,
    type EvaluationCorpus,
    type EvaluationLabels,
} from '../scripts/embeddings/core.ts';
import {
    evaluateEmbeddings,
    labelHighlightIds,
    parseEvaluationLabels,
    selectEvaluationCorpus,
} from '../scripts/embeddings/evaluation.ts';

const SNAPSHOT_PATH = '.private/local-snapshot.json';
const hasSnapshot = existsSync(SNAPSHOT_PATH);

describe('embedding evaluation corpus', () => {
    it.skipIf(!hasSnapshot)('selects 300 real passages across every book and length band', () => {
        const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
        const required = ['h-008', 'h-4458'];
        const corpus = selectEvaluationCorpus(snapshot, 300, required);

        expect(corpus).toHaveLength(300);
        expect(new Set(corpus.map((entry) => entry.id)).size).toBe(300);
        expect(new Set(corpus.map((entry) => entry.bookId)).size).toBe(snapshot.books.length);
        expect(new Set(corpus.map((entry) => entry.lengthBand))).toEqual(new Set(['short', 'medium', 'long']));
        expect(corpus.map((entry) => entry.id)).toEqual([...corpus.map((entry) => entry.id)].sort());
        expect(corpus.some((entry) => entry.id === 'h-008')).toBe(true);
        expect(corpus.some((entry) => entry.id === 'h-4458')).toBe(true);
        expect(Math.max(...snapshot.books.map((book) => corpus.filter((entry) => entry.bookId === book.id).length))).toBeLessThanOrEqual(4);
    });

    it('strictly parses labels and exposes every required highlight id', () => {
        const labels = parseEvaluationLabels({
            schemaVersion: 1,
            cases: [
                {
                    id: 'case-1',
                    kind: 'keyword-false-friend',
                    queryId: 'h-001',
                    positiveIds: ['h-002'],
                    negativeIds: ['h-003'],
                },
            ],
        });

        expect(labelHighlightIds(labels)).toEqual(['h-001', 'h-002', 'h-003']);
        expect(() =>
            parseEvaluationLabels({
                schemaVersion: 1,
                cases: [{ id: 'x', kind: 'other', queryId: 'h-001', positiveIds: ['h-002'], negativeIds: [] }],
            }),
        ).toThrow(/invalid kind/u);
        expect(() => parseEvaluationLabels({ schemaVersion: 1, cases: [], extra: true })).toThrow(/unsupported field/u);
    });
});

describe('embedding metrics', () => {
    it('measures retrieval rank, hard-negative accuracy and cross-book diversity', () => {
        const corpus: EvaluationCorpus = {
            schemaVersion: EMBEDDING_EVALUATION_SCHEMA_VERSION,
            selectionVersion: 'all-books-theme-length-v1',
            generatedAt: '2026-09-18T00:00:00.000Z',
            snapshotHash: 'hash',
            targetCount: 4,
            entries: [
                { id: 'h-001', bookId: 'b-001', themeIds: ['t-001'], lengthBand: 'short' },
                { id: 'h-002', bookId: 'b-002', themeIds: ['t-001'], lengthBand: 'short' },
                { id: 'h-003', bookId: 'b-003', themeIds: ['t-002'], lengthBand: 'short' },
                { id: 'h-004', bookId: 'b-004', themeIds: ['t-002'], lengthBand: 'short' },
            ],
        };
        const labels: EvaluationLabels = {
            schemaVersion: EMBEDDING_EVALUATION_SCHEMA_VERSION,
            cases: [
                {
                    id: 'case-1',
                    kind: 'keyword-false-friend',
                    queryId: 'h-001',
                    positiveIds: ['h-002'],
                    negativeIds: ['h-003'],
                },
            ],
        };
        const values: Record<string, CachedEmbedding> = {
            'h-001': { textHash: '1', values: [1, 0] },
            'h-002': { textHash: '2', values: [0.9, 0.1] },
            'h-003': { textHash: '3', values: [0, 1] },
            'h-004': { textHash: '4', values: [0.5, 0.5] },
        };

        const metrics = evaluateEmbeddings(corpus, labels, values);

        expect(metrics.meanReciprocalRank).toBe(1);
        expect(metrics.recallAt5).toBe(1);
        expect(metrics.recallAt10).toBe(1);
        expect(metrics.pairAccuracy).toBe(1);
        expect(metrics.meanMargin).toBeGreaterThan(0);
        expect(metrics.neighborhoodBookDiversityAt10).toBe(1);
    });
});
