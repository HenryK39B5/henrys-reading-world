/**
 * Deterministic reference ordering.
 *
 * Kept as a dependency-free reference implementation: it documents the sequence a snapshot is
 * authored in and is used by tests that need a predictable walk of the data. The stage itself uses
 * the discovery selector in `serendipity.ts`, because both implement the same `Selector` contract.
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

/**
 * Deterministic first screen.
 *
 * v1 picked a passage flagged as an opening candidate, i.e. a curated first impression. That flag no
 * longer exists: the first passage is merely one of the library, chosen for a readable length so the
 * opening screen is not a 400-character wall. V2-B replaces it with the fair engine's first draw.
 */
export function selectInitialOpening(highlights: Highlight[]): string | null {
    const preferred = highlights.find((item) => item.text.replace(/\s/gu, '').length >= 20 && item.text.replace(/\s/gu, '').length <= 120);
    const chosen = preferred ?? highlights[0];
    return chosen?.id ?? null;
}
