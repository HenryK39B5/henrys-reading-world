import type { MapperEdge, MapperGraph, MapperNode, MapperParameters, MapperPoint } from './mapperBaseline.ts';

export type LocalParameters = MapperParameters & { neighborCount: number; minNodeSize: number; mutual: boolean };

function validate(points: readonly MapperPoint[], scores: readonly number[], parameters: LocalParameters): void {
    if (points.length < 2 || scores.length !== points.length) throw new Error('local mapper requires matching points and lens scores');
    if (!Number.isInteger(parameters.neighborCount) || parameters.neighborCount < 1) throw new Error('neighbor count must be positive');
    if (!Number.isInteger(parameters.minNodeSize) || parameters.minNodeSize < 2) throw new Error('minimum node size must be at least two');
    if (!Number.isInteger(parameters.coverCount) || parameters.coverCount < 2 || !Number.isFinite(parameters.overlap) || parameters.overlap < 0 || parameters.overlap >= 1) throw new Error('invalid cover parameters');
    if (points.some((point, index) => point.values.some((value) => !Number.isFinite(value)) || !Number.isFinite(scores[index]!))) throw new Error('local mapper requires finite inputs');
}
function distance(left: readonly number[], right: readonly number[]): number {
    let dot = 0; let a = 0; let b = 0;
    for (let index = 0; index < left.length; index += 1) { dot += left[index]! * right[index]!; a += left[index]! ** 2; b += right[index]! ** 2; }
    if (a === 0 || b === 0) throw new Error('local mapper does not accept zero vectors');
    return 1 - dot / Math.sqrt(a * b);
}
function components(indices: readonly number[], points: readonly MapperPoint[], k: number, mutual: boolean): number[][] {
    const neighbors = new Map<number, number[]>();
    for (const index of indices) {
        const ranked = indices.filter((candidate) => candidate !== index).map((candidate) => ({ candidate, distance: distance(points[index]!.values, points[candidate]!.values) })).sort((a, b) => a.distance - b.distance || points[a.candidate]!.id.localeCompare(points[b.candidate]!.id)).slice(0, Math.min(k, indices.length - 1)).map((entry) => entry.candidate);
        neighbors.set(index, ranked);
    }
    const remaining = new Set(indices); const result: number[][] = [];
    while (remaining.size > 0) {
        const seed = Math.min(...remaining); remaining.delete(seed); const queue = [seed]; const component = [seed];
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const candidate of [...remaining]) {
                const forward = neighbors.get(current)?.includes(candidate) ?? false;
                const reverse = neighbors.get(candidate)?.includes(current) ?? false;
                if (forward && (!mutual || reverse)) { remaining.delete(candidate); queue.push(candidate); component.push(candidate); }
            }
        }
        result.push(component.sort((a, b) => points[a]!.id.localeCompare(points[b]!.id)));
    }
    return result.sort((left, right) => points[left[0]!]!.id.localeCompare(points[right[0]!]!.id));
}
function normalized(scores: readonly number[]): number[] {
    const min = Math.min(...scores); const max = Math.max(...scores); const span = Math.max(max - min, Number.EPSILON);
    return scores.map((score) => (score - min) / span);
}

export function buildLocalMapper(pointsInput: readonly MapperPoint[], lensScores: readonly number[], parameters: LocalParameters): MapperGraph & { droppedMemberIds: string[] } {
    validate(pointsInput, lensScores, parameters);
    const points = [...pointsInput].sort((a, b) => a.id.localeCompare(b.id));
    const byId = new Map(pointsInput.map((point, index) => [point.id, lensScores[index]!]))
    const scores = normalized(points.map((point) => byId.get(point.id)!));
    const width = 1 / (parameters.coverCount - parameters.overlap * (parameters.coverCount - 1));
    const step = width * (1 - parameters.overlap);
    const nodes: MapperNode[] = [];
    const covered = new Set<string>();
    for (let coverIndex = 0; coverIndex < parameters.coverCount; coverIndex += 1) {
        const start = Math.min(coverIndex * step, Math.max(0, 1 - width)); const end = Math.min(1, start + width);
        const members = points.map((_point, index) => index).filter((index) => scores[index]! >= start - 1e-12 && scores[index]! <= end + 1e-12);
        const groups = components(members, points, parameters.neighborCount, parameters.mutual);
        let componentIndex = 0;
        for (const group of groups) {
            if (group.length < parameters.minNodeSize) continue;
            componentIndex += 1;
            const memberIds = group.map((index) => points[index]!.id).sort(); memberIds.forEach((id) => covered.add(id));
            nodes.push({ id: `n-${coverIndex + 1}-${componentIndex}`, coverIndex: coverIndex + 1, componentIndex, memberIds, bookIds: [...new Set(group.map((index) => points[index]!.bookId))].sort(), tagIds: [...new Set(group.flatMap((index) => points[index]!.tagIds))].sort(), lensRange: [start, end] });
        }
    }
    const edges: MapperEdge[] = [];
    for (let left = 0; left < nodes.length; left += 1) for (let right = left + 1; right < nodes.length; right += 1) {
        const sharedMemberIds = nodes[left]!.memberIds.filter((id) => nodes[right]!.memberIds.includes(id));
        if (sharedMemberIds.length >= parameters.minSharedMembers) edges.push({ source: nodes[left]!.id, target: nodes[right]!.id, sharedMemberIds });
    }
    return { parameters, nodes, edges, lens: { min: Math.min(...lensScores), max: Math.max(...lensScores), scores: Object.fromEntries(points.map((point, index) => [point.id, scores[index]!])) }, droppedMemberIds: points.map((point) => point.id).filter((id) => !covered.has(id)) };
}
