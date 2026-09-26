import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fitPca, normalizeRows } from './projectionWindows.ts';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { buildMapper, type MapperGraph, type MapperParameters, type MapperPoint } from './mapperBaseline.ts';

const started = performance.now();
const out = '.private/research/map/mapper-baseline';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const snapshot = checked.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const points = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const vectors = normalizeRows(points.map((point) => {
    const entry = cache.vectors[point.id];
    if (entry === undefined || entry.textHash !== highlightTextHash(point)) throw new Error(`stale vector ${point.id}`);
    return entry.values;
}));
const mapperPoints: MapperPoint[] = points.map((point, index) => ({ id: point.id, values: vectors[index]!, bookId: point.bookId, tagIds: point.tagIds }));
const pca = fitPca(vectors, 2);
const scores = pca.basis.map((axis) => vectors.map((row) => row.reduce((sum, value, index) => sum + (value - pca.mean[index]!) * axis[index]!, 0)));
const configurations: Array<{ id: string; lens: 'pc1' | 'pc2'; parameters: MapperParameters }> = [];
for (const coverCount of [8, 12, 16]) for (const overlap of [0.25, 0.5]) for (const threshold of [0.18, 0.24]) for (const lens of ['pc1', 'pc2'] as const) configurations.push({ id: `${lens}-c${coverCount}-o${String(overlap).replace('.', '')}-d${String(threshold).replace('.', '')}`, lens, parameters: { coverCount, overlap, cosineDistanceThreshold: threshold, minSharedMembers: 1 } });
function summarize(graph: MapperGraph) {
    const incident = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));
    const sizes = graph.nodes.map((node) => node.memberIds.length).sort((a, b) => a - b);
    const crossBook = graph.nodes.filter((node) => node.bookIds.length > 1).length;
    const topicCounts = new Map<string, number>();
    for (const node of graph.nodes) for (const tag of node.tagIds) topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
    return { nodeCount: graph.nodes.length, edgeCount: graph.edges.length, isolatedNodeCount: graph.nodes.length - incident.size, memberCoverage: new Set(graph.nodes.flatMap((node) => node.memberIds)).size, totalPoints: points.length, meanNodeSize: sizes.reduce((sum, size) => sum + size, 0) / Math.max(sizes.length, 1), medianNodeSize: sizes.length % 2 ? sizes[Math.floor(sizes.length / 2)] : ((sizes[sizes.length / 2 - 1] ?? 0) + (sizes[sizes.length / 2] ?? 0)) / 2, maxNodeSize: sizes.at(-1) ?? 0, crossBookNodeCount: crossBook, crossBookNodeShare: crossBook / Math.max(graph.nodes.length, 1), tagNodeCounts: Object.fromEntries([...topicCounts.entries()].sort(([a], [b]) => a.localeCompare(b))), edgeMeanSharedMembers: graph.edges.length === 0 ? 0 : graph.edges.reduce((sum, edge) => sum + edge.sharedMemberIds.length, 0) / graph.edges.length };
}
const results = configurations.map((configuration) => {
    const lensScores = scores[configuration.lens === 'pc1' ? 0 : 1]!;
    const graph = buildMapper(mapperPoints, lensScores, configuration.parameters);
    return { ...configuration, summary: summarize(graph), graph };
});
const report = {
    schemaVersion: 1, algorithm: 'mapper-baseline-v1', generatedAt: new Date().toISOString(), inputSha256: sha256(snapshotText), embeddingFileSha256: sha256(cacheText), implementationSha256: sha256(await readFile('scripts/research/mapperBaseline.ts', 'utf8') + '\0' + await readFile('scripts/research/study-mapper-baseline.ts', 'utf8')),
    data: { highlightCount: points.length, bookCount: snapshot.books.length, tagCount: snapshot.tags.length, dimensions: vectors[0]!.length },
    lens: { type: 'PCA', components: 2, pcaVariance: pca.eigenvalues.slice(0, 2), totalVariance: pca.totalVariance, pc1Scores: scores[0], pc2Scores: scores[1] },
    fixedConfigurations: configurations.map(({ id, lens, parameters }) => ({ id, lens, parameters })),
    results: results.map(({ id, lens, parameters, summary }) => ({ id, lens, parameters, summary })),
    graphs: Object.fromEntries(results.map(({ id, graph }) => [id, graph])),
    runtime: { totalMilliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version },
};
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(`${out}/summary.json`, JSON.stringify(report.results, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ results: report.results, runtime: report.runtime }, null, 2));
