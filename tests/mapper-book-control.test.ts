import { describe, expect, it } from 'vitest';
import { matchedCasePairs } from '../scripts/research/mapperBookControl.ts';
import type { PartitionGraph } from '../scripts/research/mapperPartition.ts';

const points = [
    { id: 'a', bookId: 'one', tagIds: [], values: [1, 0] },
    { id: 'b', bookId: 'two', tagIds: [], values: [0.9, 0.1] },
    { id: 'c', bookId: 'three', tagIds: [], values: [0.5, 0.5] },
    { id: 'd', bookId: 'two', tagIds: [], values: [-1, 0] },
    { id: 'e', bookId: 'three', tagIds: [], values: [0, -1] },
    { id: 'f', bookId: 'two', tagIds: [], values: [1, 0] },
] as const;
const graph: PartitionGraph = { parameters: { coverCount: 2, overlap: 0.5, targetSize: 4, minNodeSize: 2, iterations: 6 }, nodes: [{ id: 'n-1-1', coverIndex: 1, componentIndex: 1, memberIds: ['a', 'b', 'c'], bookIds: ['one', 'two', 'three'], tagIds: [], lensRange: [0, 0.6] }], edges: [], droppedMemberIds: ['d', 'e', 'f'] };

describe('book-and-cover matched Mapper review', () => {
    it('selects nearest and farthest cross-book members with controls from the same book and cover outside the node', () => {
        const pairs = matchedCasePairs(points, [0, 0.2, 0.3, 0.2, 0.9, 0.4], graph, 'a', () => 0);
        expect(pairs.map((pair) => [pair.role, pair.memberId, pair.controlId])).toEqual([['nearest', 'b', 'd'], ['farthest', 'c', null]]);
        expect(pairs[0]!.memberBookId).toBe('two');
        expect(pairs[1]!.controlPoolSize).toBe(0);
    });
    it('is deterministic under reordered input when scores follow IDs, and preserves failure to find a node', () => {
        const scores = [0, 0.2, 0.3, 0.2, 0.9, 0.4];
        expect(matchedCasePairs(points, scores, graph, 'a', () => 0.7)).toEqual(matchedCasePairs([...points].reverse(), [...scores].reverse(), graph, 'a', () => 0.7));
        expect(matchedCasePairs(points, scores, graph, 'f', () => 0)).toEqual([]);
    });
    it('rejects invalid RNG, mismatched score and unknown anchor', () => {
        expect(() => matchedCasePairs(points, [0, 0.2, 0.3, 0.2, 0.9, 0.4], graph, 'a', () => 1)).toThrow();
        expect(() => matchedCasePairs(points, [0], graph, 'a', () => 0)).toThrow();
        expect(() => matchedCasePairs(points, [0, 0.2, 0.3, 0.2, 0.9, 0.4], graph, 'missing', () => 0)).toThrow();
    });
});
