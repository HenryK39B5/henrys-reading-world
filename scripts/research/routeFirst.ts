import type { NeighborGraph } from './graphIslands.ts';

export type RouteKind = 'paced' | 'nearest';
export type RouteBand = 'inner' | 'side' | 'outer';
export type RouteStep = { fromId: string; toId: string; rank: number; score: number; expectedBand: RouteBand; bandFallback: boolean; availableCrossBook: number; availableBooks: number; availableInBand: number };
export type RouteResult = { seedId: string; kind: RouteKind; steps: RouteStep[]; status: 'limit' | 'dead-end'; visitedIds: string[]; visitedBooks: string[] };

const bands: { name: RouteBand; start: number; end: number }[] = [
    { name: 'inner', start: 1, end: 4 }, { name: 'side', start: 5, end: 10 }, { name: 'outer', start: 11, end: 16 },
];
const rhythm = [bands[0]!, bands[1]!, bands[2]!, bands[1]!, bands[0]!, bands[2]!];

/** A traceable partial walk, not a guarantee of semantic transition or total reachability. */
export function routeFirst(graph: Pick<NeighborGraph, 'ids' | 'books' | 'nominations'>, seedId: string, kind: RouteKind, rng: () => number, maxSteps = 6): RouteResult {
    if (!graph.ids.includes(seedId) || !graph.books[seedId] || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > rhythm.length || (kind !== 'paced' && kind !== 'nearest')) throw new Error('invalid route seed/kind/length');
    const seen = new Set([seedId]); const visitedBooks = [graph.books[seedId]!];
    const steps: RouteStep[] = [];
    let current = seedId;
    for (let index = 0; index < maxSteps; index += 1) {
        const expected = rhythm[index]!;
        const nominations = graph.nominations[current];
        if (!nominations || nominations.length > 16 || new Set(nominations.map((item) => item.id)).size !== nominations.length ||
            nominations.some((item) => !graph.books[item.id] || !Number.isFinite(item.score) || item.id === current)) throw new Error('invalid route neighbors');
        const options = nominations.map((item, rank) => ({ ...item, rank: rank + 1 })).filter((item) => !seen.has(item.id) && graph.books[item.id] !== graph.books[current]);
        if (options.length === 0) return { seedId, kind, steps, status: 'dead-end', visitedIds: [...seen], visitedBooks };
        const inBand = options.filter((item) => item.rank >= expected.start && item.rank <= expected.end);
        const pool = kind === 'nearest' ? options : inBand.length > 0 ? inBand : options;
        const fresh = pool.filter((item) => !visitedBooks.includes(graph.books[item.id]!));
        const fair = fresh.length ? fresh : pool;
        let choice: (typeof fair)[number];
        if (kind === 'nearest') choice = fair[0]!;
        else {
            const draw = rng();
            if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('invalid RNG draw');
            choice = fair[Math.floor(draw * fair.length)]!;
        }
        const nextId = choice.id;
        steps.push({ fromId: current, toId: nextId, rank: choice.rank, score: choice.score, expectedBand: expected.name,
            bandFallback: kind === 'paced' && inBand.length === 0, availableCrossBook: options.length,
            availableBooks: new Set(options.map((item) => graph.books[item.id])).size, availableInBand: inBand.length });
        current = nextId; seen.add(nextId); visitedBooks.push(graph.books[nextId]!);
    }
    return { seedId, kind, steps, status: 'limit', visitedIds: [...seen], visitedBooks };
}
