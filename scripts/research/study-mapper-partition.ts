import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sha256, highlightTextHash, type EmbeddingCache } from '../embeddings/core.ts';
import { normalizeRows, median } from './projectionWindows.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { bestMemberOverlap, partitionMapper, type PartitionGraph } from './mapperPartition.ts';
import type { MapperNode, MapperPoint } from './mapperBaseline.ts';

const started = performance.now();
const out = '.private/research/map/mapper-partition';
const text = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(text) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const snapshot = checked.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const previous = JSON.parse(await readFile('.private/research/map/mapper-baseline/study.json', 'utf8')) as { inputSha256: string; embeddingFileSha256: string; lens: { pc1Scores: number[]; pc2Scores: number[] } };
if (previous.inputSha256 !== sha256(text) || previous.embeddingFileSha256 !== sha256(cacheText)) throw new Error('R4-A input hash mismatch');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const vectors = normalizeRows(highlights.map((highlight) => {
    const entry = cache.vectors[highlight.id];
    if (entry === undefined || entry.textHash !== highlightTextHash(highlight)) throw new Error(`stale vector ${highlight.id}`);
    return entry.values;
}));
const points: MapperPoint[] = highlights.map((highlight, index) => ({ id: highlight.id, values: vectors[index]!, bookId: highlight.bookId, tagIds: highlight.tagIds }));
const byHighlight = new Map(highlights.map((highlight) => [highlight.id, highlight]));
const byVector = new Map(points.map((point) => [point.id, point.values]));
const cases = ['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754'];
const definitions = (['pc1', 'pc2'] as const).flatMap((lens) => [32, 64].map((targetSize) => ({ id: `${lens}-c8-t${targetSize}`, lens, parameters: { coverCount: 8, overlap: 0.5, targetSize, minNodeSize: 4, iterations: 6 } })));
function cohesion(node: MapperNode): { mean: number; nearest: string; farthest: string } {
    const centroid = Array.from({ length: points[0]!.values.length }, () => 0);
    for (const id of node.memberIds) byVector.get(id)!.forEach((value, index) => { centroid[index] = centroid[index]! + value; });
    const length = Math.hypot(...centroid);
    const scores = node.memberIds.map((id) => ({ id, similarity: byVector.get(id)!.reduce((sum, value, index) => sum + value * centroid[index]!, 0) / length }));
    scores.sort((a, b) => a.similarity - b.similarity || a.id.localeCompare(b.id));
    return { mean: scores.reduce((sum, score) => sum + score.similarity, 0) / scores.length, nearest: scores.at(-1)!.id, farthest: scores[0]!.id };
}
function summary(graph: PartitionGraph) {
    const sizes = graph.nodes.map((node) => node.memberIds.length);
    const bookConcentration = graph.nodes.map((node) => {
        const counts = new Map<string, number>();
        for (const id of node.memberIds) counts.set(byHighlight.get(id)!.bookId, (counts.get(byHighlight.get(id)!.bookId) ?? 0) + 1);
        return Math.max(...counts.values()) / node.memberIds.length;
    });
    const covered = points.length - graph.droppedMemberIds.length;
    return { nodes: graph.nodes.length, edges: graph.edges.length, covered, dropped: graph.droppedMemberIds.length, coverage: covered / points.length, medianSize: median(sizes), maxSize: Math.max(...sizes), over128: sizes.filter((size) => size > 128).length, crossBook: graph.nodes.filter((node) => node.bookIds.length > 1).length, medianLargestBookShare: median(bookConcentration), medianCohesion: median(graph.nodes.map((node) => cohesion(node).mean)) };
}
const results = definitions.map(({ id, lens, parameters }) => {
    const scores = lens === 'pc1' ? previous.lens.pc1Scores : previous.lens.pc2Scores;
    const graph = partitionMapper(points, scores, parameters);
    return { id, lens, parameters, summary: summary(graph), graph };
});
const stability = (['pc1', 'pc2'] as const).map((lens) => {
    const small = results.find((result) => result.id === `${lens}-c8-t32`)!.graph.nodes;
    const large = results.find((result) => result.id === `${lens}-c8-t64`)!.graph.nodes;
    const matches = small.map((node) => bestMemberOverlap(node, large));
    return { lens, sourceNodes: small.length, medianBestJaccard: median(matches), belowHalf: matches.filter((match) => match < 0.5).length, zero: matches.filter((match) => match === 0).length };
});
const review = results.map(({ id, graph }) => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const chosen = new Set<string>();
    const caseMembership = cases.map((caseId) => ({ caseId, nodeIds: graph.nodes.filter((node) => node.memberIds.includes(caseId)).map((node) => node.id) }));
    for (const item of caseMembership) for (const nodeId of item.nodeIds) chosen.add(nodeId);
    const largest = [...graph.nodes].sort((a, b) => b.memberIds.length - a.memberIds.length || a.id.localeCompare(b.id))[0]!;
    const smallest = [...graph.nodes].sort((a, b) => a.memberIds.length - b.memberIds.length || a.id.localeCompare(b.id))[0]!;
    const weakest = [...graph.nodes].map((node) => ({ node, score: cohesion(node).mean })).sort((a, b) => a.score - b.score || a.node.id.localeCompare(b.node.id))[0]!.node;
    chosen.add(largest.id); chosen.add(smallest.id); chosen.add(weakest.id);
    return { id, caseMembership, nodes: [...chosen].map((nodeId) => {
        const node = nodeById.get(nodeId)!;
        const sample = [cohesion(node).nearest, cohesion(node).farthest, ...cases.filter((caseId) => node.memberIds.includes(caseId))];
        return { nodeId, size: node.memberIds.length, books: node.bookIds.length, cohesion: cohesion(node).mean, passages: [...new Set(sample)].map((memberId) => ({ id: memberId, bookId: byHighlight.get(memberId)!.bookId, text: byHighlight.get(memberId)!.text, tags: byHighlight.get(memberId)!.tagIds })) };
    }) };
});
const report = { schemaVersion: 1, algorithm: 'mapper-spherical-partition-v1', generatedAt: new Date().toISOString(), inputSha256: sha256(text), embeddingFileSha256: sha256(cacheText), lensArtifactSha256: sha256(await readFile('.private/research/map/mapper-baseline/study.json', 'utf8')), implementationSha256: sha256(await readFile('scripts/research/mapperPartition.ts', 'utf8') + '\0' + await readFile('scripts/research/study-mapper-partition.ts', 'utf8') + '\0' + await readFile('scripts/embeddings/clustering.ts', 'utf8')), definitions, results: results.map(({ id, lens, parameters, summary: metrics }) => ({ id, lens, parameters, metrics })), stability, graphs: Object.fromEntries(results.map(({ id, graph }) => [id, graph])), review, runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile(`${out}/review.json`, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ results: report.results, stability, runtime: report.runtime }, null, 2));
