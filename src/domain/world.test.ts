import { describe, expect, it } from 'vitest';
import { indexSnapshot } from './snapshot.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Highlight, type Snapshot } from './types.ts';
import {
    filterBooksByYear,
    highlightsForBook,
    highlightsForTheme,
    orderByRecentHighlight,
    summarizeBooks,
    summarizeThemes,
    themeCountText,
    yearOptions,
    yearSpanText,
} from './world.ts';

/** Structural fixtures: they pin ordering and filtering, never real reading content. */
function highlight(id: string, bookId: string, year: number | undefined): Highlight {
    const base: Highlight = { id, bookId, text: `passage ${id}`, tagIds: [] };
    return year === undefined ? base : { ...base, year };
}

function snapshot(): Snapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'local-only',
        owner: { displayName: 'Owner', siteTitle: 'Reading World' },
        themes: [
            { id: 't-001', title: 'Theme One' },
            { id: 't-002', title: 'Theme Two' },
        ],
        tags: [],
        books: [
            { id: 'b-001', title: 'Book One', author: 'Author One', themeIds: ['t-001'] },
            { id: 'b-002', title: 'Book Two', author: 'Author Two', themeIds: ['t-001', 't-002'] },
            { id: 'b-003', title: 'Book Three', author: 'Author Three', themeIds: ['t-002'] },
            { id: 'b-004', title: 'Book Four', author: 'Author Four', themeIds: [] },
        ],
        highlights: [
            highlight('h-001', 'b-001', 2024),
            highlight('h-002', 'b-002', 2026),
            highlight('h-003', 'b-002', undefined),
            highlight('h-004', 'b-003', 2025),
        ],
    };
}

describe('book summaries', () => {
    it('lists only books that actually have passages, with their real years', () => {
        const entries = summarizeBooks(indexSnapshot(snapshot()));
        expect(entries.map((entry) => entry.book.id)).toEqual(['b-001', 'b-002', 'b-003']);
        const second = entries.find((entry) => entry.book.id === 'b-002');
        expect(second?.highlightCount).toBe(2);
        expect(second?.years).toEqual([2026]);
    });

    it('orders by most recent highlight year and puts missing years last', () => {
        const index = indexSnapshot({
            ...snapshot(),
            highlights: [highlight('h-001', 'b-001', 2024), highlight('h-002', 'b-002', undefined)],
        });
        const ordered = orderByRecentHighlight(summarizeBooks(index)).map((entry) => entry.book.id);
        expect(ordered).toEqual(['b-001', 'b-002']);
    });

    it('orders books of the same year by stable id, never by how many passages they hold', () => {
        const index = indexSnapshot({
            ...snapshot(),
            highlights: [
                // b-003 is the largest book of the year and b-001 the smallest: size must not rank them.
                ...Array.from({ length: 9 }, (_, step) => highlight(`h-9${String(step)}`, 'b-003', 2025)),
                highlight('h-001', 'b-001', 2025),
                highlight('h-002', 'b-002', 2025),
            ],
        });
        const entries = summarizeBooks(index);
        expect(entries.find((entry) => entry.book.id === 'b-003')?.highlightCount).toBe(9);
        expect(orderByRecentHighlight(entries).map((entry) => entry.book.id)).toEqual([
            'b-001',
            'b-002',
            'b-003',
        ]);
    });

    it('is a stable order: the same snapshot always lists the same books first', () => {
        const index = indexSnapshot({
            ...snapshot(),
            highlights: [
                highlight('h-001', 'b-001', 2025),
                highlight('h-002', 'b-002', 2025),
                highlight('h-003', 'b-003', 2025),
            ],
        });
        const first = orderByRecentHighlight(summarizeBooks(index)).map((entry) => entry.book.id);
        const again = orderByRecentHighlight([...summarizeBooks(index)].reverse()).map((entry) => entry.book.id);
        expect(again).toEqual(first);
    });

    it('filters books by year and never invents a substitute', () => {
        const entries = summarizeBooks(indexSnapshot(snapshot()));
        expect(filterBooksByYear(entries, 2025).map((entry) => entry.book.id)).toEqual(['b-003']);
        expect(filterBooksByYear(entries, 1999)).toEqual([]);
        expect(filterBooksByYear(entries, null)).toHaveLength(3);
    });

    it('returns a book analysis limited to the requested year', () => {
        const index = indexSnapshot(snapshot());
        expect(highlightsForBook(index, 'b-002')).toHaveLength(2);
        expect(highlightsForBook(index, 'b-002', 2026).map((item) => item.id)).toEqual(['h-002']);
        expect(highlightsForBook(index, 'b-002', 1999)).toEqual([]);
    });
});

describe('theme shelves', () => {
    it('reports the real counts of the books filed on a shelf', () => {
        const themes = summarizeThemes(indexSnapshot(snapshot()));
        const first = themes.find((entry) => entry.theme.id === 't-001');
        expect(first?.highlightCount).toBe(3);
        expect(first?.bookCount).toBe(2);
        expect(first?.years).toEqual([2024, 2026]);
        expect(first === undefined ? '' : themeCountText(first)).toBe('3 处划线 · 2 本书');
    });

    it('leads with one passage per book before any book repeats', () => {
        const index = indexSnapshot({
            ...snapshot(),
            themes: [{ id: 't-001', title: 'Theme One' }],
            books: [
                { id: 'b-001', title: 'Book One', author: 'Author One', themeIds: ['t-001'] },
                { id: 'b-002', title: 'Book Two', author: 'Author Two', themeIds: ['t-001'] },
                { id: 'b-003', title: 'Book Three', author: 'Author Three', themeIds: ['t-001'] },
            ],
            highlights: [
                highlight('h-001', 'b-001', 2025),
                highlight('h-002', 'b-001', 2025),
                highlight('h-003', 'b-002', 2025),
                highlight('h-004', 'b-003', 2025),
            ],
        });
        const theme = summarizeThemes(index).find((entry) => entry.theme.id === 't-001');
        expect(theme).toBeDefined();
        if (theme === undefined) {
            return;
        }
        const leads = highlightsForTheme(theme, 4).map((item) => item.bookId);
        // Every book is represented before the second passage of any book appears.
        expect(leads.slice(0, 3)).toEqual(['b-001', 'b-002', 'b-003']);
        expect(leads).toHaveLength(4);
        expect(leads[3]).toBe('b-001');
    });

    it('never drops a passage from the leads when a book repeats', () => {
        const index = indexSnapshot({
            ...snapshot(),
            themes: [{ id: 't-001', title: 'Theme One' }],
            books: [
                { id: 'b-001', title: 'Book One', author: 'Author One', themeIds: ['t-001'] },
                { id: 'b-002', title: 'Book Two', author: 'Author Two', themeIds: ['t-001'] },
            ],
            highlights: [highlight('h-001', 'b-001', 2025), highlight('h-002', 'b-001', 2025), highlight('h-003', 'b-002', 2025)],
        });
        const theme = summarizeThemes(index).find((entry) => entry.theme.id === 't-001');
        expect(theme?.leads.map((item) => item.id)).toEqual(['h-001', 'h-003', 'h-002']);
    });

    it('narrows a shelf to one year and can legitimately be empty', () => {
        const index = indexSnapshot(snapshot());
        const in2024 = summarizeThemes(index, 2024).find((entry) => entry.theme.id === 't-002');
        expect(in2024?.highlightCount).toBe(0);
        expect(highlightsForTheme(in2024 ?? ({ leads: [] } as never), 4)).toEqual([]);
        expect(summarizeThemes(index, 2026).find((entry) => entry.theme.id === 't-001')?.highlightCount).toBe(1);
    });

    it('drops a shelf that no book on the page carries', () => {
        const index = indexSnapshot({ ...snapshot(), themes: [...snapshot().themes, { id: 't-003', title: 'Unused' }] });
        expect(index.themesInUse.map((theme) => theme.id)).toEqual(['t-001', 't-002']);
        expect(summarizeThemes(index).map((entry) => entry.theme.id)).toEqual(['t-001', 't-002']);
    });
});

describe('years and about copy', () => {
    it('offers only real years, newest first', () => {
        expect(yearOptions(indexSnapshot(snapshot()))).toEqual([2026, 2025, 2024]);
    });

    it('describes the real span without claiming a platform total', () => {
        const index = indexSnapshot(snapshot());
        expect(yearSpanText(index)).toBe('2024–2026 年');
        expect(yearSpanText(indexSnapshot({ ...snapshot(), highlights: [] }))).toBeNull();
    });
});
