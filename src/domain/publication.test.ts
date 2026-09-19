import { describe, expect, it } from 'vitest';
import {
    EMPTY_DECISION,
    LONG_PASSAGE,
    PUBLICATION_SCHEMA_VERSION,
    PUBLICATION_TARGET,
    bookStats,
    excludedBooks,
    initialPublicationPolicy,
    projectPublicationPreview,
    publicationSummary,
    reconcilePublicationPolicy,
    releaseReadiness,
    selectedHighlights,
    setBookDecision,
    setBookNote,
    setReviewComplete,
    toggleCover,
    toggleHighlightExclusion,
    unreviewedBooks,
    validatePublicationPolicy,
    type PublicationPolicy,
} from './publication.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Highlight, type Snapshot } from './types.ts';

/**
 * The publication policy (docs/17 §4).
 *
 * The properties that matter are about *safety*, not convenience: nothing is published by default, a
 * published book brings exactly its non-excluded passages, an excluded book brings nothing at all, and a
 * preview can never call itself public. Placeholder passages only — a real one is never used in a unit
 * test.
 */
function highlight(id: string, bookId: string, text = '一段用于验证的占位文本。', year?: number): Highlight {
    return year === undefined ? { id, bookId, text, tagIds: [] } : { id, bookId, text, year, tagIds: [] };
}

const LONG = '长'.repeat(LONG_PASSAGE);

function snapshot(): Snapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: 'local-only',
        owner: { displayName: 'Henry', siteTitle: "Henry's Reading World" },
        themes: [
            { id: 't-001', title: '书架一' },
            { id: 't-002', title: '书架二' },
        ],
        tags: [],
        books: [
            { id: 'b-001', title: '书一', author: '作者一', themeIds: ['t-001'], coverPath: 'local-covers/one.jpg' },
            { id: 'b-002', title: '书二', author: '作者二', themeIds: ['t-002'] },
            { id: 'b-003', title: '书三', author: '作者三', themeIds: ['t-001'], coverPath: 'local-covers/three.jpg' },
        ],
        highlights: [
            highlight('h-001', 'b-001'),
            highlight('h-002', 'b-001', LONG, 2025),
            highlight('h-003', 'b-002'),
            highlight('h-004', 'b-003'),
        ],
    };
}

function publish(policy: PublicationPolicy, ids: string[]): PublicationPolicy {
    return ids.reduce((current, id) => setBookDecision(current, id, 'publish'), policy);
}

describe('nothing is published by default', () => {
    it('starts every book unreviewed with its cover allowed and nothing excluded', () => {
        const data = snapshot();
        const policy = initialPublicationPolicy(data);
        expect(policy.schemaVersion).toBe(PUBLICATION_SCHEMA_VERSION);
        expect(policy.target).toEqual(PUBLICATION_TARGET);
        expect(policy.reviewComplete).toBe(false);
        expect(Object.keys(policy.books).sort()).toEqual(['b-001', 'b-002', 'b-003']);
        for (const id of Object.keys(policy.books)) {
            expect(policy.books[id]).toEqual(EMPTY_DECISION);
        }
    });

    it('publishes nothing at all before anything is decided', () => {
        const data = snapshot();
        const policy = initialPublicationPolicy(data);
        const projection = projectPublicationPreview(policy, data);
        expect(projection.snapshot.books).toEqual([]);
        expect(projection.snapshot.highlights).toEqual([]);
        expect(projection.snapshot.themes).toEqual([]);
        expect(unreviewedBooks(policy, data)).toEqual(['b-001', 'b-002', 'b-003']);
    });

    it('treats a book missing from the policy as unreviewed, not as publishable', () => {
        const data = snapshot();
        const policy: PublicationPolicy = { ...initialPublicationPolicy(data), books: { 'b-001': { ...EMPTY_DECISION, decision: 'publish' } } };
        expect(unreviewedBooks(policy, data)).toEqual(['b-002', 'b-003']);
        expect(projectPublicationPreview(policy, data).snapshot.books.map((book) => book.id)).toEqual(['b-001']);
    });
});

describe('a published book brings exactly its passages', () => {
    it('brings every passage of the book when nothing is excluded', () => {
        const data = snapshot();
        const policy = publish(initialPublicationPolicy(data), ['b-001']);
        expect(selectedHighlights(policy, data, 'b-001').map((item) => item.id)).toEqual(['h-001', 'h-002']);
    });

    it('drops one excluded passage and keeps the rest of the book', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = toggleHighlightExclusion(policy, 'b-001', 'h-002');
        expect(selectedHighlights(policy, data, 'b-001').map((item) => item.id)).toEqual(['h-001']);
        expect(projectPublicationPreview(policy, data).snapshot.highlights.map((item) => item.id)).toEqual(['h-001']);
    });

    it('never publishes a passage of an excluded or undecided book', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = setBookDecision(policy, 'b-001', 'exclude');
        expect(selectedHighlights(policy, data, 'b-001')).toEqual([]);
        expect(projectPublicationPreview(policy, data).snapshot.highlights).toEqual([]);
        // The book is out of the projection entirely, not merely emptied.
        expect(projectPublicationPreview(policy, data).snapshot.books).toEqual([]);
    });

    it('keeps an exclusion when the book is excluded and published again', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = toggleHighlightExclusion(policy, 'b-001', 'h-001');
        policy = setBookDecision(policy, 'b-001', 'exclude');
        policy = setBookDecision(policy, 'b-001', 'publish');
        expect(selectedHighlights(policy, data, 'b-001').map((item) => item.id)).toEqual(['h-002']);
    });

    it('toggles an exclusion on and off without duplicating it', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = toggleHighlightExclusion(policy, 'b-001', 'h-002');
        policy = toggleHighlightExclusion(policy, 'b-001', 'h-001');
        policy = toggleHighlightExclusion(policy, 'b-001', 'h-002');
        expect(policy.books['b-001']?.excludedHighlightIds).toEqual(['h-001']);
    });

    it('reports a published book with nothing left as empty rather than publishing an empty room', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-002']);
        policy = toggleHighlightExclusion(policy, 'b-002', 'h-003');
        const summary = publicationSummary(policy, data);
        expect(summary.emptyBooks).toEqual(['b-002']);
        expect(releaseReadiness(policy, data).ready).toBe(false);
        expect(releaseReadiness(policy, data).reasons.join(' ')).toContain('b-002');
    });
});

describe('an excluded book disappears completely', () => {
    it('takes its title, cover, passages and shelf references with it', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001', 'b-003']);
        policy = setBookDecision(policy, 'b-003', 'exclude');
        const projection = projectPublicationPreview(policy, data);
        expect(projection.snapshot.books.map((book) => book.id)).toEqual(['b-001']);
        expect(projection.snapshot.highlights.every((item) => item.bookId !== 'b-003')).toBe(true);
        expect(JSON.stringify(projection.snapshot)).not.toContain('书三');
        // t-002 held only b-002, which is still unreviewed, so the shelf is gone too.
        expect(projection.snapshot.themes.map((theme) => theme.id)).toEqual(['t-001']);
        expect(projection.audit.themesDropped).toEqual(['t-002']);
        expect(projection.audit.excludedBooks).toEqual(['b-003']);
    });

    it('drops a cover that is not allowed out, while keeping the book', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        expect(projectPublicationPreview(policy, data).snapshot.books[0]?.coverPath).toBe('local-covers/one.jpg');
        policy = toggleCover(policy, 'b-001');
        const projection = projectPublicationPreview(policy, data);
        expect(projection.snapshot.books[0]?.coverPath).toBeUndefined();
        expect(projection.snapshot.books[0]?.title).toBe('书一');
    });
});

describe('a preview is never a publication', () => {
    it('stays local-only even when everything is approved', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001', 'b-002', 'b-003']);
        policy = setReviewComplete(policy, data, true).policy;
        expect(policy.reviewComplete).toBe(true);
        const projection = projectPublicationPreview(policy, data);
        expect(projection.snapshot.visibility).toBe('local-only');
    });

    it('keeps review notes out of the projected snapshot and the audit', () => {
        const data = snapshot();
        const published = publish(initialPublicationPolicy(data), ['b-001']);
        const policy = setBookNote(published, 'b-001', '这本先只公开一段。');
        const projection = projectPublicationPreview(policy, data);
        expect(JSON.stringify(projection)).not.toContain('这本先只公开一段');
        // The audit carries ids, counts and lengths — never the passages themselves.
        expect(JSON.stringify(projection.audit)).not.toContain('占位文本');
    });
});

describe('the review cannot be declared finished too early', () => {
    it('refuses to complete while any book is undecided and says how many', () => {
        const data = snapshot();
        const policy = publish(initialPublicationPolicy(data), ['b-001']);
        const result = setReviewComplete(policy, data, true);
        expect(result.refused).toContain('2');
        expect(result.policy.reviewComplete).toBe(false);
    });

    it('completes once every book has a real decision', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = setBookDecision(policy, 'b-002', 'exclude');
        policy = setBookDecision(policy, 'b-003', 'exclude');
        const result = setReviewComplete(policy, data, true);
        expect(result.refused).toBeNull();
        expect(result.policy.reviewComplete).toBe(true);
        expect(releaseReadiness(result.policy, data).ready).toBe(true);
    });

    it('can be switched back off', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001', 'b-002', 'b-003']);
        policy = setReviewComplete(policy, data, true).policy;
        policy = setReviewComplete(policy, data, false).policy;
        expect(policy.reviewComplete).toBe(false);
    });
});

describe('reconciliation is additive', () => {
    it('adds a new book as unreviewed and leaves existing decisions alone', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = setBookDecision(policy, 'b-002', 'exclude');
        const grown: Snapshot = {
            ...data,
            books: [...data.books, { id: 'b-004', title: '书四', author: '作者四', themeIds: ['t-001'] }],
        };
        const result = reconcilePublicationPolicy(policy, grown);
        expect(result.added).toEqual(['b-004']);
        expect(result.missing).toEqual([]);
        expect(result.policy.books['b-004']?.decision).toBe('unreviewed');
        expect(result.policy.books['b-001']?.decision).toBe('publish');
        expect(result.policy.books['b-002']?.decision).toBe('exclude');
    });

    it('keeps and reports a decision whose book is gone', () => {
        const data = snapshot();
        const policy = publish(initialPublicationPolicy(data), ['b-003']);
        const shrunk: Snapshot = { ...data, books: data.books.filter((book) => book.id !== 'b-003') };
        const result = reconcilePublicationPolicy(policy, shrunk);
        expect(result.missing).toEqual(['b-003']);
        expect(result.policy.books['b-003']?.decision).toBe('publish');
    });
});

describe('validation refuses an unsafe policy', () => {
    const data = snapshot();
    const good = initialPublicationPolicy(data);

    it('accepts a policy it produced itself', () => {
        expect(validatePublicationPolicy(JSON.parse(JSON.stringify(good)), data).ok).toBe(true);
    });

    it('rejects another project target, a wrong schema and unknown fields', () => {
        expect(validatePublicationPolicy({ ...good, target: { repository: 'other', basePath: '/' } }, data).ok).toBe(false);
        expect(validatePublicationPolicy({ ...good, schemaVersion: 99 }, data).ok).toBe(false);
        expect(validatePublicationPolicy({ ...good, extra: true }, data).ok).toBe(false);
        expect(
            validatePublicationPolicy({ ...good, books: { 'b-001': { ...EMPTY_DECISION, raw: 1 } } }, data).ok,
        ).toBe(false);
    });

    it('rejects an excluded id that belongs to another book or does not exist', () => {
        const foreign = {
            ...good,
            books: { ...good.books, 'b-001': { ...EMPTY_DECISION, excludedHighlightIds: ['h-003'] } },
        };
        const missing = {
            ...good,
            books: { ...good.books, 'b-001': { ...EMPTY_DECISION, excludedHighlightIds: ['h-404'] } },
        };
        const foreignResult = validatePublicationPolicy(foreign, data);
        expect(foreignResult.ok).toBe(false);
        if (!foreignResult.ok) {
            expect(foreignResult.errors.join(' ')).toContain('h-003');
        }
        expect(validatePublicationPolicy(missing, data).ok).toBe(false);
    });

    it('rejects a duplicate exclusion and a bad decision word', () => {
        const duplicated = {
            ...good,
            books: { ...good.books, 'b-001': { ...EMPTY_DECISION, excludedHighlightIds: ['h-001', 'h-001'] } },
        };
        expect(validatePublicationPolicy(duplicated, data).ok).toBe(false);
        expect(
            validatePublicationPolicy({ ...good, books: { 'b-001': { ...EMPTY_DECISION, decision: 'yes' } } }, data).ok,
        ).toBe(false);
    });

    it('rejects reviewComplete while books are undecided', () => {
        const premature = { ...good, reviewComplete: true };
        const result = validatePublicationPolicy(premature, data);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.join(' ')).toContain('unreviewed');
        }
    });

    it('never prints passage text in an error', () => {
        const result = validatePublicationPolicy({ schemaVersion: 'x' }, data);
        expect(JSON.stringify(result)).not.toContain('占位文本');
    });
});

describe('summary counts the real projection', () => {
    it('counts selected passages, characters, covers and long passages', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        policy = setBookDecision(policy, 'b-002', 'exclude');
        const summary = publicationSummary(policy, data);
        expect(summary.totalBooks).toBe(3);
        expect(summary.reviewed).toBe(2);
        expect(summary.published).toBe(1);
        expect(summary.excluded).toBe(1);
        expect(summary.unreviewed).toBe(1);
        expect(summary.selectedHighlights).toBe(2);
        expect(summary.publishedCovers).toBe(1);
        expect(summary.longHighlights).toBe(1);
        expect(summary.themesKept).toBe(1);
        expect(excludedBooks(policy, data)).toEqual(['b-002']);
    });

    it('measures a book over the whole book, and reports what would actually go out', () => {
        const data = snapshot();
        let policy = publish(initialPublicationPolicy(data), ['b-001']);
        const before = bookStats(policy, data, 'b-001');
        expect(before.highlightCount).toBe(2);
        expect(before.longCount).toBe(1);
        expect(before.selected).toBe(2);
        expect(before.longest).toBe(LONG_PASSAGE);

        policy = toggleHighlightExclusion(policy, 'b-001', 'h-002');
        const after = bookStats(policy, data, 'b-001');
        expect(after.highlightCount).toBe(2);
        expect(after.longCount).toBe(1);
        expect(after.selected).toBe(1);
        expect(after.selectedLongCount).toBe(0);
    });
});
