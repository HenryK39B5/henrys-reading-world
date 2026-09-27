import type { GraphPoint } from './graphIslands.ts';

export type Witness = { id: string; bookId: string; firstScore: number; secondScore: number };
export type WitnessNode = { id: string; primaryIds: string[]; secondaryIds: string[]; primaryBooks: string[]; secondaryBooks: string[] };
export type WitnessEdge = { source: string; target: string; witnesses: Witness[] };
export type WitnessAtlas = { landmarkIds: string[]; witnessCount: number; nodes: WitnessNode[]; edges: WitnessEdge[]; assignments: { id: string; firstId: string; secondId: string; firstScore: number; secondScore: number }[] };

function normalized(points: readonly GraphPoint[]): { ids: string[]; books: Map<string, string>; rows: Float64Array[] } {
    if (points.length < 3 || new Set(points.map((p) => p.id)).size !== points.length) throw new Error('invalid point IDs/count');
    const ordered = [...points].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const dimensions = ordered[0]!.values.length;
    if (!dimensions || ordered.some((p) => !p.id || !p.bookId || p.values.length !== dimensions || p.values.some((value) => !Number.isFinite(value)))) throw new Error('invalid point vector/book');
    const rows = ordered.map((p) => {
        let norm = 0;
        for (const value of p.values) norm += value * value;
        norm = Math.sqrt(norm);
        if (!Number.isFinite(norm) || norm === 0) throw new Error('invalid point norm');
        return Float64Array.from(p.values, (value) => value / norm);
    });
    return { ids: ordered.map((p) => p.id), books: new Map(ordered.map((p) => [p.id, p.bookId])), rows };
}
function dot(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i]! * b[i]!;
    return sum;
}

/** Max-min landmark prefix from a fixed real-passage seed; outliers are not suppressed. */
export function farthestLandmarks(points: readonly GraphPoint[], seedId: string, count: number): string[] {
    const { ids, rows } = normalized(points);
    const seed = ids.indexOf(seedId);
    if (seed < 0 || !Number.isInteger(count) || count < 2 || count >= ids.length) throw new Error('invalid seed/landmark count');
    const chosen = new Set<number>(); const result: string[] = [];
    const nearest = new Float64Array(ids.length); nearest.fill(-Infinity);
    let next = seed;
    for (let iteration = 0; iteration < count; iteration += 1) {
        chosen.add(next); result.push(ids[next]!);
        const current = rows[next]!;
        for (let i = 0; i < rows.length; i += 1) if (!chosen.has(i)) nearest[i] = Math.max(nearest[i]!, dot(current, rows[i]!));
        let smallest = Infinity; let candidate = -1;
        for (let i = 0; i < ids.length; i += 1) if (!chosen.has(i) && nearest[i]! < smallest) { smallest = nearest[i]!; candidate = i; }
        next = candidate;
    }
    return result;
}

/** Two nearest landmark witnesses form only a 1-skeleton edge, not a complete witness complex. */
export function witnessAtlas(points: readonly GraphPoint[], landmarkIds: readonly string[]): WitnessAtlas {
    const { ids, books, rows } = normalized(points);
    if (landmarkIds.length < 2 || landmarkIds.length >= ids.length || new Set(landmarkIds).size !== landmarkIds.length) throw new Error('invalid landmark IDs/count');
    const position = new Map(ids.map((id, i) => [id, i]));
    const landmarkIndices = landmarkIds.map((id) => {
        const index = position.get(id);
        if (index === undefined) throw new Error(`unknown landmark ${id}`);
        return index;
    });
    const selected = new Set(landmarkIndices);
    const nodes = landmarkIds.map((id) => ({ id, primaryIds: [] as string[], secondaryIds: [] as string[], primaryBooks: [] as string[], secondaryBooks: [] as string[] }));
    const edges = new Map<string, WitnessEdge>();
    const assignments: WitnessAtlas['assignments'] = [];
    for (let pointIndex = 0; pointIndex < ids.length; pointIndex += 1) {
        if (selected.has(pointIndex)) continue;
        let first = -1; let second = -1; let firstScore = -Infinity; let secondScore = -Infinity;
        for (let l = 0; l < landmarkIndices.length; l += 1) {
            const score = dot(rows[pointIndex]!, rows[landmarkIndices[l]!]!);
            const before = (candidate: number, prior: number) => score > prior || (score === prior && (first < 0 || landmarkIds[candidate]! < landmarkIds[first]!));
            if (before(l, firstScore)) { second = first; secondScore = firstScore; first = l; firstScore = score; }
            else if (score > secondScore || (score === secondScore && (second < 0 || landmarkIds[l]! < landmarkIds[second]!))) { second = l; secondScore = score; }
        }
        if (first < 0 || second < 0) throw new Error('missing witness pair');
        const id = ids[pointIndex]!; const bookId = books.get(id)!;
        nodes[first]!.primaryIds.push(id); nodes[first]!.primaryBooks.push(bookId);
        nodes[second]!.secondaryIds.push(id); nodes[second]!.secondaryBooks.push(bookId);
        const firstId = landmarkIds[first]!; const secondId = landmarkIds[second]!;
        assignments.push({ id, firstId, secondId, firstScore, secondScore });
        const source = firstId < secondId ? firstId : secondId; const target = firstId < secondId ? secondId : firstId;
        const key = `${source}|${target}`;
        const edge = edges.get(key) ?? { source, target, witnesses: [] };
        edge.witnesses.push({ id, bookId, firstScore, secondScore }); edges.set(key, edge);
    }
    return { landmarkIds: [...landmarkIds], witnessCount: assignments.length, nodes,
        edges: [...edges.values()].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0), assignments };
}
