import { describe, expect, it } from 'vitest';
import { selectNext, selectNextQuote } from './serendipity.ts';
import { selectInitialOpening } from './sequence.ts';
import type { Highlight } from './types.ts';
import type { SelectionInput } from './selection.ts';

/**
 * Discovery selector properties.
 *
 * docs/10 removed the curated Opening/Contrast/Surprise sequence and the editorial score, so these
 * tests pin the mechanical guarantees instead: de-duplication first, a different book from the one on
 * screen, books this session has not shown yet, even odds inside a tier, and honest dead ends.
 *
 * Real passage text never appears here.
 */
function highlight(id: string, bookId: string): Highlight {
    return { id, bookId, text: `passage ${id}`, year: 2025 };
}

/** Deterministic pseudo-random sequence: repeatable without shipping a randomness library. */
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
        highlights: [],
        currentId: null,
        historyIds: [],
        seenInCycle: [],
        scope: { kind: 'global' },
        rng: () => 0,
        ...overrides,
    };
}

const THREE_BOOKS: Highlight[] = [highlight('h-001', 'b-001'), highlight('h-002', 'b-002'), highlight('h-003', 'b-003')];

describe('dead ends are reported, never faked', () => {
    it('returns empty for an empty library', () => {
        expect(selectNext(input()).kind).toBe('empty');
    });

    it('returns only-current for a library with a single passage', () => {
        const only = [highlight('h-001', 'b-001')];
        expect(selectNext(input({ highlights: only, currentId: 'h-001' })).kind).toBe('only-current');
        expect(selectNext(input({ highlights: only, currentId: null }))).toEqual({
            kind: 'selected',
            id: 'h-001',
            reason: 'all',
        });
    });

    it('never returns the passage that is already on screen', () => {
        const result = selectNext(input({ highlights: THREE_BOOKS, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'] }));
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).not.toBe('h-001');
        }
    });
});

describe('de-duplication comes before everything else', () => {
    it('does not repeat a passage inside a cycle', () => {
        const result = selectNext(
            input({ highlights: THREE_BOOKS, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001', 'h-002'] }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-003', reason: 'all' });
    });

    it('starts a new cycle when everything has been seen and says so', () => {
        const result = selectNext(
            input({
                highlights: THREE_BOOKS,
                currentId: 'h-003',
                historyIds: ['h-001', 'h-002', 'h-003'],
                seenInCycle: ['h-001', 'h-002', 'h-003'],
            }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.cycleReset).toBe(true);
            expect(result.id).not.toBe('h-003');
        }
    });

    it('relaxes the recent-exclusion when the library is tiny, instead of deadlocking', () => {
        const tiny = [highlight('h-001', 'b-001'), highlight('h-002', 'b-002')];
        const result = selectNext(
            input({ highlights: tiny, currentId: 'h-001', historyIds: ['h-001', 'h-002'], seenInCycle: ['h-001', 'h-002'] }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-002', reason: 'all', cycleReset: true });
    });
});

describe('book variety', () => {
    it('prefers a different book from the one on screen when one exists', () => {
        const highlights = [highlight('h-001', 'b-001'), highlight('h-002', 'b-001'), highlight('h-003', 'b-002')];
        // rng 0 would land on the first candidate of the tier, which is inside b-001 if b-001 were offered.
        const result = selectNext(
            input({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], rng: () => 0 }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('h-003');
        }
    });

    it('prefers a book this session has not shown yet', () => {
        const highlights = [highlight('h-001', 'b-001'), highlight('h-002', 'b-002'), highlight('h-003', 'b-003')];
        const result = selectNext(
            input({ highlights, currentId: 'h-002', historyIds: ['h-001', 'h-002'], seenInCycle: ['h-001', 'h-002'] }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('h-003');
        }
    });

    it('falls back to another book once every book has been shown', () => {
        const highlights = [highlight('h-001', 'b-001'), highlight('h-002', 'b-002')];
        const result = selectNext(
            input({ highlights, currentId: 'h-001', historyIds: ['h-001', 'h-002'], seenInCycle: ['h-001', 'h-002'] }),
        );
        // Only h-002 remains, so it is offered again rather than pretending there is fresh material.
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('h-002');
            expect(result.cycleReset).toBe(true);
        }
    });
});

describe('even odds inside a tier', () => {
    it('spreads across the whole tier instead of always taking the first entry', () => {
        const highlights = THREE_BOOKS;
        const picked = new Set<string>();
        for (const rng of [() => 0, () => 0.34, () => 0.67, () => 0.999]) {
            const result = selectNext(input({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: [], rng }));
            if (result.kind === 'selected') {
                picked.add(result.id);
            }
        }
        expect(picked).toEqual(new Set(['h-002', 'h-003']));
    });

    it('is reproducible for a fixed rng and free of input mutation', () => {
        const highlights = THREE_BOOKS;
        const before = JSON.stringify(highlights);
        const first = selectNext(input({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: [], rng: seededRng([0.7, 0.2]) }));
        const second = selectNext(input({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: [], rng: seededRng([0.7, 0.2]) }));
        expect(first).toEqual(second);
        expect(JSON.stringify(highlights)).toBe(before);
    });

    /**
     * KNOWN LIMITATION, deliberately pinned: this selector still draws uniformly over passages, so a
     * book with 100 passages outweighs a book with 1. docs/11 V2-B replaces it with two-stage sampling
     * (choose a book, then a passage). When that lands, this test should fail and be rewritten.
     */
    it('still weights by passage count until V2-B introduces two-stage sampling', () => {
        const many = Array.from({ length: 100 }, (_, index) => highlight(`h-${String(index + 101).padStart(3, '0')}`, 'b-big'));
        const few = [highlight('h-001', 'b-small')];
        const highlights = [...few, ...many];
        let bigPicks = 0;
        for (let step = 0; step < 40; step += 1) {
            const current = step === 0 ? null : highlights.find((item) => item.bookId === 'b-small');
            const currentId = current === undefined || current === null ? null : current.id;
            const result = selectNext(
                input({
                    highlights,
                    currentId,
                    historyIds: currentId === null ? [] : [currentId],
                    seenInCycle: currentId === null ? [] : [currentId],
                    rng: () => 0.5,
                }),
            );
            if (result.kind === 'selected' && result.id !== 'h-001') {
                bigPicks += 1;
            }
        }
        expect(bigPicks).toBe(40);
    });
});

describe('book scope', () => {
    const highlights = [highlight('h-001', 'b-001'), highlight('h-002', 'b-001'), highlight('h-003', 'b-002')];

    it('never crosses into another book', () => {
        const result = selectNext(
            input({ highlights, currentId: 'h-001', seenInCycle: ['h-001'], scope: { kind: 'book', bookId: 'b-001' } }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-002', reason: 'book' });
    });

    it('reports exhaustion instead of resetting silently', () => {
        const result = selectNext(
            input({
                highlights,
                currentId: 'h-002',
                historyIds: ['h-001', 'h-002'],
                seenInCycle: ['h-001', 'h-002'],
                scope: { kind: 'book', bookId: 'b-001' },
            }),
        );
        expect(result.kind).toBe('exhausted-book');
    });

    it('reports an empty book rather than borrowing another one', () => {
        const result = selectNext(input({ highlights, currentId: 'h-001', scope: { kind: 'book', bookId: 'b-404' } }));
        expect(result.kind).toBe('empty');
    });
});

describe('first screen', () => {
    it('picks a readable-length passage deterministically, without an editorial flag', () => {
        const long: Highlight = { id: 'h-001', bookId: 'b-001', text: '很长的段落。'.repeat(60), year: 2025 };
        const readable: Highlight = { id: 'h-002', bookId: 'b-002', text: '这是一段长度适中的段落，用于验证首屏选取规则。', year: 2025 };
        expect(selectInitialOpening([long, readable])).toBe('h-002');
        expect(selectInitialOpening([long])).toBe('h-001');
        expect(selectInitialOpening([])).toBeNull();
    });
});

describe('selector contract', () => {
    it('exposes the same function under the stage-facing name', () => {
        expect(selectNextQuote).toBe(selectNext);
    });
});
