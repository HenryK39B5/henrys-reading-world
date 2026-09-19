import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../src/domain/types.ts';
import type { CachedEmbedding } from '../scripts/embeddings/core.ts';
import { selectTagDiscoverySample } from '../scripts/embeddings/tagDiscovery.ts';

const snapshot: Snapshot = {
    schemaVersion: 3,
    visibility: 'local-only',
    owner: { displayName: 'Henry', siteTitle: "Henry's Reading World" },
    themes: [
        { id: 't-001', title: '一' },
        { id: 't-002', title: '二' },
        { id: 't-003', title: '三' },
    ],
    tags: [],
    books: [
        { id: 'b-001', title: '甲', author: '甲', themeIds: ['t-001'] },
        { id: 'b-002', title: '乙', author: '乙', themeIds: ['t-002'] },
        { id: 'b-003', title: '丙', author: '丙', themeIds: ['t-003'] },
    ],
    highlights: [
        { id: 'h-001', bookId: 'b-001', text: '短句甲', tagIds: [] },
        { id: 'h-002', bookId: 'b-001', text: '一段长度明显不同的中等文本，用来验证书内语义边缘选择。', tagIds: [] },
        { id: 'h-003', bookId: 'b-001', text: '第三个方向', tagIds: [] },
        { id: 'h-004', bookId: 'b-002', text: '短句乙', tagIds: [] },
        { id: 'h-005', bookId: 'b-002', text: '另一个方向', tagIds: [] },
        { id: 'h-006', bookId: 'b-002', text: '第三方向乙', tagIds: [] },
        { id: 'h-007', bookId: 'b-003', text: '短句丙', tagIds: [] },
        { id: 'h-008', bookId: 'b-003', text: '另一个方向丙', tagIds: [] },
        { id: 'h-009', bookId: 'b-003', text: '第三方向丙', tagIds: [] },
    ],
};

const rawVectors: Record<string, number[]> = {
    'h-001': [1, 0, 0],
    'h-002': [0.8, 0.2, 0],
    'h-003': [0, 1, 0],
    'h-004': [0, 1, 0],
    'h-005': [0, 0.8, 0.2],
    'h-006': [0, 0, 1],
    'h-007': [0.7, 0.7, 0],
    'h-008': [0.1, 0.7, 0.7],
    'h-009': [0.7, 0, 0.7],
};

const vectors: Record<string, CachedEmbedding> = Object.fromEntries(
    Object.entries(rawVectors).map(([id, values]) => [id, { textHash: `hash-${id}`, values }]),
);

describe('tag discovery diversity sample', () => {
    it('is deterministic, covers every book twice, and fills extras by theme', () => {
        const first = selectTagDiscoverySample(snapshot, vectors, 7);
        const second = selectTagDiscoverySample(snapshot, vectors, 7);

        expect(second).toEqual(first);
        expect(new Set(first.map((entry) => entry.id))).toHaveLength(7);
        expect(new Set(first.map((entry) => entry.bookId))).toEqual(new Set(['b-001', 'b-002', 'b-003']));
        const counts = first.reduce<Record<string, number>>((result, entry) => {
            result[entry.bookId] = (result[entry.bookId] ?? 0) + 1;
            return result;
        }, {});
        expect(Object.values(counts).sort()).toEqual([2, 2, 3]);
        expect(first.filter((entry) => entry.reason === 'book-centroid')).toHaveLength(3);
        expect(first.filter((entry) => entry.reason === 'book-semantic-edge')).toHaveLength(3);
        expect(first.filter((entry) => entry.reason === 'theme-diversity-third')).toHaveLength(1);
    });

    it('fails closed when any source vector is missing', () => {
        const incomplete = { ...vectors };
        delete incomplete['h-009'];
        expect(() => selectTagDiscoverySample(snapshot, incomplete, 7)).toThrow('missing vector h-009');
    });
});
