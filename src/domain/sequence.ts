/**
 * Slice 1 placeholder ordering.
 *
 * The encounter stage needs a way to move between passages before the curation engine exists.
 * This module walks the snapshot in order so that typography and transition feel can be verified
 * without an algorithm in the way. Slice 2 replaces it with `selectNext` from docs/04; the
 * reducer and UI stay unchanged because both implement the same `Selector` contract.
 */
import type { SelectionInput, SelectionResult } from './selection.ts';
import type { Highlight } from './types.ts';

export function selectSequential(input: SelectionInput): SelectionResult {
    const { scope } = input;
    const pool =
        scope.kind === 'global' ? input.highlights : input.highlights.filter((highlight) => highlight.bookId === scope.bookId);

    if (pool.length === 0) {
        return { kind: 'empty' };
    }

    const currentIndex = input.currentId === null ? -1 : pool.findIndex((item) => item.id === input.currentId);
    if (currentIndex === -1) {
        const first = pool[0];
        return first === undefined ? { kind: 'empty' } : { kind: 'selected', id: first.id, reason: 'sequential' };
    }
    if (pool.length === 1) {
        return { kind: 'only-current' };
    }

    const next = pool[(currentIndex + 1) % pool.length];
    return next === undefined ? { kind: 'empty' } : { kind: 'selected', id: next.id, reason: 'sequential' };
}

/** Deterministic first screen: prefer an independent passage that was marked as an opening candidate. */
export function selectInitialOpening(highlights: Highlight[]): string | null {
    const preferred =
        highlights.find((item) => item.openingCandidate && item.standaloneReadable) ??
        highlights.find((item) => item.openingCandidate) ??
        highlights[0];
    return preferred?.id ?? null;
}
