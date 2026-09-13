/**
 * Deterministic reference ordering.
 *
 * A dependency-free reference implementation of the `Selector` contract: it walks a scope in snapshot
 * order so tests and data checks can predict what comes next. The stage itself always uses the fair
 * discovery engine in `discovery.ts`.
 *
 * A reference walk is not a discovery draw, so it reports itself as an `all` / `book` draw rather than
 * inventing a fifth reason.
 */
import { scopeKeyOf, type SelectionInput, type SelectionResult } from './selection.ts';
import type { Highlight } from './types.ts';

export function selectSequential(input: SelectionInput): SelectionResult {
    const { scope } = input;
    const pool =
        scope.kind === 'all'
            ? input.highlights
            : scope.kind === 'theme'
              ? input.highlights.filter((highlight) => input.books.some((book) => book.id === highlight.bookId && book.themeIds.includes(scope.themeId)))
              : input.highlights.filter((highlight) => highlight.bookId === scope.bookId);
    const reason = scope.kind === 'book' ? 'book' : 'all';

    if (pool.length === 0) {
        return { kind: 'empty' };
    }

    const currentIndex = input.currentId === null ? -1 : pool.findIndex((item) => item.id === input.currentId);
    const scopeKey = scopeKeyOf(scope);
    if (currentIndex === -1) {
        const first: Highlight | undefined = pool[0];
        return first === undefined ? { kind: 'empty' } : { kind: 'selected', id: first.id, bookId: first.bookId, reason, scopeKey };
    }
    if (pool.length === 1) {
        return { kind: 'only-current' };
    }

    const next: Highlight | undefined = pool[(currentIndex + 1) % pool.length];
    return next === undefined ? { kind: 'empty' } : { kind: 'selected', id: next.id, bookId: next.bookId, reason, scopeKey };
}
