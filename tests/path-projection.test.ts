import { describe, expect, it } from 'vitest';
import { projectPathVector } from '../scripts/embeddings/pathProjection.ts';
import { PATH_VECTOR_DIMENSIONS } from '../src/domain/types.ts';

describe('public-safe path projection', () => {
    it('is deterministic, bounded and much smaller than the source embedding', () => {
        const source = Array.from({ length: 1024 }, (_, index) => Math.sin(index / 17));
        const first = projectPathVector(source);
        const second = projectPathVector(source);
        expect(first).toEqual(second);
        expect(first).toHaveLength(PATH_VECTOR_DIMENSIONS);
        expect(first.every((value) => Number.isInteger(value) && value >= -127 && value <= 127)).toBe(true);
    });

    it('rejects empty, non-finite and zero vectors instead of exporting meaningless coordinates', () => {
        expect(() => projectPathVector([])).toThrow('non-empty finite');
        expect(() => projectPathVector([1, Number.NaN])).toThrow('non-empty finite');
        expect(() => projectPathVector([0, 0, 0])).toThrow('non-zero');
    });
});
