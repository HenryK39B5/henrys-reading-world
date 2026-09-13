/**
 * Transitional discovery selector (schema v2, V2-A).
 *
 * v1 curated the first screens (Opening → Contrast → Surprise) and weighted passages by editorial
 * quality. docs/10 removed that: the product is a place to wander, not a designed impression. So this
 * selector keeps only the mechanical guarantees the product still needs:
 *
 *   1. de-duplication first — freshness beats any other consideration;
 *   2. avoid the book currently on screen when another book is available;
 *   3. prefer books this session has not shown yet;
 *   4. even odds inside the chosen tier (no passage-count weighting, no quality weighting).
 *
 * V2-B replaces this file with the two-stage fair engine from docs/11 §4 (choose a book, then a
 * passage, with per-scope cycles). Everything here is pure and deterministic for a given `rng`.
 */
import type { SelectionInput, SelectionResult, Selector } from './selection.ts';
import type { Highlight } from './types.ts';

/** Zero-padded ids compare correctly as strings, which keeps sampling order stable. */
function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Uniform draw over an already-ordered list, with the tail clamped so no candidate is unreachable. */
function pickUniform(candidates: Highlight[], rng: () => number): Highlight | null {
    if (candidates.length === 0) {
        return null;
    }
    const raw = Math.floor(rng() * candidates.length);
    const index = Math.min(Math.max(raw, 0), candidates.length - 1);
    return candidates[index] ?? null;
}

function selected(highlight: Highlight, reason: 'all' | 'book' | 'fallback', cycleReset = false): SelectionResult {
    return cycleReset
        ? { kind: 'selected', id: highlight.id, reason, cycleReset: true }
        : { kind: 'selected', id: highlight.id, reason };
}

function findCurrent(input: SelectionInput): Highlight | null {
    return input.currentId === null ? null : (input.highlights.find((item) => item.id === input.currentId) ?? null);
}

type CyclePool = {
    candidates: Highlight[];
    cycleReset: boolean;
};

/**
 * De-duplication happens before anything else. When every passage has been seen, a new cycle starts
 * rather than repeating the passage on screen.
 */
function buildCyclePool(pool: Highlight[], input: SelectionInput): CyclePool {
    const unseen = pool
        .filter((highlight) => highlight.id !== input.currentId && !input.seenInCycle.includes(highlight.id))
        .sort(byId);
    if (unseen.length > 0) {
        return { candidates: unseen, cycleReset: false };
    }

    const rest = pool.filter((highlight) => highlight.id !== input.currentId).sort(byId);
    const recent = new Set(input.historyIds.slice(-3).filter((id) => id !== input.currentId));
    const withoutRecent = rest.filter((highlight) => !recent.has(highlight.id));
    // If every remaining passage is recent, the exclusion is relaxed back, earliest first.
    return { candidates: withoutRecent.length > 0 ? withoutRecent : rest, cycleReset: true };
}

/** Book-level tiers: a new book for the session, then a different book, then anything left. */
function buildTiers(candidates: Highlight[], current: Highlight | null, input: SelectionInput): Highlight[][] {
    if (current === null) {
        return [candidates];
    }
    const booksSeenThisSession = new Set<string>();
    for (const id of input.historyIds) {
        const entry = input.highlights.find((item) => item.id === id);
        if (entry !== undefined) {
            booksSeenThisSession.add(entry.bookId);
        }
    }
    const otherBook = candidates.filter((highlight) => highlight.bookId !== current.bookId);
    const freshBook = otherBook.filter((highlight) => !booksSeenThisSession.has(highlight.bookId));
    return [freshBook, otherBook];
}

function firstNonEmpty(tiers: Highlight[][], fallback: Highlight[]): Highlight[] {
    for (const tier of tiers) {
        if (tier.length > 0) {
            return tier;
        }
    }
    return fallback;
}

export function selectNext(input: SelectionInput): SelectionResult {
    const current = findCurrent(input);

    if (input.scope.kind === 'book') {
        const { bookId } = input.scope;
        const inBook = input.highlights.filter((highlight) => highlight.bookId === bookId);
        if (inBook.length === 0) {
            return { kind: 'empty' };
        }
        const unseenInBook = inBook
            .filter((highlight) => highlight.id !== input.currentId && !input.seenInCycle.includes(highlight.id))
            .sort(byId);
        if (unseenInBook.length === 0) {
            // No implicit cycle reset and no substitute from another book.
            return { kind: 'exhausted-book' };
        }
        const picked = pickUniform(unseenInBook, input.rng);
        return picked === null ? { kind: 'empty' } : selected(picked, 'book');
    }

    const pool = input.highlights;
    if (pool.length === 0) {
        return { kind: 'empty' };
    }
    if (pool.length === 1) {
        const only = pool[0];
        if (only === undefined) {
            return { kind: 'empty' };
        }
        return only.id === input.currentId ? { kind: 'only-current' } : selected(only, 'all');
    }

    const { candidates, cycleReset } = buildCyclePool(pool, input);
    if (candidates.length === 0) {
        return { kind: 'only-current' };
    }

    const tier = firstNonEmpty(buildTiers(candidates, current, input), candidates);
    const picked = pickUniform(tier, input.rng);
    return picked === null ? { kind: 'empty' } : selected(picked, 'all', cycleReset);
}

export const selectNextQuote: Selector = selectNext;
