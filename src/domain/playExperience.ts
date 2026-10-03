import type { Highlight } from './types.ts';
import { playfulEncounter, playNeighbours, type PlayWorldData } from './playWorld.ts';

export type ReadingPage = { highlight: Highlight; kind: 'anchor' | 'candidate' | 'encounter' };
export type ReadingFrame = { tags: string[]; anchorId: string | null; selectedId: string | null };

/** Stable display sampling only. It neither produces text nor estimates semantic relations. */
export function pageRandom(seed: string): () => number {
    let state = 2166136261;
    for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let x = Math.imul(state ^ (state >>> 15), 1 | state);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/** One stable scene. Selecting a page does not change its anchor, membership, or arrangement. */
export function readingPages(members: readonly Highlight[], anchorId: string | null,
    data: PlayWorldData | null, limit = 7): ReadingPage[] {
    if (limit <= 0) return [];
    const anchor = members.find(h => h.id === anchorId);
    if (anchor === undefined) return [];
    const pages: ReadingPage[] = [{ highlight: anchor, kind: 'anchor' }];
    if (data !== null) for (const h of playNeighbours(data, anchor.id, members, limit - 1)) {
        pages.push({ highlight: h, kind: 'candidate' });
    }
    const seen = new Set(pages.map(page => page.highlight.id));
    const occupiedBooks = new Set(pages.map(page => page.highlight.bookId));
    const rng = pageRandom(anchor.id);
    while (pages.length < limit) {
        const otherBooks = members.filter(h => !occupiedBooks.has(h.bookId));
        const id = playfulEncounter(otherBooks.length > 0 ? otherBooks : members, seen, rng);
        const next = members.find(h => h.id === id);
        if (next === undefined) break;
        pages.push({ highlight: next, kind: 'encounter' });
        seen.add(next.id); occupiedBooks.add(next.bookId);
    }
    return pages;
}

/** URL is content identity, not camera state. Invalid/out-of-scope identities never masquerade as members. */
export function readingFrame(members: readonly Highlight[], tags: readonly string[], selectedId: string | null,
    anchorId: string | null, rng: () => number): ReadingFrame {
    const exists = (id: string | null): id is string => id !== null && members.some(h => h.id === id);
    const selected = exists(selectedId) ? selectedId : exists(anchorId) ? anchorId : playfulEncounter(members, new Set(), rng);
    return { tags: [...tags], anchorId: exists(anchorId) ? anchorId : selected, selectedId: selected };
}

/** Query-based static-hosting address; only stable content IDs, no array offsets or vectors. */
export function readingAddress(frame: ReadingFrame, bookId: string | null = null): string {
    const query = new URLSearchParams();
    if (bookId !== null) query.set('book', bookId);
    if (frame.selectedId !== null) query.set('h', frame.selectedId);
    if (frame.tags.length > 0) query.set('world', frame.tags.join(','));
    if (frame.anchorId !== null) query.set('anchor', frame.anchorId);
    return query.size === 0 ? '/map' : `/map?${query.toString()}`;
}
