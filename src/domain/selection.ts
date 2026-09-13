/**
 * Draw contract shared by the fair discovery engine and the deterministic reference ordering.
 *
 * v2 dropped the editorial fields (quality, opening/surprise flags, per-passage topics). docs/10 §5
 * then made the browsing range explicit, so every draw now happens inside a named scope:
 *
 *   - `all`   — 随便看看: every book of the library;
 *   - `theme` — 正在逛某个主题书架: only books filed on that shelf;
 *   - `book`  — 再看一处: a transient action inside the book already on screen.
 *
 * A scope's cycle is stored under its own key, so one theme cannot consume another theme's cycle and
 * a temporary book move cannot disturb the persistent stage range.
 */
import type { Book, Highlight, LengthBand } from './types.ts';

/** Reason labels are for tests and diagnostics; they are never rendered to visitors. */
export type SelectionReason = 'all' | 'theme' | 'book' | 'fallback';

/** The persistent browsing range of the stage (docs/10 §5): 随便看看 or one theme shelf. */
export type StageScope = { kind: 'all' } | { kind: 'theme'; themeId: string };

/** A draw range: a persistent stage scope, or the transient in-book move. */
export type SelectionScope = StageScope | { kind: 'book'; bookId: string };

/** `all`, `theme:<id>` or `book:<id>` — one cycle is kept per key. */
export type CycleKey = string;

export type CycleState = {
    /** Books already drawn in this scope's current cycle. */
    bookIds: string[];
    /** Passages already shown in this scope's current cycle. */
    highlightIds: string[];
};

export const ALL_SCOPE: StageScope = { kind: 'all' };

/** Shared empty cycle; cycles are only ever replaced, never mutated in place. */
export const EMPTY_CYCLE: CycleState = { bookIds: [], highlightIds: [] };

export function scopeKeyOf(scope: SelectionScope): CycleKey {
    if (scope.kind === 'all') {
        return 'all';
    }
    if (scope.kind === 'theme') {
        return `theme:${scope.themeId}`;
    }
    return `book:${scope.bookId}`;
}

/** Key of the visit cycle of one book; it answers "what have I not read here since I arrived?". */
export function bookCycleKey(bookId: string): CycleKey {
    return `book:${bookId}`;
}

export function sameScope(left: StageScope, right: StageScope): boolean {
    return left.kind === 'all' ? right.kind === 'all' : right.kind === 'theme' && left.themeId === right.themeId;
}

/** True when a book may be drawn inside a scope. A shelf owns books (docs/10 §4). */
export function bookInScope(book: Book, scope: SelectionScope): boolean {
    if (scope.kind === 'all') {
        return true;
    }
    if (scope.kind === 'theme') {
        return book.themeIds.includes(scope.themeId);
    }
    return book.id === scope.bookId;
}

/**
 * Records a passage in a cycle.
 *
 * A reset flag starts a new round with this passage as its first entry; otherwise the passage is
 * appended once. Shared by the encounter reducer and by tests that walk hundreds of draws, so both
 * advance a cycle exactly the same way.
 */
export function withPassage(
    cycle: CycleState,
    passage: { id: string; bookId: string },
    reset: { cycleReset: boolean; bookCycleReset: boolean },
): CycleState {
    const highlightIds = reset.cycleReset
        ? [passage.id]
        : cycle.highlightIds.includes(passage.id)
          ? cycle.highlightIds
          : [...cycle.highlightIds, passage.id];
    const bookIds = reset.bookCycleReset
        ? [passage.bookId]
        : cycle.bookIds.includes(passage.bookId)
          ? cycle.bookIds
          : [...cycle.bookIds, passage.bookId];
    return { bookIds, highlightIds };
}

/** Cycle bookkeeping for a draw that came from a scope: honours the engine's own reset flags. */
export function advanceCycle(cycle: CycleState, choice: SelectedPassage): CycleState {
    return withPassage(cycle, choice, {
        cycleReset: choice.cycleReset === true,
        bookCycleReset: choice.bookCycleReset === true,
    });
}

/**
 * Input contract of every selector.
 *
 * There is deliberately no quality, representativeness or "is this Henry" field: the engine may only
 * weigh scope, exposure cycles and mechanical passage length.
 */
export type SelectionInput = {
    books: Book[];
    highlights: Highlight[];
    currentId: string | null;
    currentBookId: string | null;
    /** The scope's own cycle; the engine never sees another scope's state. */
    scope: SelectionScope;
    cycle: CycleState;
    /** Length band of the passage on screen. `null` only on the opening draw. */
    currentBand: LengthBand | null;
    /** The few passages just before this one; a repeat of those is the last resort. */
    recentIds: string[];
    /** Injected randomness: the same input and RNG always produce the same output. */
    rng: () => number;
};

export type SelectedPassage = {
    kind: 'selected';
    id: string;
    bookId: string;
    reason: SelectionReason;
    /** Which scope's cycle this draw belongs to. */
    scopeKey: CycleKey;
    /** The scope's passage cycle was full and restarts with this passage. */
    cycleReset?: boolean;
    /** The scope's book cycle was full and restarts with this book. */
    bookCycleReset?: boolean;
};

export type SelectionResult =
    | SelectedPassage
    /** The scope holds no passage at all. */
    | { kind: 'empty' }
    /** The scope's only passage is already on screen. */
    | { kind: 'only-current' }
    /** A transient in-book move found nothing new; the book is reported, not left. */
    | { kind: 'exhausted-book' };

export type Selector = (input: SelectionInput) => SelectionResult;

export function isSelected(result: SelectionResult): result is SelectedPassage {
    return result.kind === 'selected';
}
