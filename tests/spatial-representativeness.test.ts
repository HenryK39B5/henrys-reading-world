import { describe, expect, it } from 'vitest';
import { auditAnchor, memberMedian, memberMedoid, type ResearchPoint } from '../scripts/research/spatialRepresentativeness.ts';

const point = (id: string, x: number, tagIds: string[] = ['topic'], bookId = 'book'): ResearchPoint => ({ id, x, y: 0, tagIds, bookId });

describe('spatial representativeness research', () => {
    it('rejects an empty member group', () => {
        expect(() => memberMedian([])).toThrow();
        expect(() => memberMedoid([])).toThrow();
        expect(() => auditAnchor([point('other', 0, [])], 'topic', { x: 0, y: 0 })).toThrow();
    });

    it('matches the rounded coordinate-wise published median', () => {
        expect(memberMedian([point('a', 0), point('b', 3)])).toEqual({ x: 2, y: 0 });
        expect(memberMedian([point('a', 0), point('b', 5), point('c', 100)])).toEqual({ x: 5, y: 0 });
    });

    it('selects a real Euclidean medoid with deterministic ties', () => {
        expect(memberMedoid([point('c', 100), point('a', 0), point('b', 5)]).id).toBe('b');
        expect(memberMedoid([point('b', 10), point('a', 0)]).id).toBe('a');
    });

    it('does not treat untagged points as verified negatives', () => {
        const points = [point('a', 0), point('b', 1, []), point('c', 2, ['other'])];
        const [local] = auditAnchor(points, 'topic', { x: 0, y: 0 }, [2]).neighborhoods;
        expect(local).toMatchObject({ actual: 2, memberCount: 1, memberShare: 0.5, untaggedCount: 1, taggedSupportShare: 1, taggedLift: 2 });
    });

    it('records book dominance and clips to actual available neighbors', () => {
        const points = [point('a', 0), point('b', 1), point('c', 2, ['topic'], 'another')];
        const [local] = auditAnchor(points, 'topic', { x: 0, y: 0 }, [15]).neighborhoods;
        expect(local).toMatchObject({ actual: 3, supportingBookCount: 2, largestSupportingBookShare: 2 / 3, radius: 2 });
    });

    it('keeps neighborhoods deterministic for overlapping coordinates', () => {
        const points = [point('b', 0), point('a', 0), point('c', 0)];
        expect(auditAnchor(points, 'topic', { x: 0, y: 0 }, [2]).neighborhoods[0]!.neighborIds).toEqual(['a', 'b']);
        expect(() => auditAnchor(points, 'topic', { x: 0, y: 0 }, [0])).toThrow();
    });
});
