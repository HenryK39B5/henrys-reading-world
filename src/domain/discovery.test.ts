import { describe, expect, it } from 'vitest';
import { selectNext, selectOpening } from './discovery.ts';
import { lengthBand } from './length.ts';
import { advanceCycle, EMPTY_CYCLE, type SelectedPassage, type SelectionInput, type SelectionScope } from './selection.ts';
import type { Book, Highlight, LengthBand } from './types.ts';

/**
 * Fair Discovery Engine properties (docs/11 §4.3).
 *
 * The engine is checked by deterministic walks over synthetic libraries, not by probabilistic
 * assertions: a fixed RNG plus a fixed input must always produce the same draws, so fairness can be
 * proven exactly instead of "usually".
 *
 * Real passage text never appears here.
 */
const READABLE = '这是一段长度适中的划线，用于验证长度规则。';
const LONG = '长'.repeat(200);
const SHORT = '短'.repeat(10);

function makeBook(id: string, themeIds: string[] = ['t-001']): Book {
    return { id, title: `book ${id}`, author: 'author', themeIds };
}

function passage(bookId: string, index: number, text: string = READABLE): Highlight {
    return { id: `${bookId}-h-${String(index).padStart(4, '0')}`, bookId, text, year: 2025 };
}

function countPassages(count: number, bookId: string, text: string = READABLE): Highlight[] {
    return Array.from({ length: count }, (_, index) => passage(bookId, index + 1, text));
}

/** Deterministic pseudo-random sequence; repeatable without shipping a randomness library. */
function seededRng(values: number[]): () => number {
    let index = 0;
    return () => {
        const value = values[index % values.length] ?? 0;
        index += 1;
        return value;
    };
}

function input(overrides: Partial<SelectionInput> = {}): SelectionInput {
    return {
        books: [],
        highlights: [],
        currentId: null,
        currentBookId: null,
        scope: { kind: 'all' },
        cycle: EMPTY_CYCLE,
        currentBand: null,
        recentIds: [],
        rng: () => 0,
        ...overrides,
    };
}

/**
 * Walks the engine the way the session does: each draw feeds the next one's cycle, current passage and
 * recent ids. Cycle bookkeeping is the same shared helper the reducer uses.
 */
function walk(
    books: Book[],
    highlights: Highlight[],
    steps: number,
    options: { scope?: SelectionScope; rng?: () => number } = {},
): SelectedPassage[] {
    const scope: SelectionScope = options.scope ?? { kind: 'all' };
    const rng = options.rng ?? (() => 0.5);
    const texts = new Map(highlights.map((highlight) => [highlight.id, highlight.text]));
    const results: SelectedPassage[] = [];
    let cycle = EMPTY_CYCLE;
    let currentId: string | null = null;
    let currentBookId: string | null = null;
    let currentBand: LengthBand | null = null;
    const history: string[] = [];

    for (let step = 0; step < steps; step += 1) {
        const result = selectNext({
            books,
            highlights,
            currentId,
            currentBookId,
            scope,
            cycle,
            currentBand,
            recentIds: history.slice(-3).filter((id) => id !== currentId),
            rng,
        });
        if (result.kind !== 'selected') {
            break;
        }
        cycle = advanceCycle(cycle, result);
        history.push(result.id);
        currentId = result.id;
        currentBookId = result.bookId;
        currentBand = lengthBand(texts.get(result.id) ?? '');
        results.push(result);
    }
    return results;
}

describe('dead ends are reported, never faked', () => {
    it('returns empty for an empty library', () => {
        expect(selectNext(input()).kind).toBe('empty');
    });

    it('returns empty for a shelf with no books at all', () => {
        const books = [makeBook('b-001', ['t-001'])];
        const highlights = [passage('b-001', 1)];
        expect(selectNext(input({ books, highlights, scope: { kind: 'theme', themeId: 't-404' } }))).toEqual({
            kind: 'empty',
        });
    });

    it('returns empty for a book that holds no passage', () => {
        const books = [makeBook('b-001')];
        expect(selectNext(input({ books, highlights: [], scope: { kind: 'book', bookId: 'b-001' } }))).toEqual({
            kind: 'empty',
        });
    });

    it('reports the single passage of a scope instead of looping on it', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1)];
        const result = selectNext(input({ books, highlights, currentId: highlights[0]?.id ?? null, currentBookId: 'b-001' }));
        expect(result.kind).toBe('only-current');
    });

    it('reports an exhausted book rather than showing the same passage twice', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1), passage('b-001', 2)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0002',
                currentBookId: 'b-001',
                scope: { kind: 'book', bookId: 'b-001' },
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001', 'b-001-h-0002'] },
            }),
        );
        expect(result).toEqual({ kind: 'exhausted-book' });
    });

    it('treats a one-passage book in a transient move as exhausted, not as a repeat', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                scope: { kind: 'book', bookId: 'b-001' },
            }),
        );
        expect(result.kind).toBe('exhausted-book');
    });
});

describe('book-level fairness: passage count must not matter', () => {
    it('draws every book of a round once, however small it is', () => {
        // The 1-passage book and the 200-passage book are both reached inside the same round: book size
        // buys no extra draws (the old passage-weighted selector gave the 200 book ~100× the chance).
        const books = [makeBook('b-200'), makeBook('b-060'), makeBook('b-008'), makeBook('b-002'), makeBook('b-001')];
        const highlights = [
            ...countPassages(200, 'b-200'),
            ...countPassages(60, 'b-060'),
            ...countPassages(8, 'b-008'),
            ...countPassages(2, 'b-002'),
            ...countPassages(1, 'b-001'),
        ];

        const drawn = walk(books, highlights, 5, { rng: () => 0.5 });
        expect(drawn).toHaveLength(5);
        expect(new Set(drawn.map((step) => step.bookId)).size).toBe(5);
    });

    it('alternates a 200-passage book and a 2-passage book while both have unseen material', () => {
        const books = [makeBook('b-big'), makeBook('b-small')];
        const highlights = [...countPassages(200, 'b-big'), ...countPassages(2, 'b-small')];

        const drawn = walk(books, highlights, 4, { rng: () => 0.5 });
        // The small book holds only two passages, so it can be drawn at most twice; those two draws come
        // first instead of the big book taking the whole session.
        expect(drawn.filter((step) => step.bookId === 'b-small')).toHaveLength(2);
        expect(drawn.filter((step) => step.bookId === 'b-big')).toHaveLength(2);
        for (let index = 1; index < drawn.length; index += 1) {
            expect(drawn[index]?.bookId).not.toBe(drawn[index - 1]?.bookId);
        }
        expect(new Set(drawn.map((step) => step.id)).size).toBe(4);
    });

    it('keeps feeding unseen material instead of repeating a small book', () => {
        const books = [makeBook('b-big'), makeBook('b-small')];
        const highlights = [...countPassages(200, 'b-big'), ...countPassages(2, 'b-small')];

        const drawn = walk(books, highlights, 8, { rng: () => 0.5 });
        // The small book shows both of its passages exactly once, and every draw is a new passage: the
        // engine never pads the round by repeating a book it has already emptied.
        expect(drawn.filter((step) => step.bookId === 'b-small')).toHaveLength(2);
        expect(new Set(drawn.map((step) => step.id)).size).toBe(8);
    });

    it('never circles back to the same book while another book has unseen material', () => {
        const books = [makeBook('b-200'), makeBook('b-060')];
        const highlights = [...countPassages(200, 'b-200'), ...countPassages(60, 'b-060')];
        const drawn = walk(books, highlights, 12, { rng: () => 0.5 });

        expect(drawn).toHaveLength(12);
        for (let index = 1; index < drawn.length; index += 1) {
            expect(drawn[index]?.bookId).not.toBe(drawn[index - 1]?.bookId);
        }
        expect(new Set(drawn.map((step) => step.id)).size).toBe(12);
    });

    it('splits the opening evenly across books regardless of their size', () => {
        const books = [makeBook('b-big'), makeBook('b-small')];
        const highlights = [...countPassages(1000, 'b-big'), ...countPassages(1, 'b-small')];

        const counts = new Map<string, number>();
        for (const value of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
            const result = selectOpening(books, highlights, () => value);
            expect(result.kind).toBe('selected');
            if (result.kind === 'selected') {
                counts.set(result.bookId, (counts.get(result.bookId) ?? 0) + 1);
            }
        }
        // Ten evenly spaced RNG values, two books, 1000 vs 1 passages: five and five.
        expect(counts.get('b-big')).toBe(5);
        expect(counts.get('b-small')).toBe(5);
    });

    it('draws every eligible book once before any book is repeated', () => {
        const books = [makeBook('b-001'), makeBook('b-002'), makeBook('b-003')];
        const highlights = [...countPassages(5, 'b-001'), ...countPassages(3, 'b-002'), ...countPassages(40, 'b-003')];

        const drawn = walk(books, highlights, 3, { rng: () => 0.5 });
        expect(new Set(drawn.map((step) => step.bookId)).size).toBe(3);

        // The draw that has to reuse a book reports the restart so the cycle can be rebuilt.
        const afterCycle = selectNext(
            input({
                books,
                highlights,
                currentId: drawn[2]?.id ?? null,
                currentBookId: drawn[2]?.bookId ?? null,
                cycle: { bookIds: ['b-001', 'b-002', 'b-003'], highlightIds: drawn.map((step) => step.id) },
                rng: () => 0.5,
            }),
        );
        expect(afterCycle.kind).toBe('selected');
        if (afterCycle.kind === 'selected') {
            expect(afterCycle.bookCycleReset).toBe(true);
        }
    });

    it('does not mark a cycle restart while fresh books remain', () => {
        const books = [makeBook('b-001'), makeBook('b-002')];
        const highlights = [...countPassages(3, 'b-001'), ...countPassages(3, 'b-002')];
        const drawn = walk(books, highlights, 1, { rng: () => 0.5 });
        expect(drawn[0]?.bookCycleReset).toBeUndefined();
    });
});

describe('exposure cycles', () => {
    it('never repeats a passage while the scope still has unseen material', () => {
        const books = [makeBook('b-001'), makeBook('b-002'), makeBook('b-003')];
        const highlights = [...countPassages(4, 'b-001'), ...countPassages(3, 'b-002'), ...countPassages(2, 'b-003')];

        const drawn = walk(books, highlights, 9, { rng: () => 0.5 });
        expect(drawn).toHaveLength(9);
        expect(new Set(drawn.map((step) => step.id)).size).toBe(9);
    });

    it('restarts the passage cycle when the scope has nothing unseen left', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1), passage('b-001', 2)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001', 'b-001-h-0002'] },
                rng: () => 0.5,
            }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.cycleReset).toBe(true);
            expect(result.id).not.toBe('b-001-h-0001');
        }
    });

    it('prefers a passage other than the one just before, when the library is tiny', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1), passage('b-001', 2)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001', 'b-001-h-0002'] },
                recentIds: ['b-001-h-0002'],
                rng: () => 0.5,
            }),
        );
        // Nothing unseen and the only other passage is recent, so the exclusion relaxes instead of
        // deadlocking: the visitor still gets a passage back.
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('b-001-h-0002');
            expect(result.cycleReset).toBe(true);
        }
    });

    it('keeps the book on screen out of the draw while another book can serve', () => {
        const books = [makeBook('b-001'), makeBook('b-002')];
        const highlights = [passage('b-001', 1), passage('b-002', 1)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001'] },
                rng: () => 0,
            }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.bookId).toBe('b-002');
        }
    });

    it('stays inside the book on screen when it is the only source of new passages', () => {
        const books = [makeBook('b-001'), makeBook('b-002')];
        const highlights = [...countPassages(4, 'b-001'), ...countPassages(1, 'b-002')];
        const cycle = { bookIds: ['b-001', 'b-002'], highlightIds: ['b-002-h-0001', 'b-001-h-0001'] };
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                cycle,
                rng: () => 0.5,
            }),
        );
        // b-002 is empty and b-001 has unseen passages: continuing in the book on screen beats showing a
        // passage the visitor has already read.
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.bookId).toBe('b-001');
            expect(result.id).not.toBe('b-001-h-0001');
        }
    });
});

describe('theme scope draws from the shelf, not from the sentence', () => {
    const books = [makeBook('b-001', ['t-001']), makeBook('b-002', ['t-002']), makeBook('b-003', ['t-001', 't-002'])];
    const highlights = [...countPassages(3, 'b-001'), ...countPassages(3, 'b-002'), ...countPassages(3, 'b-003')];

    it('only draws books filed on that shelf, across a full cycle', () => {
        const shelf = new Set(['b-001', 'b-003']);
        const drawn = walk(books, highlights, 9, { scope: { kind: 'theme', themeId: 't-001' }, rng: () => 0.5 });
        expect(drawn).toHaveLength(9);
        for (const step of drawn) {
            expect(shelf.has(step.bookId)).toBe(true);
        }
        // Both books on the shelf are reachable, and the off-shelf book never appears.
        expect(new Set(drawn.map((step) => step.bookId))).toEqual(shelf);
    });

    it('labels the draw as a theme draw and keys it to the shelf cycle', () => {
        const result = selectNext(
            input({ books, highlights, scope: { kind: 'theme', themeId: 't-002' }, rng: () => 0.5 }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.reason).toBe('theme');
            expect(result.scopeKey).toBe('theme:t-002');
        }
    });

    it('shares a book between two shelves without leaking cycles', () => {
        const shared = new Set(['b-002', 'b-003']);
        const other = walk(books, highlights, 6, { scope: { kind: 'theme', themeId: 't-002' }, rng: () => 0.5 });
        for (const step of other) {
            expect(shared.has(step.bookId)).toBe(true);
        }
    });
});

describe('every draw is reproducible and side-effect free', () => {
    it('returns the same draw for the same rng sequence', () => {
        const books = [makeBook('b-001'), makeBook('b-002'), makeBook('b-003')];
        const highlights = [...countPassages(4, 'b-001'), ...countPassages(4, 'b-002'), ...countPassages(4, 'b-003')];
        const first = walk(books, highlights, 6, { rng: seededRng([0.7, 0.2, 0.9]) });
        const second = walk(books, highlights, 6, { rng: seededRng([0.7, 0.2, 0.9]) });
        expect(first).toEqual(second);
    });

    it('does not mutate the books, the highlights or the cycle it was given', () => {
        const books = [makeBook('b-001'), makeBook('b-002')];
        const highlights = [...countPassages(2, 'b-001'), ...countPassages(2, 'b-002')];
        const booksBefore = JSON.stringify(books);
        const highlightsBefore = JSON.stringify(highlights);
        const cycle = { bookIds: ['b-001'], highlightIds: ['b-001-h-0001'] };
        const cycleBefore = JSON.stringify(cycle);

        selectNext(input({ books, highlights, currentId: 'b-001-h-0001', currentBookId: 'b-001', cycle, rng: () => 0.5 }));

        expect(JSON.stringify(books)).toBe(booksBefore);
        expect(JSON.stringify(highlights)).toBe(highlightsBefore);
        expect(JSON.stringify(cycle)).toBe(cycleBefore);
    });
});

describe('mechanical length rule', () => {
    it('opens on a readable passage rather than a wall of text', () => {
        const books = [makeBook('b-001')];
        const highlights = [...countPassages(3, 'b-001', LONG), passage('b-001', 9, READABLE)];
        const result = selectOpening(books, highlights, () => 0.9);
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('b-001-h-0009');
        }
    });

    it('prefers a shorter book for the opening when a book has only long passages', () => {
        const books = [makeBook('b-long'), makeBook('b-mixed')];
        const highlights = [...countPassages(30, 'b-long', LONG), passage('b-mixed', 1, READABLE)];
        for (const value of [0, 0.3, 0.6, 0.99]) {
            const result = selectOpening(books, highlights, () => value);
            expect(result.kind).toBe('selected');
            if (result.kind === 'selected') {
                expect(result.bookId).toBe('b-mixed');
            }
        }
    });

    it('still opens when the whole library is long', () => {
        const books = [makeBook('b-001')];
        const highlights = countPassages(3, 'b-001', LONG);
        const result = selectOpening(books, highlights, () => 0.5);
        expect(result.kind).toBe('selected');
    });

    it('prefers a shorter passage after a long one on screen', () => {
        const books = [makeBook('b-001')];
        const highlights = [passage('b-001', 1, LONG), passage('b-001', 2, LONG), passage('b-001', 3, SHORT)];
        const drawn = walk(books, highlights, 2, { rng: () => 0.5 });

        // The opening has no readable passage to prefer, so it takes one of the long ones; the draw that
        // follows a long passage must prefer the short one.
        expect(drawn).toHaveLength(2);
        expect(lengthBand(highlights.find((item) => item.id === drawn[0]?.id)?.text ?? '')).toBe('long');
        expect(drawn[1]?.id).toBe('b-001-h-0003');
    });

    it('lets exposure outrank length instead of hiding unseen material', () => {
        const books = [makeBook('b-001'), makeBook('b-002')];
        const highlights = [passage('b-001', 1, READABLE), ...countPassages(2, 'b-002', LONG)];
        const result = selectNext(
            input({
                books,
                highlights,
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                currentBand: 'short',
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001'] },
                rng: () => 0.5,
            }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.bookId).toBe('b-002');
        }
    });
});

describe('reason labels stay inside the agreed vocabulary', () => {
    it('labels all, theme and book draws distinctly', () => {
        const books = [makeBook('b-001', ['t-001'])];
        const highlights = [passage('b-001', 1), passage('b-001', 2)];
        const all = selectNext(input({ books, highlights, rng: () => 0 }));
        const theme = selectNext(input({ books, highlights, scope: { kind: 'theme', themeId: 't-001' }, rng: () => 0 }));
        const book = selectNext(
            input({
                books,
                highlights,
                scope: { kind: 'book', bookId: 'b-001' },
                currentId: 'b-001-h-0001',
                currentBookId: 'b-001',
                cycle: { bookIds: ['b-001'], highlightIds: ['b-001-h-0001'] },
                rng: () => 0,
            }),
        );
        expect(all.kind === 'selected' && all.reason).toBe('all');
        expect(theme.kind === 'selected' && theme.reason).toBe('theme');
        expect(book.kind === 'selected' && book.reason).toBe('book');
    });
});
