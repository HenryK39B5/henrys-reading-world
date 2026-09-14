/**
 * A book room's walk through one book (docs/17 §3).
 *
 * The book room used to unfold a whole list in batches. It now shows one passage at a time and walks the
 * book in rounds: a round shows every available passage exactly once before anything repeats, and when a
 * round ends the room *says so and waits*. It never silently starts over — "I have seen all of this" is
 * the information the visitor asked for, and a quiet restart would hide it.
 *
 * Pure and RNG-injected: candidates are ordered by stable id, so the same book and the same RNG always
 * produce the same walk and every property below is testable without a browser.
 *
 * Reachability moved here from the batch list (docs/17 §3.4): every passage of every book is reachable
 * because one round visits all of them, and `walkRound` is the deterministic proof of that.
 */
import { pickUniform } from './discovery.ts';
import type { Highlight } from './types.ts';

export type BookWalkState = {
    bookId: string;
    /** The passage on screen; null only for a book that has nothing to show. */
    currentId: string | null;
    /** Passages of the current round, in the order they arrived. */
    seenIds: string[];
    /** The round is over: every available passage of this book has been shown once. */
    complete: boolean;
    /** Rounds walked in this session; only ever raised by an explicit restart. */
    rounds: number;
};

export type WalkProgress = {
    /** Passages already shown in this round. */
    seen: number;
    /** Passages this book can offer at all. */
    total: number;
    /** Nothing unseen is left; the visitor decides when to start again. */
    complete: boolean;
};

/** Ids are zero-padded, so a string comparison is also the stable numeric order. */
function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** The book's own passages in stable id order — the candidate list of every draw. */
export function walkCandidates(passages: Highlight[]): Highlight[] {
    return [...passages].sort(byId);
}

function unseen(candidates: Highlight[], seenIds: string[]): Highlight[] {
    return candidates.filter((highlight) => !seenIds.includes(highlight.id));
}

/** Begins a round with one real passage of the book. */
function openRound(bookId: string, candidates: Highlight[], rounds: number, rng: () => number): BookWalkState {
    const first = pickUniform(candidates, rng);
    if (first === null) {
        return { bookId, currentId: null, seenIds: [], complete: true, rounds };
    }
    return {
        bookId,
        currentId: first.id,
        seenIds: [first.id],
        // A book with one passage is finished the moment it is opened; it still has a passage to read.
        complete: candidates.length <= 1,
        rounds,
    };
}

/** Opens a round: entering a book shows a passage and counts it as seen. */
export function startWalk(bookId: string, passages: Highlight[], rng: () => number): BookWalkState {
    return openRound(bookId, walkCandidates(passages), 1, rng);
}

/**
 * One more passage of the same book.
 *
 * A finished round does not restart here: the room reports the end and the visitor restarts it. Unseen
 * material always wins, so a round of N passages is N distinct passages.
 */
export function nextInWalk(state: BookWalkState, passages: Highlight[], rng: () => number): BookWalkState {
    if (state.complete) {
        return state;
    }
    const candidates = walkCandidates(passages);
    const pick = pickUniform(unseen(candidates, state.seenIds), rng);
    if (pick === null) {
        // Only reachable if the book lost passages mid-round; the honest answer is "this round is over".
        return { ...state, complete: true };
    }
    const seenIds = [...state.seenIds, pick.id];
    return { ...state, currentId: pick.id, seenIds, complete: seenIds.length >= candidates.length };
}

/** A new round, explicitly asked for: the same no-repeat guarantee starts again from the first passage. */
export function restartWalk(state: BookWalkState, passages: Highlight[], rng: () => number): BookWalkState {
    return openRound(state.bookId, walkCandidates(passages), state.rounds + 1, rng);
}

export function walkProgress(state: BookWalkState, passages: Highlight[]): WalkProgress {
    const total = passages.length;
    const seen = Math.min(state.seenIds.length, total);
    return { seen, total, complete: state.complete || seen >= total };
}

/**
 * The ids one full round shows, in order.
 *
 * This is the reachability proof that replaced "walk the batched list to its end" (docs/17 §3.4): a round
 * covers the book, so the union over the 130 books is the whole library.
 */
export function walkRound(bookId: string, passages: Highlight[], rng: () => number): string[] {
    let state = startWalk(bookId, passages, rng);
    const ids: string[] = state.currentId === null ? [] : [state.currentId];
    for (let guard = 0; guard <= passages.length + 1 && !state.complete; guard += 1) {
        state = nextInWalk(state, passages, rng);
        if (state.currentId !== null && ids.at(-1) !== state.currentId) {
            ids.push(state.currentId);
        }
    }
    return ids;
}
