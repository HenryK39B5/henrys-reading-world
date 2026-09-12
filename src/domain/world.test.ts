import { describe, expect, it } from 'vitest';
import { indexSnapshot } from './snapshot.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Highlight, type Snapshot } from './types.ts';
import {
    filterBooksByYear,
    highlightsForBook,
    highlightsForTopic,
    orderByRecentHighlight,
    summarizeBooks,
    summarizeTopics,
    topicCountText,
    yearOptions,
    yearSpanText,
} from './world.ts';

/** Structural fixtures: they pin ordering and filtering, never real reading content. */
function highlight(id: string, bookId: string, year: number | undefined, topicIds: string[]): Highlight {
    const base: Highlight = {
        id,
        bookId,
        text: `passage ${id}`,
        topicIds,
        qualityScore: 3,
        standaloneReadable: true,
        pinned: false,
        openingCandidate: false,
        surpriseCandidate: false,
    };
    return year === undefined ? base : { ...base, year };
}

function snapshot(): Snapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'local-only',
        owner: { displayName: 'Owner', siteTitle: 'Reading World' },
        books: [
            { id: 'b-001', title: 'Book One', author: 'Author One' },
            { id: 'b-002', title: 'Book Two', author: 'Author Two' },
            { id: 'b-003', title: 'Book Three', author: 'Author Three' },
        ],
        topics: [
            { id: 't-001', title: 'Topic One' },
            { id: 't-002', title: 'Topic Two' },
        ],
        highlights: [
            highlight('h-001', 'b-001', 2024, ['t-001']),
            highlight('h-002', 'b-002', 2026, ['t-001', 't-002']),
            highlight('h-003', 'b-002', undefined, ['t-002']),
            highlight('h-004', 'b-003', 2025, []),
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
            highlights: [highlight('h-001', 'b-001', 2024, []), highlight('h-002', 'b-002', undefined, [])],
        });
        const ordered = orderByRecentHighlight(summarizeBooks(index)).map((entry) => entry.book.id);
        expect(ordered).toEqual(['b-001', 'b-002']);
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

describe('topics', () => {
    it('reports real counts and years per topic', () => {
        const topics = summarizeTopics(indexSnapshot(snapshot()));
        const first = topics.find((entry) => entry.topic.id === 't-001');
        expect(first?.highlightCount).toBe(2);
        expect(first?.bookCount).toBe(2);
        expect(first?.years).toEqual([2024, 2026]);
        expect(first === undefined ? '' : topicCountText(first)).toBe('2 处划线 · 2 本书');
    });

    it('leads with one passage per book so a topic is not a single book list', () => {
        const topics = summarizeTopics(indexSnapshot(snapshot()));
        const first = topics.find((entry) => entry.topic.id === 't-001');
        expect(first).toBeDefined();
        if (first === undefined) {
            return;
        }
        const leads = highlightsForTopic(first, 4).map((item) => item.bookId);
        expect(new Set(leads).size).toBe(leads.length);
        expect(leads).toEqual(['b-001', 'b-002']);
    });

    it('narrows a topic to one year and can legitimately be empty', () => {
        const index = indexSnapshot(snapshot());
        const in2024 = summarizeTopics(index, 2024).find((entry) => entry.topic.id === 't-002');
        expect(in2024?.highlightCount).toBe(0);
        expect(highlightsForTopic(in2024 ?? { leads: [] } as never, 4)).toEqual([]);
        expect(summarizeTopics(index, 2026).find((entry) => entry.topic.id === 't-001')?.highlightCount).toBe(1);
    });

    it('never drops a passage from the leads when a book repeats', () => {
        const index = indexSnapshot({
            ...snapshot(),
            topics: [{ id: 't-001', title: 'Topic One' }],
            highlights: [
                highlight('h-001', 'b-001', 2025, ['t-001']),
                highlight('h-002', 'b-001', 2025, ['t-001']),
                highlight('h-003', 'b-002', 2025, ['t-001']),
            ],
        });
        const topic = summarizeTopics(index).find((entry) => entry.topic.id === 't-001');
        expect(topic?.leads.map((item) => item.id)).toEqual(['h-001', 'h-003', 'h-002']);
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
