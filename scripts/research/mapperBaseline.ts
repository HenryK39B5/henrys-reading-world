export type MapperPoint = { id: string; values: readonly number[]; bookId: string; tagIds: readonly string[] };
export type MapperParameters = { coverCount: number; overlap: number; cosineDistanceThreshold: number; minSharedMembers: number };
export type MapperNode = { id: string; coverIndex: number; componentIndex: number; memberIds: string[]; bookIds: string[]; tagIds: string[]; lensRange: [number, number] };
export type MapperEdge = { source: string; target: string; sharedMemberIds: string[] };
export type MapperGraph = { parameters: MapperParameters; nodes: MapperNode[]; edges: MapperEdge[]; lens: { min: number; max: number; scores: Record<string, number> } };

function validate(points: readonly MapperPoint[]): number {
    if (points.length < 2) throw new Error('mapper requires at least two points');
    const dimensions = points[0]!.values.length;
    if (dimensions === 0 || points.some((point) => point.values.length !== dimensions || point.values.some((value) => !Number.isFinite(value)) || point.id.length === 0 || point.bookId.length === 0)) throw new Error('mapper requires finite equal-dimensional points');
    if (new Set(points.map((point) => point.id)).size !== points.length) throw new Error('mapper point IDs must be unique');
    return dimensions;
}
function cosineDistance(left: readonly number[], right: readonly number[]): number {
    let dot = 0; let leftNorm = 0; let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) { dot += left[index]! * right[index]!; leftNorm += left[index]! ** 2; rightNorm += right[index]! ** 2; }
    if (leftNorm === 0 || rightNorm === 0) throw new Error('mapper does not accept zero vectors');
    return 1 - dot / Math.sqrt(leftNorm * rightNorm);
}
function validateParameters(parameters: MapperParameters): void {
    if (!Number.isInteger(parameters.coverCount) || parameters.coverCount < 2) throw new Error('cover count must be at least two');
    if (!Number.isFinite(parameters.overlap) || parameters.overlap < 0 || parameters.overlap >= 1) throw new Error('overlap must be in [0, 1)');
    if (!Number.isFinite(parameters.cosineDistanceThreshold) || parameters.cosineDistanceThreshold <= 0 || parameters.cosineDistanceThreshold >= 2) throw new Error('cosine distance threshold must be in (0, 2)');
    if (!Number.isInteger(parameters.minSharedMembers) || parameters.minSharedMembers < 1) throw new Error('minimum shared members must be positive');
}
function components(indices: readonly number[], points: readonly MapperPoint[], threshold: number): number[][] {
    const remaining = new Set(indices); const result: number[][] = [];
    while (remaining.size > 0) {
        const seed = Math.min(...remaining); remaining.delete(seed);
        const queue = [seed]; const component = [seed];
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const candidate of [...remaining]) {
                if (cosineDistance(points[current]!.values, points[candidate]!.values) <= threshold) {
                    remaining.delete(candidate); queue.push(candidate); component.push(candidate);
                }
            }
        }
        result.push(component.sort((a, b) => points[a]!.id.localeCompare(points[b]!.id)));
    }
    return result.sort((left, right) => points[left[0]!]!.id.localeCompare(points[right[0]!]!.id));
}
function normalizedScores(scores: readonly number[]): { min: number; max: number; scores: number[] } {
    const min = Math.min(...scores); const max = Math.max(...scores);
    const span = Math.max(max - min, Number.EPSILON);
    return { min, max, scores: scores.map((score) => (score - min) / span) };
}

export function buildMapper(pointsInput: readonly MapperPoint[], lensScores: readonly number[], parameters: MapperParameters): MapperGraph {
    validate(pointsInput); validateParameters(parameters);
    if (lensScores.length !== pointsInput.length || lensScores.some((score) => !Number.isFinite(score))) throw new Error('mapper lens must match finite point scores');
    const points = [...pointsInput].sort((a, b) => a.id.localeCompare(b.id));
    const scoreById = new Map(pointsInput.map((point, index) => [point.id, lensScores[index]!]))
    const orderedScores = points.map((point) => scoreById.get(point.id)!);
    const normalized = normalizedScores(orderedScores);
    const width = 1 / (parameters.coverCount - parameters.overlap * (parameters.coverCount - 1));
    const step = width * (1 - parameters.overlap);
    const nodes: MapperNode[] = [];
    for (let coverIndex = 0; coverIndex < parameters.coverCount; coverIndex += 1) {
        const start = Math.min(coverIndex * step, Math.max(0, 1 - width));
        const end = Math.min(1, start + width);
        const members = points.map((_point, index) => index).filter((index) => normalized.scores[index]! >= start - 1e-12 && normalized.scores[index]! <= end + 1e-12);
        for (const [componentIndex, component] of components(members, points, parameters.cosineDistanceThreshold).entries()) {
            const memberIds = component.map((index) => points[index]!.id).sort();
            const bookIds = [...new Set(component.map((index) => points[index]!.bookId))].sort();
            const tagIds = [...new Set(component.flatMap((index) => points[index]!.tagIds))].sort();
            nodes.push({ id: `n-${coverIndex + 1}-${componentIndex + 1}`, coverIndex: coverIndex + 1, componentIndex: componentIndex + 1, memberIds, bookIds, tagIds, lensRange: [start, end] });
        }
    }
    const edges: MapperEdge[] = [];
    for (let left = 0; left < nodes.length; left += 1) for (let right = left + 1; right < nodes.length; right += 1) {
        const sharedMemberIds = nodes[left]!.memberIds.filter((id) => nodes[right]!.memberIds.includes(id));
        if (sharedMemberIds.length >= parameters.minSharedMembers) edges.push({ source: nodes[left]!.id, target: nodes[right]!.id, sharedMemberIds });
    }
    return { parameters, nodes, edges, lens: { min: normalized.min, max: normalized.max, scores: Object.fromEntries(points.map((point, index) => [point.id, normalized.scores[index]!])) } };
}
