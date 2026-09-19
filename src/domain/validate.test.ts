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
        themes: [
            { id: 't-001', title: 'Theme One' },
            { id: 't-002', title: 'Theme Two' },
            { id: 't-003', title: 'Theme Three' },
        ],
        tags: [
            { id: 'tag-001', title: '风险', description: '可能损失与结果波动。' },
            { id: 'tag-002', title: '选择', description: '在多个方向之间作出决定。' },
        ],
        books: [
            { id: 'b-001', title: 'Book One', author: 'Author One', themeIds: ['t-001'] },
            { id: 'b-002', title: 'Book Two', author: 'Author Two', themeIds: ['t-001', 't-002'] },
        ],
        highlights: [
            { id: 'h-001', bookId: 'b-001', text: 'short passage', year: 2021, tagIds: ['tag-001'] },
            { id: 'h-002', bookId: 'b-002', text: 'second passage', year: 2024, tagIds: ['tag-001', 'tag-002'] },
        ],
        ...overrides,
    };
}

describe('validateSnapshot structure', () => {
    it('accepts a well-formed snapshot and keeps shelves on books', () => {
        const result = validateSnapshot(makeSnapshot(), { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.snapshot.books).toHaveLength(2);
        expect(result.snapshot.themes).toHaveLength(3);
        expect(result.snapshot.books[1]?.themeIds).toEqual(['t-001', 't-002']);
    });

    it('rejects unknown fields instead of silently ignoring them', () => {
        const raw = { ...makeSnapshot(), privacyRisk: 'high' };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('unsupported field');
        }
    });

    it('rejects raw capture fields on a highlight', () => {
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

    it('rejects superseded per-passage editorial fields while keeping V3 topic tags', () => {
        const snapshot = makeSnapshot();
        for (const field of ['topicIds', 'qualityScore', 'openingCandidate', 'surpriseCandidate', 'standaloneReadable', 'pinned']) {
            const raw = {
                ...snapshot,
                highlights: [{ ...snapshot.highlights[0], [field]: field === 'topicIds' ? ['t-001'] : true }],
            };
            const result = validateSnapshot(raw, { currentYear: 2025 });
            expect(result.ok, `highlight field ${field} must be rejected`).toBe(false);
        }
    });

    it('keeps Topic Tags separate from Book Themes and rejects dangling, duplicated or unordered tag references', () => {
        const snapshot = makeSnapshot();
        const dangling = validateSnapshot({
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], tagIds: ['tag-404'] }],
        }, { currentYear: 2025 });
        expect(dangling.ok).toBe(false);
        if (!dangling.ok) {
            expect(dangling.errors.join(' ')).toContain('unknown topic tag tag-404');
        }

        const duplicated = validateSnapshot({
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], tagIds: ['tag-001', 'tag-001'] }],
        }, { currentYear: 2025 });
        expect(duplicated.ok).toBe(false);

        const unordered = validateSnapshot({
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], tagIds: ['tag-002', 'tag-001'] }],
        }, { currentYear: 2025 });
        expect(unordered.ok).toBe(false);
        if (!unordered.ok) {
            expect(unordered.errors.join(' ')).toContain('snapshot tag order');
        }
    });

    it('rejects private tag-production fields from the consumer snapshot', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            tags: [{ ...snapshot.tags[0], confidence: 'high', rationale: 'private' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('confidence');
            expect(result.errors.join(' ')).toContain('rationale');
        }
    });

    it('allows an explicit empty tagIds array during the Batch 4 pilot, but never a missing one', () => {
        const snapshot = makeSnapshot();
        const pilot = validateSnapshot({
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], tagIds: [] }],
        }, { currentYear: 2025 });
        expect(pilot.ok).toBe(true);
        if (pilot.ok) {
            expect(pilot.warnings.join(' ')).toContain('no reviewed topic tag');
        }

        const withoutTags: Record<string, unknown> = { ...snapshot.highlights[0] };
        delete withoutTags['tagIds'];
        const missing = validateSnapshot({ ...snapshot, highlights: [withoutTags] }, { currentYear: 2025 });
        expect(missing.ok).toBe(false);
    });

    it('rejects a book with more than one primary plus two secondary shelves', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [{ ...snapshot.books[0], themeIds: ['t-001', 't-002', 't-003', 't-004'] }],
            themes: [...snapshot.themes, { id: 't-004', title: 'Theme Four' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('at most 3');
        }
    });

    it('rejects dangling references and duplicate ids', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [{ ...snapshot.books[0], themeIds: ['t-404'] }],
            highlights: [{ ...snapshot.highlights[0], id: 'h-001', bookId: 'b-404' }, { ...snapshot.highlights[1], id: 'h-001' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const joined = result.errors.join(' ');
            expect(joined).toContain('unknown theme t-404');
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

    it('rejects local-only cover art in a public snapshot', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [{ ...snapshot.books[0], coverPath: 'local-covers/p001.jpg' }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025, expectedVisibility: 'public' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('only valid in a local-only snapshot');
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

    it('rejects the superseded v1 schema version', () => {
        const raw = { ...makeSnapshot(), schemaVersion: 1 };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(false);
    });

    it('accepts the intentionally empty public snapshot without warnings', () => {
        const raw: Snapshot = {
            schemaVersion: SNAPSHOT_SCHEMA_VERSION,
            visibility: 'public',
            owner: { displayName: 'Owner', siteTitle: 'Reading World' },
            themes: [],
            tags: [],
            books: [],
            highlights: [],
        };
        const result = validateSnapshot(raw, { currentYear: 2025, expectedVisibility: 'public' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.warnings).toEqual([]);
        }
    });
});

describe('coverage warnings', () => {
    it('flags a shelf that carries fewer than two books', () => {
        const result = validateSnapshot(makeSnapshot(), { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            const joined = result.warnings.join(' ');
            expect(joined).toContain('theme t-002 connects 1 book');
            expect(joined).toContain('theme t-003 has no book');
        }
    });

    it('flags a book with no shelf and a book with no passages', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            books: [
                { id: 'b-001', title: 'Book One', author: 'Author One', themeIds: [] },
                { id: 'b-002', title: 'Book Two', author: 'Author Two', themeIds: ['t-001'] },
                { id: 'b-003', title: 'Book Three', author: 'Author Three', themeIds: ['t-001'] },
            ],
            highlights: [
                { id: 'h-001', bookId: 'b-002', text: 'short passage', year: 2021, tagIds: [] },
                { id: 'h-002', bookId: 'b-003', text: 'second passage', year: 2024, tagIds: [] },
            ],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            const joined = result.warnings.join(' ');
            expect(joined).toContain('book b-001 has no highlights');
            expect(joined).toContain('1 book(s) have no theme shelf');
        }
    });

    it('flags a shelf count outside the broad browsing range', () => {
        const result = validateSnapshot(makeSnapshot(), { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.warnings.join(' ')).toContain('theme shelves; 8-15 are expected');
        }
    });

    it('flags a missing length band and a missing cross-year range', () => {
        const snapshot = makeSnapshot();
        const raw = {
            ...snapshot,
            highlights: [{ ...snapshot.highlights[0], year: 2024 }, { ...snapshot.highlights[1], year: 2024 }],
        };
        const result = validateSnapshot(raw, { currentYear: 2025 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            const joined = result.warnings.join(' ');
            expect(joined).toContain('no medium passage');
            expect(joined).toContain('1 distinct year(s)');
        }
    });
});

describe('indexSnapshot', () => {
    it('derives coverage from books and never mutates the snapshot', () => {
        const snapshot = makeSnapshot();
        const before = JSON.stringify(snapshot);
        const index = indexSnapshot(snapshot);
        expect(JSON.stringify(snapshot)).toBe(before);
        expect(index.coverage.highlightCount).toBe(2);
        expect(index.coverage.bookCount).toBe(2);
        expect(index.coverage.themeCount).toBe(2);
        expect(index.coverage.tagCount).toBe(2);
        expect(index.coverage.taggedHighlightCount).toBe(2);
        expect(index.years).toEqual([2021, 2024]);
        expect(index.highlightsByBook.get('b-001')).toHaveLength(1);
        // t-001 is carried by both books, so both passages are on that shelf.
        expect(index.highlightsByTheme.get('t-001')).toHaveLength(2);
        expect(index.highlightsByTheme.get('t-003')).toBeUndefined();
        expect(index.highlightsByTag.get('tag-001')).toHaveLength(2);
        expect(index.highlightsByTag.get('tag-002')).toHaveLength(1);
    });

    it('reports an empty snapshot honestly', () => {
        const index = indexSnapshot({ ...makeSnapshot(), themes: [], books: [], highlights: [] });
        expect(index.coverage.highlightCount).toBe(0);
        expect(index.booksInUse).toHaveLength(0);
        expect(index.years).toEqual([]);
    });
});
