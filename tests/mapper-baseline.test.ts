import { describe, expect, it } from 'vitest';
import { buildMapper } from '../scripts/research/mapperBaseline.ts';

const points = [
    { id: 'a', values: [1, 0], bookId: 'b1', tagIds: ['t1'] },
    { id: 'b', values: [0.99, 0.01], bookId: 'b1', tagIds: ['t1'] },
    { id: 'c', values: [-1, 0], bookId: 'b2', tagIds: ['t2'] },
    { id: 'd', values: [-0.99, -0.01], bookId: 'b2', tagIds: ['t2'] },
] as const;

describe('mapper baseline', () => {
    it('creates deterministic overlapping cover nodes and shared-member edges', () => {
        const graph = buildMapper(points, [0, 0.4, 0.6, 1], { coverCount: 2, overlap: 0.5, cosineDistanceThreshold: 0.03, minSharedMembers: 1 });
        expect(graph.nodes.map((node) => node.id)).toEqual(['n-1-1', 'n-1-2', 'n-2-1', 'n-2-2']);
        expect(graph.edges.some((edge) => edge.sharedMemberIds.length > 0)).toBe(true);
        expect(buildMapper(points, [0, 0.4, 0.6, 1], graph.parameters)).toEqual(graph);
    });

    it('keeps book and tag composition on each node', () => {
        const graph = buildMapper(points, [0, 0.1, 0.9, 1], { coverCount: 2, overlap: 0.25, cosineDistanceThreshold: 0.03, minSharedMembers: 1 });
        expect(graph.nodes.every((node) => node.bookIds.length >= 1 && node.tagIds.length >= 1)).toBe(true);
    });

    it('rejects invalid covers, scores, and thresholds', () => {
        expect(() => buildMapper(points, [0, 1], { coverCount: 2, overlap: 0.25, cosineDistanceThreshold: 0.03, minSharedMembers: 1 })).toThrow();
        expect(() => buildMapper(points, [0, 0.1, 0.9, 1], { coverCount: 1, overlap: 0.25, cosineDistanceThreshold: 0.03, minSharedMembers: 1 })).toThrow();
        expect(() => buildMapper(points, [0, 0.1, 0.9, 1], { coverCount: 2, overlap: 1, cosineDistanceThreshold: 0.03, minSharedMembers: 1 })).toThrow();
    });
});
