import type { MapperNode, MapperPoint } from './mapperBaseline.ts';
import type { PartitionGraph } from './mapperPartition.ts';

export type MatchedPair = { caseId: string; nodeId: string; role: 'nearest' | 'farthest'; memberId: string; memberBookId: string; controlId: string | null; controlPoolSize: number; memberSimilarity: number; controlSimilarity: number | null };

function cosine(left: readonly number[], right: readonly number[]): number {
    let value = 0; let aa = 0; let bb = 0;
    for (let i = 0; i < left.length; i += 1) { value += left[i]! * right[i]!; aa += left[i]! ** 2; bb += right[i]! ** 2; }
    if (aa === 0 || bb === 0) throw new Error('zero embedding vector');
    return value / Math.sqrt(aa * bb);
}

export function matchedCasePairs(points: readonly MapperPoint[], rawScores: readonly number[], graph: PartitionGraph, caseId: string, random: () => number): MatchedPair[] {
    if (points.length !== rawScores.length || points.length < 2 || rawScores.some((score) => !Number.isFinite(score)) ||
        new Set(points.map((point) => point.id)).size !== points.length) throw new Error('invalid comparison input');
    const byId = new Map(points.map((point) => [point.id, point]));
    const anchor = byId.get(caseId);
    if (!anchor) throw new Error(`missing case ${caseId}`);
    const candidates = graph.nodes.filter((node) => node.memberIds.includes(caseId)).sort((a, b) => a.memberIds.length - b.memberIds.length || a.id.localeCompare(b.id));
    const node: MapperNode | undefined = candidates[0];
    if (!node) return [];
    const min = Math.min(...rawScores); const span = Math.max(Math.max(...rawScores) - min, Number.EPSILON);
    const normalized = new Map(points.map((point, index) => [point.id, (rawScores[index]! - min) / span]));
    const inNode = new Set(node.memberIds);
    const ranked = node.memberIds.filter((id) => id !== caseId && byId.get(id)?.bookId !== anchor.bookId).map((id) => ({ id, similarity: cosine(anchor.values, byId.get(id)!.values) })).sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
    if (ranked.length === 0) return [];
    return (['nearest', 'farthest'] as const).map((role) => {
        const member = role === 'nearest' ? ranked[0]! : ranked.at(-1)!;
        const memberBookId = byId.get(member.id)!.bookId;
        const pool = points.filter((point) => point.bookId === memberBookId && !inNode.has(point.id) && point.id !== caseId &&
            normalized.get(point.id)! >= node.lensRange[0] - 1e-12 && normalized.get(point.id)! <= node.lensRange[1] + 1e-12).map((point) => point.id).sort();
        const draw = random();
        if (!(draw >= 0 && draw < 1)) throw new Error('RNG must return a value in [0,1)');
        const controlId = pool[Math.floor(draw * pool.length)] ?? null;
        return { caseId, nodeId: node.id, role, memberId: member.id, memberBookId, controlId, controlPoolSize: pool.length, memberSimilarity: member.similarity, controlSimilarity: controlId === null ? null : cosine(anchor.values, byId.get(controlId)!.values) };
    });
}
