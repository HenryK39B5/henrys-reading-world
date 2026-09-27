import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareTaggedPassages, lensMembership, weaveEvidence } from '../scripts/research/readingStory.mjs';

const overlay = JSON.parse(readFileSync('.private/research/map/route-first/reading-story/tag-overlay.json', 'utf8')) as {
    snapshotSha256: string; viewerSha256: string; tags: Record<string, string>; highlightTags: Record<string, string[]>;
};
const viewer = JSON.parse(readFileSync('.private/research/map/route-first/viewer-data.json', 'utf8')) as { points: Record<string, { bookId: string }> };
const books = Object.fromEntries(Object.entries(viewer.points).map(([id, value]) => [id, value.bookId]));

describe('R4-M truthful information, from real approved passages', () => {
    it('keeps all approved IDs, a partial tag scope and distinct shared/disjoint/unknown states', () => {
        expect(Object.keys(overlay.highlightTags).length).toBe(3462);
        expect(Object.values(overlay.highlightTags).filter((ids) => ids.length > 0)).toHaveLength(1432);
        expect(compareTaggedPassages(overlay.highlightTags, 'h-3501', 'h-1798').status).toBe('disjoint');
        expect(compareTaggedPassages(overlay.highlightTags, 'h-1917', 'h-2726')).toMatchObject({ status: 'shared', shared: ['tag-040'] });
        expect(compareTaggedPassages(overlay.highlightTags, 'h-4640', 'h-1108').status).toBe('unknown');
        expect(compareTaggedPassages(overlay.highlightTags, 'h-4504', 'h-1367').status).toBe('unknown');
        expect(() => compareTaggedPassages(overlay.highlightTags, 'not-real', 'h-1798')).toThrow();
    });
    it('only highlights actual annotated points and does not turn unknown into a false exclusion', () => {
        const identified = lensMembership(overlay.highlightTags, books, 'h-1917');
        expect(identified.status).toBe('annotated');
        expect(identified.tags).toContain('tag-040');
        expect(identified.ids).toContain('h-2726');
        for (const id of identified.ids) expect(overlay.highlightTags[id]!.some((tag) => identified.tags.includes(tag))).toBe(true);
        expect(identified.books).toBeGreaterThan(1);
        expect(lensMembership(overlay.highlightTags, books, 'h-1108')).toEqual({ status: 'unknown', ids: [], books: 0, tags: [] });
        expect(() => lensMembership(overlay.highlightTags, books, 'not-real')).toThrow();
    });
    it('weaves only already visited real IDs and preserves multi-tag equality', () => {
        const trail = ['h-3501', 'h-1798', 'h-1917', 'h-2726'];
        expect(weaveEvidence(overlay.highlightTags, trail).map((edge) => edge.status)).toEqual(['disjoint', 'disjoint', 'shared']);
        expect(weaveEvidence(overlay.highlightTags, trail).map((edge) => edge.toId)).toEqual(trail.slice(1));
        const multi = { a: ['tag-001', 'tag-002'], b: ['tag-002', 'tag-001'] };
        expect(compareTaggedPassages(multi, 'a', 'b')).toMatchObject({ status: 'shared', shared: multi.a });
    });
});
