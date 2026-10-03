import { describe, expect, it } from 'vitest';
import raw from '../src/data/public-snapshot.json';
import type { Snapshot } from '../src/domain/types.ts';
import { PLAY_WORLD_VERSION, type PlayWorldData, topicMembers } from '../src/domain/playWorld.ts';
import { pageRandom, readingAddress, readingFrame, readingPages } from '../src/domain/playExperience.ts';
const snapshot = raw as Snapshot;
const members = snapshot.highlights;
const anchor = members[0]; if (anchor === undefined) throw Error('Genuine approved collection required');
const data: PlayWorldData = { version: PLAY_WORLD_VERSION, snapshotHash: 'a'.repeat(64), ids: members.map(h => h.id),
    positions: members.map(() => [0,0,0]), neighbours: members.map((_, i) => [(i + 1) % members.length]) };
// Coordinates/edges are explicit numerical fixtures; every passage/author/book/ID is genuine.
describe('single-action reading scenes', () => {
    it('uses only real originals and labels stored candidates separately from encounters', () => {
        const pages = readingPages(members, anchor.id, data);
        expect(pages).toHaveLength(7); expect(new Set(pages.map(p => p.highlight.id)).size).toBe(7);
        expect(pages[0]?.kind).toBe('anchor'); expect(pages[1]?.kind).toBe('candidate');
        expect(pages.slice(2).every(p => p.kind === 'encounter')).toBe(true);
        expect(pages.every(p => members.includes(p.highlight))).toBe(true);
    });
    it('works entirely offline without geometry and never calls those encounters similar', () => {
        const pages = readingPages(members, anchor.id, null);
        expect(pages.slice(1).every(p => p.kind === 'encounter')).toBe(true);
        expect(new Set(pages.map(p => p.highlight.bookId)).size).toBe(pages.length);
    });
    it('is stable across selection, refresh and input ordering', () => {
        expect(readingPages(members, anchor.id, data)).toEqual(readingPages([...members].reverse(), anchor.id, data));
        const selection = readingPages(members, anchor.id, data)[2]?.highlight.id ?? anchor.id;
        const frame = readingFrame(members, [], selection, anchor.id, () => 0);
        expect(frame.anchorId).toBe(anchor.id); expect(frame.selectedId).toBe(selection);
        expect(readingPages(members, frame.anchorId, data)).toEqual(readingPages(members, anchor.id, data));
    });
    it('stops in a sparse leaf while retaining every original', () => {
        const leaf = members.slice(0,2); expect(readingPages(leaf, anchor.id, data)).toHaveLength(2);
        expect(readingPages([], anchor.id, data)).toEqual([]); expect(readingPages(members, 'unknown', data)).toEqual([]);
    });
    it('respects positive tag membership and never promotes outside-scope requests', () => {
        const tag = snapshot.tags[0]?.id; if (tag === undefined) throw Error('No real tag');
        const scope = topicMembers(members,[tag]); const frame = readingFrame(scope,[tag], 'unknown',anchor.id,()=>0);
        expect(scope.some(h => h.id === frame.selectedId)).toBe(true);
        expect(readingPages(scope, frame.anchorId,data).every(p => p.highlight.tagIds.includes(tag))).toBe(true);
    });
    it('preserves stable IDs and independent scene identity in static room queries', () => {
        const frame = {tags:['tag-001'],anchorId:anchor.id,selectedId:members[1]?.id ?? anchor.id};
        const url = new URL(readingAddress(frame,anchor.bookId),'https://example.test/');
        expect(url.pathname).toBe('/map'); expect(url.searchParams.get('h')).toBe(frame.selectedId);
        expect(url.searchParams.get('anchor')).toBe(frame.anchorId); expect(url.searchParams.get('world')).toBe('tag-001');
    });
    it('deterministic sampling stays bounded and does not use current time', () => {
        const first = pageRandom('scope'); const second = pageRandom('scope');
        for(let i=0;i<50;i++){const n=first();expect(n).toBe(second());expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThan(1);}
    });
});
