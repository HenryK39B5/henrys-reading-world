import { describe, expect, it } from 'vitest';
import { indexSnapshot } from './snapshot.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Snapshot } from './types.ts';
import { validateSnapshot } from './validate.ts';

/**
 * Structural fixtures only. They verify the contract; they are never shown in the UI and are
 * not presented as anyone's reading history. Real passage content lives in .private data.
 */
function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'public',
        owner: { displayName: 'Owner', siteTitle: 'Reading World' },
        books: [
            { id: 'b-001', title: 'Book One', author: 'Author One' },
            { id: 'b-002', title: 'Book Two', author: 'Author Two' },
        ],
        topics: [
            { id: 't-001', title: 'Topic One' },
            { id: 't-002', title: 'Topic Two' },
            { id: 't-003', title: 'Topic Three' },
        ],
        highlights: [
            {
                id: 'h-001',
                bookId: 'b-001',
                text: 'short passage',
                year: 2021,
                topicIds: ['t-001'],
                qualityScore: 4,
                standaloneReadable: true,
                pinned: false,
                openingCandidate: true,
                surpriseCandidate: false,
            },
            {
                id: 'h-002',
                bookId: 'b-002',
                text: 'second passage',
                year: 2024,
                topicIds: ['t-001', 't-002'],
                qualityScore: 3,
                standaloneReadable: true,
                pinned: false,
                openingCandidate: false,
                surpriseCandidate: true,
            },
        ],
        ...overrides,
    };
}

describe('validateSnapshot structure', () => {
    it('accepts a well-formed snapshot and reports coverage warnings', () => {
        const result = validateSnapshot(makeSnapshot(), { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.snapshot.books).toHaveLength(2);
        expect(result.warnings.some((warning) => warning.includes('30-50'))).toBe(true);
    });

    it('rejects unknown fields instead of silently ignoring them', () => {
        const raw = { ...makeSnapshot(), privacyRisk: 'high' };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('unsupported field');
        }
    });

    it('rejects unknown fields on a highlight', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], sourceBookmarkId: '123' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('sourceBookmarkId');
        }
    });

    it('rejects dangling references and duplicate ids', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            highlights: [
                { ...snapshot.highlights[0], topicIds: ['t-404'] },
                { ...snapshot.highlights[1], id: 'h-001', bookId: 'b-404' },
            ],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const joined = result.errors.join(' ');
            expect(joined).toContain('unknown topic t-404');
            expect(joined).toContain('unknown book b-404');
            expect(joined).toContain('duplicate id h-001');
        }
    });

    it('rejects a cover path that is remote or traverses directories', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [{ ...snapshot.books[0], coverPath: 'https://example.com/cover.jpg' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('covers/ asset path');
        }
    });

    it('rejects an out-of-range or future year', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], year: 2099 }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('between 1900 and 2025');
        }
    });

    it('rejects a visibility that does not match the expected integrity level', () => {
        const raw = makeSnapshot({ visibility: 'local-only' });
        const result = validateSnapshot(raw, { currentYear: 2025, expectedVisibility: 'public' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('expected "public"');
        }
    });

    it('rejects a wrong schema version', () => {
        const raw = { ...makeSnapshot(), schemaVersion: 2 };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
    });
});

describe('coverage warnings', () => {
    it('flags a topic that only connects one book and one passage', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], topicIds: ['t-003'] }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            const joined = result.warnings.join(' ');
            expect(joined).toContain('topic t-003 connects 1 highlight');
            expect(joined).toContain('topic t-003 connects 1 book');
        }
    });

    it('flags a missing length band and missing cross-year range', () => {
        const result = validateSnapshot(makeSnapshot(), { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            const joined = result.warnings.join(' ');
            expect(joined).toContain('no medium passage');
            expect(joined).toContain('no long passage');
        }
    });

    it('warns when a listed book has no highlights', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [...snapshot.books, { id: 'b-003', title: 'Book Three', author: 'Author Three' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.warnings.join(' ')).toContain('book b-003 has no highlights');
        }
    });
});

describe('indexSnapshot', () => {
    it('derives book, topic, year and band coverage without mutating the snapshot', () => {
        const snapshot = makeSnapshot();
        const before = JSON.stringify(snapshot);
        const index = indexSnapshot(snapshot);
        expect(JSON.stringify(snapshot)).toBe(before);
        expect(index.coverage.highlightCount).toBe(2);
        expect(index.coverage.bookCount).toBe(2);
        expect(index.coverage.topicCount).toBe(2);
        expect(index.years).toEqual([2021, 2024]);
        expect(index.highlightsByBook.get('b-001')).toHaveLength(1);
        expect(index.highlightsByTopic.get('t-001')).toHaveLength(2);
    });

    it('reports an empty snapshot honestly', () => {
        const index = indexSnapshot({ ...makeSnapshot(), books: [], topics: [], highlights: [] });
        expect(index.coverage.highlightCount).toBe(0);
        expect(index.booksInUse).toHaveLength(0);
        expect(index.years).toEqual([]);
    });
});
