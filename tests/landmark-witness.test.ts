import { describe, expect, it } from 'vitest';
import { farthestLandmarks, witnessAtlas } from '../scripts/research/landmarkWitness.ts';

const points = [
    { id: 'a', bookId: 'one', values: [1, 0] },
    { id: 'b', bookId: 'two', values: [-1, 0] },
    { id: 'c', bookId: 'three', values: [0, 1] },
    { id: 'd', bookId: 'three', values: [0, -1] },
    { id: 'e', bookId: 'four', values: [1, 1] },
    { id: 'f', bookId: 'five', values: [-1, 1] },
];

describe('real-passage landmark witness graph primitives', () => {
    it('selects nested max-min prefixes, deterministic across input order and without book filters', () => {
        expect(farthestLandmarks(points, 'a', 2)).toEqual(['a', 'b']);
        expect(farthestLandmarks(points, 'a', 3)).toEqual(['a', 'b', 'c']);
        expect(farthestLandmarks([...points].reverse(), 'a', 3)).toEqual(['a', 'b', 'c']);
    });
    it('excludes landmark self-witnesses and retains actual witness ids for each edge', () => {
        const graph = witnessAtlas(points, ['a', 'b', 'c']);
        expect(graph.witnessCount).toBe(3);
        expect(graph.assignments.map((item) => item.id)).toEqual(['d', 'e', 'f']);
        expect(graph.edges.map(({ source, target, witnesses }) => [source, target, witnesses.map((w) => w.id)])).toEqual([
            ['a', 'b', ['d']], ['a', 'c', ['e']], ['b', 'c', ['f']],
        ]);
        const counted = graph.edges.flatMap((edge) => edge.witnesses.map((w) => w.id));
        expect(counted.sort()).toEqual(['d', 'e', 'f']);
        expect(graph).toEqual(witnessAtlas([...points].reverse(), ['a', 'b', 'c']));
    });
    it('handles tied landmark similarities by id, rejects invalid inputs', () => {
        const atlas = witnessAtlas(points, ['b', 'c', 'a']);
        expect(atlas.assignments.find((item) => item.id === 'e')?.firstId).toBe('a');
        expect(() => witnessAtlas(points, ['a', 'a'])).toThrow();
        expect(() => farthestLandmarks(points, 'missing', 3)).toThrow();
        expect(() => witnessAtlas([{ ...points[0]!, values: [0, 0] }, ...points.slice(1)], ['a', 'b'])).toThrow();
    });
});
