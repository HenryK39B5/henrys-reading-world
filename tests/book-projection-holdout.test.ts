import { describe, expect, it } from 'vitest';
import { bookHoldout, equalBookSummary, nontrivialMemberTask } from '../scripts/research/bookProjectionHoldout.ts';

describe('book holdout research contracts', () => {
    const points = [
        { id: 'a', bookId: 'held', tagIds: ['topic'] }, { id: 'b', bookId: 'held', tagIds: [] },
        { id: 'c', bookId: 'other', tagIds: ['topic'] }, { id: 'd', bookId: 'other', tagIds: ['topic'] },
        { id: 'e', bookId: 'other', tagIds: [] }, { id: 'f', bookId: 'third', tagIds: ['other-topic'] },
    ];
    it('excludes the entire held book from both covariance groups and candidate pool', () => {
        expect(bookHoldout(points, 'topic', 'held')).toEqual({ foreground: [2, 3], background: [4, 5], queries: [0], candidates: [2, 3, 4, 5], status: 'evaluated' });
    });
    it('reports unidentifiable folds rather than fitting a singleton covariance', () => {
        expect(bookHoldout(points, 'topic', 'other').status).toBe('insufficient-foreground');
        expect(bookHoldout(points, 'missing', 'held').status).toBe('no-queries');
    });
    it('does not count complete tiny neighbor pools as evidence of quality', () => {
        expect(nontrivialMemberTask(5, 5)).toBe(false);
        expect(nontrivialMemberTask(6, 5)).toBe(true);
        expect(() => nontrivialMemberTask(-1, 5)).toThrow();
    });
    it('gives each source book equal weight rather than each excerpt', () => {
        const result = equalBookSummary([{ bookId: 'a', value: 1 }, { bookId: 'a', value: 1 }, { bookId: 'b', value: 0 }]);
        expect(result).toMatchObject({ bookCount: 2, queryCount: 3, mean: 0.5 });
        expect(equalBookSummary([]).mean).toBeNull();
        expect(() => equalBookSummary([{ bookId: 'a', value: NaN }])).toThrow();
    });
});
