import { sphericalKMeans } from '../embeddings/clustering.ts';
import type { MapperEdge, MapperNode, MapperPoint } from './mapperBaseline.ts';

export type PartitionParameters = { coverCount: number; overlap: number; targetSize: number; minNodeSize: number; iterations: number };
export type PartitionGraph = { parameters: PartitionParameters; nodes: MapperNode[]; edges: MapperEdge[]; droppedMemberIds: string[] };

export function partitionMapper(pointsInput: readonly MapperPoint[], lensScores: readonly number[], parameters: PartitionParameters): PartitionGraph {
    const { coverCount, overlap, targetSize, minNodeSize, iterations } = parameters;
    if (pointsInput.length < 2 || lensScores.length !== pointsInput.length ||
        new Set(pointsInput.map((point) => point.id)).size !== pointsInput.length ||
        pointsInput.some((point) => !point.id || !point.bookId || !point.values.length || point.values.some((value) => !Number.isFinite(value))) ||
        pointsInput.some((point) => point.values.length !== pointsInput[0]!.values.length) || lensScores.some((score) => !Number.isFinite(score)) ||
        !Number.isInteger(coverCount) || coverCount < 2 || !Number.isFinite(overlap) || overlap < 0 || overlap >= 1 ||
        !Number.isInteger(targetSize) || targetSize < 2 || !Number.isInteger(minNodeSize) || minNodeSize < 2 ||
        !Number.isInteger(iterations) || iterations < 1) throw new Error('invalid partition Mapper input');
    const points = [...pointsInput].sort((a, b) => a.id.localeCompare(b.id));
    const scoresById = new Map(pointsInput.map((point, index) => [point.id, lensScores[index]!]));
    const raw = points.map((point) => scoresById.get(point.id)!);
    const min = Math.min(...raw); const span = Math.max(Math.max(...raw) - min, Number.EPSILON);
    const scores = raw.map((score) => (score - min) / span);
    const width = 1 / (coverCount - overlap * (coverCount - 1));
    const step = width * (1 - overlap);
    const nodes: MapperNode[] = [];
    for (let coverIndex = 0; coverIndex < coverCount; coverIndex += 1) {
        const start = coverIndex * step;
        const end = Math.min(1, start + width);
        const members = points.filter((_, index) => scores[index]! >= start - 1e-12 && scores[index]! <= end + 1e-12);
        if (members.length === 0) continue;
        const clusters = sphericalKMeans(members.map((member) => ({ id: member.id, values: [...member.values] })), Math.ceil(members.length / targetSize), iterations);
        const byId = new Map(members.map((member) => [member.id, member]));
        for (const cluster of clusters) {
            if (cluster.members.length < minNodeSize) continue;
            const memberIds = cluster.members.map((member) => member.id).sort();
            const books = [...new Set(memberIds.map((id) => byId.get(id)!.bookId))].sort();
            const tags = [...new Set(memberIds.flatMap((id) => byId.get(id)!.tagIds))].sort();
            nodes.push({ id: `n-${coverIndex + 1}-${cluster.index}`, coverIndex: coverIndex + 1, componentIndex: cluster.index, memberIds, bookIds: books, tagIds: tags, lensRange: [start, end] });
        }
    }
    const byMember = new Map<string, MapperNode[]>();
    for (const node of nodes) for (const id of node.memberIds) byMember.set(id, [...(byMember.get(id) ?? []), node]);
    const shared = new Map<string, MapperEdge>();
    for (const [id, containing] of byMember) for (let i = 0; i < containing.length; i += 1) for (let j = i + 1; j < containing.length; j += 1) {
        const left = containing[i]!; const right = containing[j]!;
        if (left.coverIndex === right.coverIndex) continue;
        const key = [left.id, right.id].sort().join('|');
        const edge = shared.get(key) ?? { source: left.id < right.id ? left.id : right.id, target: left.id < right.id ? right.id : left.id, sharedMemberIds: [] };
        edge.sharedMemberIds.push(id); shared.set(key, edge);
    }
    return { parameters, nodes, edges: [...shared.values()].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)), droppedMemberIds: points.map((point) => point.id).filter((id) => !byMember.has(id)) };
}

export function bestMemberOverlap(node: MapperNode, alternatives: readonly MapperNode[]): number {
    const members = new Set(node.memberIds);
    let best = 0;
    for (const candidate of alternatives) {
        let intersection = 0;
        for (const id of candidate.memberIds) if (members.has(id)) intersection += 1;
        best = Math.max(best, intersection / (node.memberIds.length + candidate.memberIds.length - intersection));
    }
    return best;
}
