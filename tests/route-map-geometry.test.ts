import { describe, expect, it } from 'vitest';
import { normalizedMapDistance, pickBookMatchedId, rankPublishedNeighbor } from '../scripts/research/routeMapGeometry.ts';

const points = [
    { highlightId: 'a', x: 0, y: 0 },
    { highlightId: 'b', x: 3, y: 4 },
    { highlightId: 'c', x: 4, y: 3 },
    { highlightId: 'd', x: 10, y: 0 },
];

describe('published-map route diagnostics', () => {
    it('normalizes by published-world diagonal and ranks all points with ID ties', () => {
        expect(normalizedMapDistance(points[0]!, points[1]!)).toBeCloseTo(5 / (10_000 * Math.SQRT2));
        expect(rankPublishedNeighbor(points, 'a', 'b')).toBe(1);
        expect(rankPublishedNeighbor(points, 'a', 'c')).toBe(2);
        expect(rankPublishedNeighbor([...points].reverse(), 'a', 'c')).toBe(2);
        expect(rankPublishedNeighbor(points, 'a', 'd')).toBe(3);
    });
    it('draws a book-matched control using sorted IDs and injectable RNG', () => {
        expect(pickBookMatchedId(['d', 'b', 'c'], () => 0)).toBe('b');
        expect(pickBookMatchedId(['d', 'b', 'c'], () => .999)).toBe('d');
        expect(() => pickBookMatchedId(['b'], () => 1)).toThrow();
        expect(() => pickBookMatchedId([], () => 0)).toThrow();
    });
    it('rejects missing/duplicate points and coordinates outside the world', () => {
        expect(() => rankPublishedNeighbor(points, 'a', 'a')).toThrow();
        expect(() => rankPublishedNeighbor(points, 'a', 'missing')).toThrow();
        expect(() => rankPublishedNeighbor([...points, points[0]!], 'a', 'b')).toThrow();
        expect(() => normalizedMapDistance(points[0]!, { x: -1, y: 2 })).toThrow();
    });
});
