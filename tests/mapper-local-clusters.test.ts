import { describe, expect, it } from 'vitest';
import { buildLocalMapper } from '../scripts/research/mapperLocalClusters.ts';

const points = [
    { id: 'a', values: [1, 0], bookId: 'b1', tagIds: ['t1'] },
    { id: 'b', values: [0.99, 0.01], bookId: 'b2', tagIds: ['t1'] },
    { id: 'c', values: [-1, 0], bookId: 'b3', tagIds: ['t2'] },
    { id: 'd', values: [-0.99, -0.01], bookId: 'b4', tagIds: ['t2'] },
] as const;

describe('local mapper clusters', () => {
    it('forms mutual-neighbor communities and records cross-cover edges', () => {
        const parameters = { coverCount: 2, overlap: 0.75, cosineDistanceThreshold: 0, minSharedMembers: 1, neighborCount: 2, minNodeSize: 2, mutual: true } as const;
        const graph = buildLocalMapper(points, [0, 0.2, 0.8, 1], parameters);
        expect(graph.nodes.every((node) => node.memberIds.length >= 2)).toBe(true);
        expect(graph.edges.some((edge) => edge.sharedMemberIds.length > 0)).toBe(true);
        expect(graph.droppedMemberIds).toHaveLength(0);
    });

    it('drops undersized fragments instead of presenting singleton topology', () => {
        const graph = buildLocalMapper(points, [0, 0.2, 0.8, 1], { coverCount: 2, overlap: 0.5, cosineDistanceThreshold: 0, minSharedMembers: 1, neighborCount: 1, minNodeSize: 3, mutual: true });
        expect(graph.nodes).toHaveLength(0);
        expect(graph.droppedMemberIds).toHaveLength(4);
    });

    it('is deterministic and validates local parameters', () => {
        const parameters = { coverCount: 2, overlap: 0.5, cosineDistanceThreshold: 0, minSharedMembers: 1, neighborCount: 1, minNodeSize: 2, mutual: false } as const;
        expect(buildLocalMapper(points, [0, 0.2, 0.8, 1], parameters)).toEqual(buildLocalMapper(points, [0, 0.2, 0.8, 1], parameters));
        expect(() => buildLocalMapper(points, [0, 1], parameters)).toThrow();
        expect(() => buildLocalMapper(points, [0, 0.2, 0.8, 1], { ...parameters, minNodeSize: 1 })).toThrow();
    });
});
