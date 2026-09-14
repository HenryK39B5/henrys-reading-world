import { describe, expect, it } from 'vitest';
import { nextInWalk, restartWalk, startWalk, walkProgress, walkRound, type BookWalkState } from './bookWalk.ts';
import type { Highlight } from './types.ts';

/**
 * The book room's walk (docs/17 §3).
 *
 * What has to hold, for a book of any size: one round shows every available passage exactly once, in
 * stable-id candidate order, and then stops and says so — a round never repeats, never silently restarts
 * and never loses a passage. Deterministic RNGs make the fairness properties exact rather than probable.
 */
const BOOK = 'b-001';

function passages(count: number): Highlight[] {
    return Array.from({ length: count }, (_unused, index) => ({
        id: `h-${String(index + 1).padStart(3, '0')}`,
        bookId: BOOK,
        text: '一段用于验证的占位文本。',
    }));
}

/** A uniform-enough RNG for property tests: a fixed sweep over [0, 1). */
function sweep(steps: number): () => number {
    let cursor = 0;
    return () => {
        cursor = (cursor + 1) % steps;
        return cursor / steps;
    };
}

/** Always the first candidate, so a walk is exactly reproducible. */
const first = (): number => 0;
/** Always the last candidate. */
const last = (): number => 0.999_999;

function round(state: BookWalkState, items: Highlight[], rng: () => number): BookWalkState {
    let current = state;
    for (let guard = 0; guard <= items.length + 2 && !current.complete; guard += 1) {
        current = nextInWalk(current, items, rng);
    }
    return current;
}

describe('a round of a book shows every passage once', () => {
    it('counts the opening passage as seen', () => {
        const items = passages(5);
        const state = startWalk(BOOK, items, first);
        expect(state.currentId).toBe('h-001');
        expect(state.seenIds).toEqual(['h-001']);
        expect(state.complete).toBe(false);
        expect(state.rounds).toBe(1);
    });

    it('walks all N of a book in exactly N draws, with no repeat', () => {
        for (const size of [1, 2, 3, 10, 57]) {
            const items = passages(size);
            const seen: string[] = [];
            let state = startWalk(BOOK, items, sweep(7));
            if (state.currentId !== null) {
                seen.push(state.currentId);
            }
            for (let guard = 0; guard <= size + 2 && !state.complete; guard += 1) {
                state = nextInWalk(state, items, sweep(7));
                if (state.currentId !== null) {
                    seen.push(state.currentId);
                }
            }
            expect(seen, `size ${String(size)}`).toHaveLength(size);
            expect(new Set(seen).size, `size ${String(size)}`).toBe(size);
            expect(state.complete).toBe(true);
            // Every passage of the book is in that round — nothing is skipped.
            expect([...seen].sort()).toEqual(items.map((item) => item.id).sort());
        }
    });

    it('reports completion for a book with a single passage without pretending there is more', () => {
        const items = passages(1);
        const state = startWalk(BOOK, items, first);
        expect(state.complete).toBe(true);
        expect(walkProgress(state, items)).toEqual({ seen: 1, total: 1, complete: true });
        // Asking for more changes nothing: a finished round is finished.
        expect(nextInWalk(state, items, first)).toBe(state);
    });

    it('never repeats after a round is over, however many times it is asked', () => {
        const items = passages(4);
        let state = round(startWalk(BOOK, items, first), items, first);
        expect(state.complete).toBe(true);
        const settled = state;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            state = nextInWalk(state, items, last);
        }
        expect(state).toBe(settled);
        expect(state.seenIds).toHaveLength(4);
    });

    it('does not restart itself: only an explicit restart opens a new round', () => {
        const items = passages(3);
        const done = round(startWalk(BOOK, items, first), items, first);
        expect(done.rounds).toBe(1);

        const again = restartWalk(done, items, last);
        expect(again.rounds).toBe(2);
        expect(again.seenIds).toHaveLength(1);
        expect(again.complete).toBe(false);
        expect(again.currentId).toBe('h-003');
        // The new round still covers the book exactly once.
        const walk = round(again, items, last);
        expect(walk.complete).toBe(true);
        expect(walk.seenIds).toHaveLength(3);
    });

    it('draws from the unseen remainder only, so a repeat cannot happen mid-round', () => {
        const items = passages(6);
        let state = startWalk(BOOK, items, first);
        const seen = new Set(state.seenIds);
        for (let guard = 0; guard < 5; guard += 1) {
            state = nextInWalk(state, items, last);
            if (state.currentId === null) {
                break;
            }
            expect(seen.has(state.currentId), 'a round must not show the same passage twice').toBe(false);
            seen.add(state.currentId);
        }
        expect(state.complete).toBe(true);
    });

    it('walks a book whose passages arrive out of order in stable id order', () => {
        const items = [passages(3)[2], passages(3)[0], passages(3)[1]].filter(
            (item): item is Highlight => item !== undefined,
        );
        // The candidate list is ordered, not the caller's array.
        expect(walkRound(BOOK, items, sweep(5)).slice().sort()).toEqual(['h-001', 'h-002', 'h-003']);
    });

    it('reports an empty book instead of inventing a passage', () => {
        const state = startWalk(BOOK, [], first);
        expect(state.currentId).toBeNull();
        expect(state.seenIds).toEqual([]);
        expect(state.complete).toBe(true);
        expect(walkProgress(state, [])).toEqual({ seen: 0, total: 0, complete: true });
        expect(walkRound(BOOK, [], first)).toEqual([]);
    });
});

describe('progress describes the round, not the platform', () => {
    it('counts seen against this book only', () => {
        const items = passages(9);
        let state = startWalk(BOOK, items, first);
        expect(walkProgress(state, items)).toEqual({ seen: 1, total: 9, complete: false });
        state = nextInWalk(state, items, first);
        state = nextInWalk(state, items, first);
        expect(walkProgress(state, items)).toEqual({ seen: 3, total: 9, complete: false });
    });

    it('never claims more seen than the book holds', () => {
        const items = passages(2);
        const state = round(startWalk(BOOK, items, first), items, first);
        expect(walkProgress(state, items).seen).toBe(2);
    });
});

describe('the deterministic proof of reachability', () => {
    it('returns every passage of a large book exactly once', () => {
        const items = passages(531);
        const ids = walkRound(BOOK, items, sweep(97));
        expect(ids).toHaveLength(531);
        expect(new Set(ids).size).toBe(531);
        expect([...ids].sort()).toEqual(items.map((item) => item.id).sort());
    });

    it('is reproducible for the same book and the same RNG', () => {
        const items = passages(64);
        expect(walkRound(BOOK, items, sweep(31))).toEqual(walkRound(BOOK, items, sweep(31)));
    });
});
