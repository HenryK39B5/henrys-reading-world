import { describe, expect, it } from 'vitest';
import { islandSweep, mutualNeighborGraph, truncateMutualGraph, type NeighborGraph } from '../scripts/research/graphIslands.ts';

describe('original-space graph islands', () => {
    const points = [
        { id: 'a', bookId: 'one', values: [1, 0] },
        { id: 'b', bookId: 'two', values: [0.9, 0.1] },
        { id: 'c', bookId: 'three', values: [0, 1] },
        { id: 'd', bookId: 'four', values: [-1, 0] },
    ];
    it('requires reciprocal top-k; retains unpaired points and deterministic ID ties', () => {
        const graph = mutualNeighborGraph(points, 1);
        expect(graph.ids).toEqual(['a', 'b', 'c', 'd']);
        expect(graph.nominations.a?.map((item) => item.id)).toEqual(['b']);
        expect(graph.edges.map(({ source, target }) => [source, target])).toEqual([['a', 'b']]);
        expect(graph).toEqual(mutualNeighborGraph([...points].reverse(), 1));
        expect(truncateMutualGraph(mutualNeighborGraph(points, 2), 1)).toEqual(graph);
        expect(islandSweep(graph, .75).singletonCount).toBe(2);
        const tied = mutualNeighborGraph([{ id: 'z', bookId: 'b', values: [1, 0] }, { id: 'm', bookId: 'b', values: [1, 0] }, { id: 'a', bookId: 'b', values: [1, 0] }], 1);
        expect(tied.nominations.z?.map((neighbor) => neighbor.id)).toEqual(['a']);
        expect(tied.edges).toEqual([{ source: 'a', target: 'm', score: 1 }]);
    });
    it('uses a rank threshold with all ties and defines bridges by different strong-edge components', () => {
        const graph: NeighborGraph = { k: 2, ids: ['e', 'c', 'a', 'd', 'b'], books: { a: 'one', b: 'two', c: 'three', d: 'four', e: 'four' }, nominations: {}, edges: [
            { source: 'a', target: 'b', score: .9 }, { source: 'b', target: 'c', score: .7 },
            { source: 'c', target: 'd', score: .8 }, { source: 'd', target: 'e', score: .6 },
        ] };
        const sweep = islandSweep(graph, .75);
        expect(sweep.threshold).toBe(.8);
        expect(sweep.components).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
        expect(sweep.bridges.map(({ source, target }) => [source, target])).toEqual([['b', 'c'], ['d', 'e']]);
        expect(sweep.componentsAtLeastFour).toBe(0);
        const ties = islandSweep({ ...graph, edges: graph.edges.map((edge) => edge.source === 'b' ? { ...edge, score: .8 } : edge) }, .75);
        expect(ties.edgeCount).toBe(3);
        expect(ties.components).toEqual([['a', 'b', 'c', 'd'], ['e']]);
        expect(ties.crossBookComponentsAtLeastFour).toBe(1);
    });
    it('rejects invalid vectors and configurations', () => {
        expect(() => mutualNeighborGraph(points, 4)).toThrow();
        expect(() => mutualNeighborGraph([{ ...points[0]!, values: [0, 0] }, points[1]!], 1)).toThrow();
        expect(() => mutualNeighborGraph([{ ...points[0]!, values: [Number.NaN, 1] }, points[1]!], 1)).toThrow();
        expect(() => islandSweep(mutualNeighborGraph(points, 1), 2)).toThrow();
    });
});
