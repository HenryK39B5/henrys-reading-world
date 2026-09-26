import { describe, expect, it } from 'vitest';
import { compareNeighborhoods, fitContrastive, fitPca, median, normalizeRows, orderedNeighbors, projectLinear, rotatePcaPlane, takeNeighborhood } from '../scripts/research/projectionWindows.ts';

const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);

describe('projection windows: numerical fixtures, never product excerpts', () => {
    it('normalizes finite nonzero vectors and rejects invalid input', () => {
        expect(normalizeRows([[3, 4], [0, 2]])).toEqual([[0.6, 0.8], [0, 1]]);
        for (const rows of [[], [[1]], [[0, 0], [1, 2]], [[1, 2], [1]], [[1, NaN], [1, 2]]]) expect(() => normalizeRows(rows)).toThrow();
    });
    it('finds the larger-variance PCA direction and centers scores', () => {
        const model = fitPca([[-4, 0], [4, 0], [0, 1], [0, -1]], 2);
        expect(model.basis[0]![0]).toBeCloseTo(1);
        expect(model.eigenvalues[0]).toBeCloseTo(32 / 3);
        expect(dot(model.basis[0]!, model.basis[1]!)).toBeCloseTo(0);
        const rows = projectLinear([[8, 1], [12, 1], [10, 0], [10, 2]], fitPca([[8, 1], [12, 1], [10, 0], [10, 2]], 2));
        expect(rows.reduce((sum, row) => sum + row[0]!, 0)).toBeCloseTo(0);
    });
    it('uses separate group centering; alpha0 is foreground PCA, alpha1 removes shared variance', () => {
        const fg = [[-5, 0], [5, 0], [0, -2], [0, 2]];
        const bg = [[-9, 0], [9, 0], [0, -1], [0, 1]];
        expect(fitContrastive(fg, bg, 0).basis[0]![0]).toBeCloseTo(1);
        const contrast = fitContrastive(fg, bg, 1);
        expect(contrast.basis[0]![1]).toBeCloseTo(1);
        expect(contrast.eigenvalues[1]).toBeLessThan(0);
        const shifted = fitContrastive(fg.map((r) => r.map((x) => x + 10)), bg.map((r) => r.map((x) => x - 10)), 1);
        expect(shifted.eigenvalues).toEqual(contrast.eigenvalues);
        expect(() => fitContrastive(fg, bg, -1)).toThrow();
        expect(() => fitContrastive(fg.slice(0, 1), bg, 1)).toThrow();
    });
    it('rotates a real orthonormal plane with exact original/secondary endpoints', () => {
        const scores = [[1, 2, 3, 4]];
        expect(rotatePcaPlane(scores, 0)).toEqual([[1, 2]]);
        expect(rotatePcaPlane(scores, 90)[0]![0]).toBeCloseTo(3);
        expect(rotatePcaPlane(scores, 90)[0]![1]).toBeCloseTo(4);
        expect(dot([Math.cos(0.5), 0, Math.sin(0.5), 0], [0, Math.cos(0.5), 0, Math.sin(0.5)])).toBe(0);
        expect(() => rotatePcaPlane([[1, 2]], 30)).toThrow();
    });
    it('excludes self by ID only, keeps real duplicates, stable tie-break and ties sensitivity', () => {
        const rows = normalizeRows([[1, 0], [1, 0], [0, 1], [0, 1]]);
        const ranked = orderedNeighbors(rows, ['self', 'copy', 'b', 'a'], 0, 'cosine-unit');
        expect(ranked.map((r) => r.index)).toEqual([1, 3, 2]);
        expect(takeNeighborhood(ranked, 2)).toHaveLength(2);
        expect(takeNeighborhood(ranked, 2, true)).toHaveLength(3);
        expect(() => orderedNeighbors(rows, ['same', 'same', 'b', 'a'], 0, 'cosine-unit')).toThrow();
        expect(() => takeNeighborhood(ranked, 0)).toThrow();
    });
    it('distinguishes retained nearest neighbors from farther-ranked projection neighbors', () => {
        const high = Array.from({ length: 20 }, (_, index) => ({ index, distance: index }));
        const low = [high[0]!, high[19]!, ...high.slice(1, 19)];
        expect(compareNeighborhoods(high, low, 2)).toMatchObject({ overlap: 1, recall: 0.5, precision: 0.5, outsideHighTopTenPercentShare: 0.5 });
        expect(compareNeighborhoods(high, high, 2).recall).toBe(1);
    });
    it('uses both middle values in an even-sample median', () => {
        expect(median([0, 1])).toBe(0.5);
        expect(median([3, 1, 2])).toBe(2);
        expect(() => median([])).toThrow();
    });
});
