import { describe, expect, it } from 'vitest';
import {
    branchPathWalk,
    nextInPathWalk,
    pathProgress,
    pathRound,
    restartPathWalk,
    startPathWalk,
    type PathWalkState,
} from './pathWalk.ts';
import type { Highlight } from './types.ts';

function highlight(id: string, bookId: string, tagIds = ['tag-001'], pathVector?: number[]): Highlight {
    return { id, bookId, text: `passage ${id}`, tagIds, ...(pathVector === undefined ? {} : { pathVector }) };
}

function rng(values: number[]): () => number {
    let cursor = 0;
    return () => {
        const value = values[cursor % values.length] ?? 0;
        cursor += 1;
        return value;
    };
}

const HIGHLIGHTS: Highlight[] = [
    highlight('h-001', 'b-001', ['tag-001', 'tag-002'], [127, 0]),
    highlight('h-002', 'b-001', ['tag-001'], [120, 20]),
    highlight('h-003', 'b-002', ['tag-001'], [110, 40]),
    highlight('h-004', 'b-002', ['tag-001'], [80, 80]),
    highlight('h-005', 'b-003', ['tag-001'], [20, 120]),
    highlight('h-006', 'b-003', ['tag-001', 'tag-002'], [-40, 110]),
];

describe('a topic path is a finite fair round', () => {
    it('selects books fairly before choosing a passage and avoids consecutive books when possible', () => {
        let state = startPathWalk('tag-001', HIGHLIGHTS, 'uniform', rng([0]));
        expect(state.currentId).toBe('h-001');
        state = nextInPathWalk(state, HIGHLIGHTS, rng([0, 0]));
        expect(HIGHLIGHTS.find((item) => item.id === state.currentId)?.bookId).toBe('b-002');
        state = nextInPathWalk(state, HIGHLIGHTS, rng([0, 0]));
        expect(HIGHLIGHTS.find((item) => item.id === state.currentId)?.bookId).toBe('b-003');
        expect(state.bookCycleIds).toEqual(['b-001', 'b-002', 'b-003']);
    });

    it('reaches every eligible highlight once and waits for an explicit restart', () => {
        const ids = pathRound('tag-001', HIGHLIGHTS, 'uniform', rng([0.2, 0.7, 0.4, 0.9]));
        expect(ids).toHaveLength(6);
        expect(new Set(ids)).toEqual(new Set(HIGHLIGHTS.map((item) => item.id)));

        let state = startPathWalk('tag-002', HIGHLIGHTS, 'uniform', rng([0]));
        state = nextInPathWalk(state, HIGHLIGHTS, rng([0]));
        expect(pathProgress(state, HIGHLIGHTS)).toEqual({ seen: 2, total: 2, complete: true });
        expect(nextInPathWalk(state, HIGHLIGHTS, rng([0]))).toBe(state);
        const restarted = restartPathWalk(state, HIGHLIGHTS, rng([0.99]));
        expect(restarted.rounds).toBe(2);
        expect(restarted.seenIds).toHaveLength(1);
    });

    it('is reproducible for fixed input and injected randomness', () => {
        const first = pathRound('tag-001', HIGHLIGHTS, 'semantic', rng([0.13, 0.81, 0.42]));
        const second = pathRound('tag-001', HIGHLIGHTS, 'semantic', rng([0.13, 0.81, 0.42]));
        expect(second).toEqual(first);
    });
});

describe('semantic rhythm is soft and book-local', () => {
    const current = highlight('h-100', 'b-001', ['tag-001'], [127, 0]);
    const targetBook = [
        highlight('h-201', 'b-002', ['tag-001'], [126, 2]),
        highlight('h-202', 'b-002', ['tag-001'], [120, 20]),
        highlight('h-203', 'b-002', ['tag-001'], [100, 60]),
        highlight('h-204', 'b-002', ['tag-001'], [60, 100]),
        highlight('h-205', 'b-002', ['tag-001'], [10, 126]),
        highlight('h-206', 'b-002', ['tag-001'], [-80, 80]),
    ];
    const source = [current, ...targetBook];
    const base: PathWalkState = {
        tagId: 'tag-001',
        currentId: current.id,
        seenIds: [current.id],
        bookCycleIds: [current.bookId],
        complete: false,
        rounds: 1,
        rhythm: 'semantic',
        lastPacing: 'uniform',
    };

    it('chooses a near/middle/far band only after the fair target book is fixed', () => {
        const state = nextInPathWalk(base, source, rng([0, 0.5, 0]));
        expect(source.find((item) => item.id === state.currentId)?.bookId).toBe('b-002');
        expect(state.lastPacing).toBe('middle');
        expect(state.currentId).toBe('h-203');
    });

    it('falls back to uniform choice when vectors are unavailable', () => {
        const withoutVectors = source.map((highlight) => {
            const copy: Record<string, unknown> = { ...highlight };
            delete copy['pathVector'];
            return copy as Highlight;
        });
        const state = nextInPathWalk(base, withoutVectors, rng([0, 0.5]));
        expect(state.lastPacing).toBe('uniform');
        expect(withoutVectors.find((item) => item.id === state.currentId)?.bookId).toBe('b-002');
    });
});

describe('a fork changes direction without moving the current passage', () => {
    it('seeds the new path with the intersection and leaves the old state untouched', () => {
        const original = startPathWalk('tag-001', HIGHLIGHTS, 'uniform', rng([0]));
        const branched = branchPathWalk(original, 'tag-002', HIGHLIGHTS, 'semantic', rng([0.8]));
        expect(branched.tagId).toBe('tag-002');
        expect(branched.currentId).toBe(original.currentId);
        expect(branched.seenIds).toEqual([original.currentId]);
        expect(original.tagId).toBe('tag-001');
    });
});
