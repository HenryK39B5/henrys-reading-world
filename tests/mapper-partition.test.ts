import { describe, expect, it } from 'vitest';
import { bestMemberOverlap, partitionMapper } from '../scripts/research/mapperPartition.ts';

const points = [
    { id: 'a', values: [1, 0], bookId: 'b1', tagIds: ['t1'] },
    { id: 'b', values: [0.99, 0.01], bookId: 'b2', tagIds: [] },
    { id: 'c', values: [-1, 0], bookId: 'b3', tagIds: ['t2'] },
    { id: 'd', values: [-0.99, -0.01], bookId: 'b4', tagIds: [] },
] as const;
const parameters = { coverCount: 2, overlap: 0.75, targetSize: 4, minNodeSize: 2, iterations: 3 };

describe('partition Mapper', () => {
    it('retains actual shared members across covers and is input-order independent', () => {
        const scores = [0, 0.2, 0.8, 1];
        const graph = partitionMapper(points, scores, parameters);
        expect(graph.droppedMemberIds).toEqual([]);
        expect(graph.nodes.every((node) => node.memberIds.length >= 2)).toBe(true);
        expect(graph.edges.length).toBeGreaterThan(0);
        for (const edge of graph.edges) {
            const left = graph.nodes.find((node) => node.id === edge.source)!;
            const right = graph.nodes.find((node) => node.id === edge.target)!;
            expect(edge.sharedMemberIds).toEqual(left.memberIds.filter((id) => right.memberIds.includes(id)));
        }
        expect(partitionMapper([...points].reverse(), [...scores].reverse(), parameters)).toEqual(graph);
    });
    it('reports every discarded point when the minimum size is unattainable', () => {
        const graph = partitionMapper(points, [0, 0.2, 0.8, 1], { ...parameters, minNodeSize: 5 });
        expect(graph.nodes).toEqual([]);
        expect(graph.droppedMemberIds).toEqual(['a', 'b', 'c', 'd']);
    });
    it('calculates the best member Jaccard including no match', () => {
        const graph = partitionMapper(points, [0, 0.2, 0.8, 1], parameters);
        expect(bestMemberOverlap(graph.nodes[0]!, graph.nodes)).toBe(1);
        expect(bestMemberOverlap(graph.nodes[0]!, [])).toBe(0);
    });
    it('rejects invalid covers, dimension mismatch, duplicate IDs and nonfinite scores', () => {
        expect(() => partitionMapper(points, [0], parameters)).toThrow();
        expect(() => partitionMapper(points, [0, 0.2, 0.8, 1], { ...parameters, overlap: 1 })).toThrow();
        expect(() => partitionMapper([points[0]!, points[0]!], [0, 1], parameters)).toThrow();
        expect(() => partitionMapper([points[0]!, { ...points[1]!, values: [1] }], [0, 1], parameters)).toThrow();
        expect(() => partitionMapper(points, [0, NaN, 0.8, 1], parameters)).toThrow();
    });
});
