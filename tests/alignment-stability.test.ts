import { describe, expect, it } from 'vitest';
import { alignFromAnchors, alignSimilarity, normalizedDisplacements, pairwiseDistanceCorrelation } from '../scripts/research/alignmentStability.ts';

describe('alignment stability research contracts', () => {
    const source = [[0, 0], [1, 0], [0, 1], [2, 2]] as const;
    const target = source.map(([x, y]) => [10 + 2 * x - 3 * y, 20 + 3 * x + 2 * y] as const);
    it('fits translation, uniform scale and rotation without changing IDs', () => {
        const aligned = alignSimilarity(source, target);
        expect(aligned.reflected).toBe(false);
        expect(aligned.normalizedRmse).toBeLessThan(1e-12);
        expect(aligned.points).toEqual(target);
        expect(normalizedDisplacements(aligned.points, target).maximum).toBeLessThan(1e-12);
    });
    it('reports reflection separately instead of silently reversing direction', () => {
        const mirrored = source.map(([x, y]) => [x, -y] as const);
        expect(alignSimilarity(source, mirrored).normalizedRmse).toBeGreaterThan(0.1);
        expect(alignSimilarity(source, mirrored, true).normalizedRmse).toBeLessThan(1e-12);
        expect(alignSimilarity(source, mirrored).reflected).toBe(false);
    });
    it('applies a fixed-anchor similarity transform to all points and preserves neighbor order', () => {
        const shifted = source.map(([x, y]) => [5 + 2 * x - y, 9 + x + 2 * y] as const);
        const aligned = alignFromAnchors(shifted, target, [0, 1, 2], false);
        expect(aligned.normalizedRmse).toBeLessThan(1e-12);
        expect(aligned.points).toEqual(target);
    });

    it('keeps pairwise distance association under similarity transforms', () => {
        expect(pairwiseDistanceCorrelation(source, target)).toBeGreaterThan(0.999999);
        expect(pairwiseDistanceCorrelation(source, source)).toBeCloseTo(1);
    });
    it('rejects mismatched or non-finite point pairs', () => {
        expect(() => alignSimilarity([[0, 0]], [[0, 0]])).toThrow();
        expect(() => alignSimilarity([[0, 0], [1, 0]], [[0, 0]])).toThrow();
        expect(() => normalizedDisplacements([[NaN, 0], [1, 0]], [[0, 0], [1, 0]])).toThrow();
    });
});
