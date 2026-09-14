import { describe, expect, it } from 'vitest';
import { indexSnapshot } from './snapshot.ts';
import {
    BOOK_BATCH_STEP,
    INITIAL_BOOK_BATCH,
    batchLabel,
    countThemeYear,
    expandCount,
    hasMore,
    passagesOfBook,
    unreachableHighlights,
    visibleCount,
} from './reading.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Book, type Highlight, type Snapshot } from './types.ts';

function book(id: string, themeIds: string[] = []): Book {
    return { id, title: `book ${id}`, author: 'author', themeIds };
}

function passage(id: string, bookId: string, year?: number): Highlight {
    return year === undefined ? { id, bookId, text: '一段划线' } : { id, bookId, text: '一段划线', year };
}

function snapshot(books: Book[], highlights: Highlight[]): Snapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'public',
        owner: { displayName: 'Henry', siteTitle: 'Henry' },
        themes: [],
        books,
        highlights,
    };
}

describe('batches stay bounded and honest', () => {
    it('never shows more than exists', () => {
        expect(visibleCount(INITIAL_BOOK_BATCH, 3)).toBe(3);
        expect(visibleCount(50, 130)).toBe(50);
        expect(visibleCount(-4, 130)).toBe(0);
    });

    it('walks a library from its first batch to the last item', () => {
        let loaded = INITIAL_BOOK_BATCH;
        const steps: number[] = [];
        while (hasMore(loaded, 130)) {
            loaded = expandCount(loaded, 130, BOOK_BATCH_STEP);
            steps.push(loaded);
        }
        // 12 → 32 → … → exactly 130, never past it.
        expect(steps[0]).toBe(32);
        expect(steps[steps.length - 1]).toBe(130);
        expect(hasMore(loaded, 130)).toBe(false);
    });

    it('describes the current batch without rounding', () => {
        expect(batchLabel(10, 253)).toBe('显示 10 / 253');
        expect(batchLabel(531, 531)).toBe('显示 531 / 531');
    });
});

describe('book passages', () => {
    const index = indexSnapshot(
        snapshot(
            [book('b-001'), book('b-002')],
            [passage('h-003', 'b-001', 2024), passage('h-001', 'b-001', 2025), passage('h-002', 'b-002')],
        ),
    );

    it('lists one book in stable id order, never in array order', () => {
        expect(passagesOfBook(index, 'b-001').map((item) => item.id)).toEqual(['h-001', 'h-003']);
    });

    it('returns nothing for a book the snapshot does not hold', () => {
        expect(passagesOfBook(index, 'b-404')).toEqual([]);
    });

    it('counts a shelf-year pair from real records only', () => {
        const withTheme = indexSnapshot(
            snapshot([book('b-001', ['t-001'])], [passage('h-001', 'b-001', 2024), passage('h-002', 'b-001', 2025)]),
        );
        expect(countThemeYear(withTheme, 't-001', 2024)).toBe(1);
        expect(countThemeYear(withTheme, 't-001', 2030)).toBe(0);
        expect(countThemeYear(withTheme, 't-404', 2024)).toBe(0);
    });
});

describe('every passage is reachable', () => {
    it('counts nothing unreachable when each book can be opened', () => {
        const index = indexSnapshot(
            snapshot([book('b-001'), book('b-002')], [passage('h-001', 'b-001'), passage('h-002', 'b-002')]),
        );
        expect(unreachableHighlights(index)).toEqual([]);
    });

    it('reports a passage whose book is missing instead of hiding it', () => {
        const index = indexSnapshot(snapshot([book('b-001')], [passage('h-001', 'b-001'), passage('h-002', 'b-404')]));
        expect(unreachableHighlights(index).map((item) => item.id)).toEqual(['h-002']);
    });
});
