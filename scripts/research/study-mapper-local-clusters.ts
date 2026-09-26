import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fitPca, normalizeRows } from './projectionWindows.ts';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { buildLocalMapper, type LocalParameters } from './mapperLocalClusters.ts';
import type { MapperPoint } from './mapperBaseline.ts';

const started = performance.now();
const out = '.private/research/map/mapper-local-clusters';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const snapshot = checked.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const vectors = normalizeRows(highlights.map((highlight) => {
    const entry = cache.vectors[highlight.id];
    if (entry === undefined || entry.textHash !== highlightTextHash(highlight)) throw new Error(`stale vector ${highlight.id}`);
    return entry.values;
}));
const points: MapperPoint[] = highlights.map((highlight, index) => ({ id: highlight.id, values: vectors[index]!, bookId: highlight.bookId, tagIds: highlight.tagIds }));
const pca = fitPca(vectors, 2);
const scores = pca.basis.map((axis) => vectors.map((row) => row.reduce((sum, value, index) => sum + (value - pca.mean[index]!) * axis[index]!, 0)));
const configurations: Array<{ id: string; lens: 'pc1' | 'pc2'; parameters: LocalParameters }> = [];
for (const coverCount of [8, 12]) for (const neighborCount of [8, 16]) for (const minNodeSize of [4, 8]) for (const lens of ['pc1', 'pc2'] as const) configurations.push({ id: `${lens}-c${coverCount}-k${neighborCount}-m${minNodeSize}`, lens, parameters: { coverCount, overlap: 0.5, cosineDistanceThreshold: 0, minSharedMembers: 1, neighborCount, minNodeSize, mutual: true } });
function median(values: readonly number[]): number { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle]! : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2; }
function summarize(graph: ReturnType<typeof buildLocalMapper>) {
    const incident = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));
    const sizes = graph.nodes.map((node) => node.memberIds.length).sort((a, b) => a - b);
    const crossBook = graph.nodes.filter((node) => node.bookIds.length > 1).length;
    const covered = new Set(graph.nodes.flatMap((node) => node.memberIds));
    return { nodeCount: graph.nodes.length, edgeCount: graph.edges.length, isolatedNodeCount: graph.nodes.length - incident.size, totalPoints: points.length, coveredPoints: covered.size, droppedPoints: graph.droppedMemberIds.length, coverage: covered.size / points.length, meanNodeSize: sizes.reduce((sum, size) => sum + size, 0) / Math.max(sizes.length, 1), medianNodeSize: sizes.length === 0 ? 0 : median(sizes), maxNodeSize: sizes.at(-1) ?? 0, crossBookNodeCount: crossBook, crossBookNodeShare: crossBook / Math.max(graph.nodes.length, 1), meanBookCount: graph.nodes.length === 0 ? 0 : graph.nodes.reduce((sum, node) => sum + node.bookIds.length, 0) / graph.nodes.length, edgeMeanSharedMembers: graph.edges.length === 0 ? 0 : graph.edges.reduce((sum, edge) => sum + edge.sharedMemberIds.length, 0) / graph.edges.length };
}
const results = configurations.map((configuration) => {
    const graph = buildLocalMapper(points, scores[configuration.lens === 'pc1' ? 0 : 1]!, configuration.parameters);
    return { ...configuration, summary: summarize(graph), graph };
});
const report = { schemaVersion: 1, algorithm: 'mapper-local-mutual-knn-v1', generatedAt: new Date().toISOString(), inputSha256: sha256(snapshotText), embeddingFileSha256: sha256(cacheText), implementationSha256: sha256(await readFile('scripts/research/mapperLocalClusters.ts', 'utf8') + '\0' + await readFile('scripts/research/study-mapper-local-clusters.ts', 'utf8')), data: { highlightCount: highlights.length, bookCount: snapshot.books.length, tagCount: snapshot.tags.length, dimensions: vectors[0]!.length }, lens: { type: 'PCA', components: 2, pcaVariance: pca.eigenvalues.slice(0, 2), totalVariance: pca.totalVariance }, fixedConfigurations: configurations, results: results.map(({ id, lens, parameters, summary }) => ({ id, lens, parameters, summary })), graphs: Object.fromEntries(results.map(({ id, graph }) => [id, graph])), runtime: { totalMilliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(`${out}/summary.json`, JSON.stringify(report.results, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ results: report.results, runtime: report.runtime }, null, 2));
