import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { islandSweep, mutualNeighborGraph, truncateMutualGraph, type GraphPoint } from './graphIslands.ts';

const started = performance.now();
const out = '.private/research/map/graph-islands';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const validated = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!validated.ok) throw new Error(validated.errors.join('; '));
const snapshot = validated.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const previous = JSON.parse(await readFile('.private/research/map/mapper-partition/study.json', 'utf8')) as { inputSha256: string; embeddingFileSha256: string };
const snapshotSha = sha256(snapshotText); const cacheSha = sha256(cacheText);
if (snapshotSha !== previous.inputSha256 || cacheSha !== previous.embeddingFileSha256 || cache.dimensions !== 1024) throw new Error('input drift from fixed public corpus/vector cache');
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const points: GraphPoint[] = highlights.map((highlight) => {
    const embedding = cache.vectors[highlight.id];
    if (!embedding || embedding.textHash !== highlightTextHash(highlight)) throw new Error(`stale text vector ${highlight.id}`);
    return { id: highlight.id, bookId: highlight.bookId, values: embedding.values };
});
if (points.length !== 3462) throw new Error(`unexpected corpus size ${points.length}`);
const full = mutualNeighborGraph(points, 16);
const graphByK = { 8: truncateMutualGraph(full, 8), 16: full };
const cases = ['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754'];
const byHighlight = new Map(highlights.map((highlight) => [highlight.id, highlight]));
const bookTitle = new Map(snapshot.books.map((book) => [book.id, book.title]));
const label = (id: string, score?: number) => {
    const highlight = byHighlight.get(id);
    if (!highlight) throw new Error(`unknown passage ${id}`);
    return { id, bookId: highlight.bookId, bookTitle: bookTitle.get(highlight.bookId), text: highlight.text, ...(score === undefined ? {} : { score }) };
};
const summaries = [];
const review = [];
for (const k of [8, 16] as const) {
    const graph = graphByK[k];
    const byThreshold = [0.5, 0.75, 0.9].map((quantile) => islandSweep(graph, quantile));
    for (const summary of byThreshold) {
        const counts = summary.components.map((members) => members.length).sort((a, b) => a - b);
        summaries.push({ k, quantile: summary.quantile, threshold: summary.threshold, edgeCount: summary.edgeCount, reciprocalEdges: graph.edges.length,
            components: summary.components.length, singletonCount: summary.singletonCount, largestSize: counts.at(-1) ?? 0, largestShare: summary.largestShare,
            medianComponentSize: counts[Math.floor((counts.length - 1) / 2)] ?? 0, componentsAtLeastFour: summary.componentsAtLeastFour,
            crossBookComponentsAtLeastFour: summary.crossBookComponentsAtLeastFour, bridges: summary.bridges.length });
    }
    const strong = byThreshold[1]!;
    for (const id of cases) {
        const strongEdges = graph.edges.filter((edge) => edge.score >= strong.threshold! && (edge.source === id || edge.target === id))
            .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target)).slice(0, 3);
        const bridgeEdges = strong.bridges.filter((edge) => edge.source === id || edge.target === id).slice(0, 3);
        const neighbor = (edge: { source: string; target: string; score: number }) => label(edge.source === id ? edge.target : edge.source, edge.score);
        review.push({ k, case: label(id), strongComponentSize: strong.components[strong.componentOf[id]!]!.length,
            strong: strongEdges.map(neighbor), bridges: bridgeEdges.map(neighbor), noBridge: bridgeEdges.length === 0 });
    }
}
const report = { schemaVersion: 1, algorithm: 'reciprocal-original-cosine-quantile-islands-v1', generatedAt: new Date().toISOString(), snapshotSha256: snapshotSha, embeddingCacheSha256: cacheSha,
    implementationSha256: sha256(await readFile('scripts/research/graphIslands.ts', 'utf8') + '\0' + await readFile('scripts/research/study-graph-islands.ts', 'utf8')),
    parameters: { population: points.length, model: cache.model, vectorDimensions: cache.dimensions, k: [8, 16], quantiles: [.5, .75, .9], originalMetric: 'normalized 1024-dimensional cosine', graph: 'mutual top-k only', island: 'connected components of reciprocal edges at empirical score quantile', bridge: 'weaker reciprocal edge between two distinct q75 strong components', cases }, summaries,
    graphs: Object.fromEntries(([8, 16] as const).map((k) => [k, { ids: graphByK[k].ids, books: graphByK[k].books, nominations: graphByK[k].nominations, edges: graphByK[k].edges }])),
    runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report) + '\n');
await writeFile(`${out}/review.json`, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ summaries, caseEdges: review.map((item) => ({ k: item.k, id: item.case.id, componentSize: item.strongComponentSize, strong: item.strong.length, bridge: item.bridges.length })), runtime: report.runtime }, null, 2));
