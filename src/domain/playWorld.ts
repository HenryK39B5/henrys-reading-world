import type { Highlight, Snapshot } from './types.ts';

export const PLAY_WORLD_VERSION = 'play-world-v1';
export type PlayForm = 'globe' | 'lens' | 'fold';
export type PlayParticipation = 'touch' | 'travel';
export type Point3 = [number, number, number];
/** Display coordinates and candidate IDs only. No raw vectors, interpretation, or model confidence. */
export type PlayWorldData = {
    version: typeof PLAY_WORLD_VERSION;
    snapshotHash: string;
    ids: string[];
    positions: Point3[];
    neighbours: number[][];
};
export type TopicGate = { tagIds: string[]; memberIds: string[]; bookCount: number };
const compareId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Shared byte identity for the offline driver, development endpoint, and browser. */
export function playSnapshotIdentity(snapshot: Snapshot): string {
    return JSON.stringify({
        tags: [...snapshot.tags].sort((a, b) => compareId(a.id, b.id)).map((tag) => [tag.id, tag.title]),
        books: [...snapshot.books].sort((a, b) => compareId(a.id, b.id)).map((book) => [book.id, book.title, book.author]),
        highlights: [...snapshot.highlights].sort((a, b) => compareId(a.id, b.id))
            .map((h) => [h.id, h.bookId, h.text, [...h.tagIds].sort(compareId)]),
    });
}

/** Absence is unknown: only positively recorded, equal-status tags qualify an intersection. */
export function topicMembers(highlights: readonly Highlight[], tags: readonly string[]): Highlight[] {
    const required = [...new Set(tags)];
    return highlights.filter((h) => required.every((tag) => h.tagIds.includes(tag)));
}

/** Stop at sparse, unchanged, or duplicate member sets. Never complete unknown tags or force depth. */
export function topicGates(highlights: readonly Highlight[], tags: readonly string[], minimum = 4): TopicGate[] {
    const members = topicMembers(highlights, tags);
    if (members.length <= minimum) return [];
    const groups = new Map<string, Highlight[]>();
    for (const h of members) for (const tag of h.tagIds) {
        if (tags.includes(tag)) continue;
        const group = groups.get(tag) ?? [];
        group.push(h); groups.set(tag, group);
    }
    const unique = new Map<string, TopicGate>();
    for (const [tag, group] of [...groups].sort(([a], [b]) => compareId(a, b))) {
        if (group.length < minimum || group.length === members.length) continue;
        const ids = group.map((h) => h.id).sort(compareId);
        const key = ids.join('|');
        const existing = unique.get(key);
        if (existing !== undefined) existing.tagIds.push(tag);
        else unique.set(key, { tagIds: [tag], memberIds: ids, bookCount: new Set(group.map((h) => h.bookId)).size });
    }
    return [...unique.values()].sort((a, b) => b.bookCount - a.bookCount || b.memberIds.length - a.memberIds.length || compareId(a.tagIds[0] ?? '', b.tagIds[0] ?? ''));
}

export function parsePlayWorldData(raw: unknown, snapshot: Snapshot): PlayWorldData {
    if (raw === null || typeof raw !== 'object') throw Error('Invalid play-world artifact');
    const data = raw as Record<string, unknown>;
    const keys = Object.keys(data).sort().join(',');
    if (keys !== 'ids,neighbours,positions,snapshotHash,version' || data.version !== PLAY_WORLD_VERSION ||
        typeof data.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/u.test(data.snapshotHash) ||
        !Array.isArray(data.ids) || !Array.isArray(data.positions) || !Array.isArray(data.neighbours)) throw Error('Invalid play-world contract');
    const ids = data.ids as unknown[];
    const real = new Set(snapshot.highlights.map((h) => h.id));
    if (ids.length !== real.size || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !real.has(id)) ||
        data.positions.length !== ids.length || data.neighbours.length !== ids.length) throw Error('Play-world coverage does not match the snapshot');
    for (let i = 0; i < ids.length; i += 1) {
        const p: unknown = data.positions[i]; const n: unknown = data.neighbours[i];
        if (!Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 16)) throw Error('Invalid display coordinates');
        if (!Array.isArray(n) || n.length > 16 || new Set(n).size !== n.length ||
            n.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= ids.length || v === i)) throw Error('Invalid candidate identities');
    }
    return raw as PlayWorldData;
}

/** A local conditional space recentres the same three display axes; it does not recompute semantic neighbours. */
export function localPositions(data: PlayWorldData, memberIds: readonly string[]): Map<string, Point3> {
    const wanted = new Set(memberIds);
    const rows = data.ids.flatMap((id, i) => wanted.has(id) ? [{ id, p: data.positions[i] as Point3 }] : []);
    const mean = [0, 0, 0];
    for (const row of rows) for (let axis = 0; axis < 3; axis += 1) mean[axis] = (mean[axis] ?? 0) + (row.p[axis] ?? 0) / Math.max(1, rows.length);
    const centered = rows.map((row) => ({ id: row.id, p: row.p.map((v, axis) => v - (mean[axis] ?? 0)) as Point3 }));
    const lengths = centered.map((row) => Math.hypot(...row.p)).sort((a, b) => a - b);
    const scale = lengths[Math.floor(Math.max(0, lengths.length - 1) * 0.92)] ?? 1;
    return new Map(centered.map((row) => [row.id, row.p.map((v) => v / Math.max(1e-8, scale)) as Point3]));
}

/** One book, then one passage, with injectable RNG. Exhaustion is explicit and never discards unknowns. */
export function playfulEncounter(members: readonly Highlight[], seen: ReadonlySet<string>, rng: () => number): string | null {
    const byBook = new Map<string, Highlight[]>();
    for (const h of [...members].sort((a, b) => compareId(a.id, b.id))) {
        if (seen.has(h.id)) continue;
        const group = byBook.get(h.bookId) ?? []; group.push(h); byBook.set(h.bookId, group);
    }
    const books = [...byBook.keys()].sort(compareId);
    if (books.length === 0) return null;
    const sample = (n: number): number => Math.min(n - 1, Math.max(0, Math.floor(rng() * n)));
    const group = byBook.get(books[sample(books.length)] ?? '');
    return group?.[sample(group.length)]?.id ?? null;
}

/** Candidate membership, not screen proximity. First show distinct books, then fill remaining slots. */
export function playNeighbours(data: PlayWorldData, currentId: string, members: readonly Highlight[], limit = 6): Highlight[] {
    const current = members.find((h) => h.id === currentId);
    const qualified = new Map(members.map((h) => [h.id, h]));
    const row = data.ids.indexOf(currentId);
    const candidates = (data.neighbours[row] ?? []).flatMap((i) => {
        const h = qualified.get(data.ids[i] ?? ''); return h === undefined ? [] : [h];
    });
    const result: Highlight[] = []; const books = new Set(current === undefined ? [] : [current.bookId]);
    for (const h of candidates) if (!books.has(h.bookId) && result.length < limit) { result.push(h); books.add(h.bookId); }
    for (const h of candidates) if (!result.includes(h) && result.length < limit) result.push(h);
    return result;
}
