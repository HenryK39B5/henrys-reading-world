export type GraphPoint = { id: string; bookId: string; values: readonly number[] };
export type Neighbor = { id: string; score: number };
export type IslandEdge = { source: string; target: string; score: number };
export type NeighborGraph = { k: number; ids: string[]; books: Record<string, string>; nominations: Record<string, Neighbor[]>; edges: IslandEdge[] };
export type IslandSummary = { quantile: number; threshold: number | null; edgeCount: number; components: string[][]; componentOf: Record<string, number>; singletonCount: number; largestShare: number; crossBookComponentsAtLeastFour: number; componentsAtLeastFour: number; bridges: IslandEdge[] };

function comesBefore(a: Neighbor, b: Neighbor): boolean {
    return a.score > b.score || (a.score === b.score && a.id < b.id);
}

function addNeighbor(list: Neighbor[], entry: Neighbor, k: number): void {
    if (list.length === k && !comesBefore(entry, list[k - 1]!)) return;
    let start = 0; let end = list.length;
    while (start < end) {
        const mid = (start + end) >>> 1;
        if (comesBefore(list[mid]!, entry)) start = mid + 1;
        else end = mid;
    }
    list.splice(start, 0, entry);
    if (list.length > k) list.pop();
}

/** Exact cosine ranks; no 2D coordinates, book or tag filters. Do not call this graph a semantic truth. */
export function mutualNeighborGraph(input: readonly GraphPoint[], k: number): NeighborGraph {
    if (input.length < 2 || !Number.isInteger(k) || k < 1 || k >= input.length || new Set(input.map((p) => p.id)).size !== input.length) throw new Error('invalid graph size/IDs/k');
    const points = [...input].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const dimensions = points[0]!.values.length;
    if (!dimensions || points.some((p) => !p.id || !p.bookId || p.values.length !== dimensions || p.values.some((x) => !Number.isFinite(x)))) throw new Error('invalid graph vector/book');
    const values = points.map((point) => {
        let normSquared = 0;
        for (const value of point.values) normSquared += value * value;
        const norm = Math.sqrt(normSquared);
        if (!Number.isFinite(norm) || norm === 0) throw new Error('invalid vector norm');
        return Float64Array.from(point.values, (value) => value / norm);
    });
    const ranked: Neighbor[][] = points.map(() => []);
    for (let i = 0; i < points.length; i += 1) {
        const left = values[i]!;
        for (let j = i + 1; j < points.length; j += 1) {
            const right = values[j]!;
            let score = 0;
            for (let lane = 0; lane < dimensions; lane += 1) score += left[lane]! * right[lane]!;
            addNeighbor(ranked[i]!, { id: points[j]!.id, score }, k);
            addNeighbor(ranked[j]!, { id: points[i]!.id, score }, k);
        }
    }
    const choices = ranked.map((list) => new Set(list.map((neighbor) => neighbor.id)));
    const position = new Map(points.map((point, i) => [point.id, i]));
    const edges: IslandEdge[] = [];
    for (let i = 0; i < points.length; i += 1) for (const neighbor of ranked[i]!) {
        const j = position.get(neighbor.id)!;
        if (j > i && choices[j]!.has(points[i]!.id)) edges.push({ source: points[i]!.id, target: neighbor.id, score: neighbor.score });
    }
    edges.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
    return { k, ids: points.map((point) => point.id), books: Object.fromEntries(points.map((point) => [point.id, point.bookId])), nominations: Object.fromEntries(points.map((point, index) => [point.id, ranked[index]!])), edges };
}

export function truncateMutualGraph(graph: NeighborGraph, k: number): NeighborGraph {
    if (!Number.isInteger(k) || k < 1 || k > graph.k) throw new Error('invalid truncated k');
    const nominations = Object.fromEntries(graph.ids.map((id) => [id, graph.nominations[id]!.slice(0, k)]));
    const selected = new Map(graph.ids.map((id) => [id, new Set(nominations[id]!.map((neighbor) => neighbor.id))]));
    return { k, ids: [...graph.ids], books: { ...graph.books }, nominations,
        edges: graph.edges.filter((edge) => selected.get(edge.source)!.has(edge.target) && selected.get(edge.target)!.has(edge.source)) };
}

export function islandSweep(graph: NeighborGraph, quantile: number): IslandSummary {
    if (!(quantile >= 0 && quantile <= 1) || !Number.isFinite(quantile) || !Number.isInteger(graph.k) || graph.k < 1 || new Set(graph.ids).size !== graph.ids.length || !graph.ids.length) throw new Error('invalid sweep input');
    const ids = [...graph.ids].sort(); const index = new Map(ids.map((id, i) => [id, i]));
    const sortedScores = graph.edges.map((edge) => edge.score).sort((a, b) => a - b);
    const threshold = sortedScores[Math.floor(quantile * (sortedScores.length - 1))] ?? null;
    const parent = ids.map((_id, i) => i);
    const find = (id: number): number => {
        let root = id;
        while (parent[root] !== root) root = parent[root]!;
        while (parent[id] !== id) { const next = parent[id]!; parent[id] = root; id = next; }
        return root;
    };
    let edgeCount = 0;
    for (const edge of graph.edges) {
        const left = index.get(edge.source); const right = index.get(edge.target);
        if (left === undefined || right === undefined || left === right || !Number.isFinite(edge.score)) throw new Error('invalid edge');
        if (threshold !== null && edge.score >= threshold) { parent[find(left)] = find(right); edgeCount += 1; }
    }
    const groups = new Map<number, string[]>();
    for (let i = 0; i < ids.length; i += 1) { const root = find(i); groups.set(root, [...(groups.get(root) ?? []), ids[i]!]); }
    const components = [...groups.values()].sort((a, b) => a[0]! < b[0]! ? -1 : 1);
    const componentOf = Object.fromEntries(components.flatMap((members, idx) => members.map((id) => [id, idx])));
    const bridges = graph.edges.filter((edge) => threshold !== null && edge.score < threshold && componentOf[edge.source] !== componentOf[edge.target])
        .sort((a, b) => b.score - a.score || (a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
    return { quantile, threshold, edgeCount, components, componentOf, singletonCount: components.filter((members) => members.length === 1).length,
        largestShare: Math.max(...components.map((members) => members.length)) / ids.length,
        componentsAtLeastFour: components.filter((members) => members.length >= 4).length,
        crossBookComponentsAtLeastFour: components.filter((members) => members.length >= 4 && new Set(members.map((id) => graph.books[id])).size > 1).length, bridges };
}
