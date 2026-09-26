import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { UMAP } from 'umap-js';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { cosineDistance, MAP_LAYOUT_SEED, mulberry32, projectForMap } from '../embeddings/mapLayout.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { compareNeighborhoods, normalizeRows, orderedNeighbors, projectLinear, type LinearModel } from './projectionWindows.ts';
import { alignSimilarity, normalizedDisplacements, pairwiseDistanceCorrelation } from './alignmentStability.ts';

const runStart = performance.now();
const out = '.private/research/map/alignment-stability';
const input = await readFile('src/data/public-snapshot.json', 'utf8');
const parsed = validateSnapshot(JSON.parse(input) as unknown, { expectedVisibility: 'public' });
if (!parsed.ok) throw new Error(parsed.errors.join('; '));
const snapshot = parsed.snapshot;
const baseline = JSON.parse(await readFile('.private/research/map/projection-window/study.json', 'utf8')) as { inputSha256: string; embeddingFileSha256: string; pca: LinearModel; queryIds: string[]; cases: { id: string }[] };
if (baseline.inputSha256 !== sha256(input)) throw new Error('snapshot hash changed');
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
if (baseline.embeddingFileSha256 !== sha256(cacheText)) throw new Error('embedding hash changed');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const points = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const ids = points.map((p) => p.id);
const vectors = normalizeRows(points.map((p) => {
    const entry = cache.vectors[p.id];
    if (entry === undefined || entry.textHash !== highlightTextHash(p)) throw new Error(`stale vector ${p.id}`);
    return entry.values;
}));
const rp96 = vectors.map((vector) => projectForMap(vector));
const pca64 = projectLinear(vectors, baseline.pca);
const seeds = [MAP_LAYOUT_SEED, MAP_LAYOUT_SEED + 1, MAP_LAYOUT_SEED + 2];
const parameters = { nNeighbors: 24, minDist: 0.14, spread: 1.25, nEpochs: 350 };
const flows = [
    { id: 'rp96-cosine', source: rp96, distanceFn: cosineDistance },
    { id: 'pca64-euclidean', source: pca64, distanceFn: undefined },
] as const;
export type Layout = { id: string; flow: string; seed: number; coordinates: [number, number][] };
const layouts: Layout[] = [];
for (const flow of flows) {
    for (const seed of seeds) {
        const umap = new UMAP({ nComponents: 2, ...parameters, ...(flow.distanceFn === undefined ? {} : { distanceFn: flow.distanceFn }), random: mulberry32(seed) });
        console.log(`fit ${flow.id} seed ${seed}`);
        const raw = await umap.fitAsync(flow.source, (epoch) => { if (epoch > 0 && epoch % 100 === 0) console.log(`  ${epoch}/350`); });
        const coordinates = raw.map((point) => [point[0]!, point[1]!] as [number, number]);
        layouts.push({ id: `${flow.id}-${seed}`, flow: flow.id, seed, coordinates });
    }
}
const byFlow = new Map<string, Layout[]>();
for (const layout of layouts) byFlow.set(layout.flow, [...(byFlow.get(layout.flow) ?? []), layout]);
const queryIds = [...new Set([...baseline.queryIds, ...baseline.cases.map((c) => c.id)])];
const byId = new Map(ids.map((id, i) => [id, i]));
const referenceNeighbors = new Map(queryIds.map((id) => { const i = byId.get(id)!; return [id, orderedNeighbors(vectors, ids, i, 'cosine-unit')]; }));
const alignmentRows = [...byFlow].flatMap(([flow, entries]) => {
    const reference = entries.find((entry) => entry.seed === MAP_LAYOUT_SEED)!;
    return entries.map((entry) => {
        const direct = alignSimilarity(entry.coordinates, reference.coordinates, false);
        const best = alignSimilarity(entry.coordinates, reference.coordinates, true);
        const displacement = normalizedDisplacements(entry.coordinates, reference.coordinates);
        const high = queryIds.map((id) => {
            const i = byId.get(id)!; const expected = referenceNeighbors.get(id)!;
            return compareNeighborhoods(expected, orderedNeighbors(entry.coordinates, ids, i, 'euclidean'), 30).recall!;
        });
        return { flow, seed: entry.seed, reference: entry.seed === MAP_LAYOUT_SEED, direct: { scale: direct.scale, angleDegrees: direct.angleRadians * 180 / Math.PI, normalizedRmse: direct.normalizedRmse }, bestReflection: { reflected: best.reflected, normalizedRmse: best.normalizedRmse }, displacement, pairwiseDistanceCorrelation: pairwiseDistanceCorrelation(entry.coordinates, reference.coordinates), medianQueryRecallAgainstFlowReference: high.sort((a, b) => a - b)[Math.floor(high.length / 2)]!, meanQueryRecallAgainstFlowReference: high.reduce((a, b) => a + b, 0) / high.length };
    });
});
const crossFlow = (() => {
    const left = byFlow.get('rp96-cosine')!.find((entry) => entry.seed === MAP_LAYOUT_SEED)!;
    const right = byFlow.get('pca64-euclidean')!.find((entry) => entry.seed === MAP_LAYOUT_SEED)!;
    const direct = alignSimilarity(right.coordinates, left.coordinates, false);
    const best = alignSimilarity(right.coordinates, left.coordinates, true);
    const displacement = normalizedDisplacements(direct.points, left.coordinates);
    const recalls = queryIds.map((id) => { const i = byId.get(id)!; return compareNeighborhoods(orderedNeighbors(left.coordinates, ids, i, 'euclidean'), orderedNeighbors(right.coordinates, ids, i, 'euclidean'), 30).recall!; });
    return { direct: { scale: direct.scale, angleDegrees: direct.angleRadians * 180 / Math.PI, normalizedRmse: direct.normalizedRmse }, bestReflection: { reflected: best.reflected, normalizedRmse: best.normalizedRmse }, displacement, pairwiseDistanceCorrelation: pairwiseDistanceCorrelation(left.coordinates, right.coordinates), medianQueryNeighborhoodOverlap: recalls.sort((a, b) => a - b)[Math.floor(recalls.length / 2)]!, meanQueryNeighborhoodOverlap: recalls.reduce((a, b) => a + b, 0) / recalls.length };
})();
const report = {
    schemaVersion: 1, algorithm: 'alignment-stability-study-v1', generatedAt: new Date().toISOString(), inputSha256: sha256(input), embeddingFileSha256: sha256(cacheText), implementationSha256: sha256(await readFile('scripts/research/alignmentStability.ts', 'utf8') + '\0' + await readFile('scripts/research/study-alignment-stability.ts', 'utf8')),
    parameters: { flows: flows.map((flow) => ({ id: flow.id, sourceDimensions: flow.source[0]!.length, metric: flow.distanceFn === undefined ? 'euclidean' : 'cosine' })), seeds, baseSeed: MAP_LAYOUT_SEED, umap: parameters, alignment: 'translation+uniform-scale+rotation; reflection reported separately', queryCount: queryIds.length },
    alignmentRows, crossFlow, queryIds,
    runtime: { totalMilliseconds: Math.round(performance.now() - runStart), maxRssKiB: process.resourceUsage().maxRSS, node: process.version, umap: '1.4.0' },
};
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(`${out}/layouts.json`, JSON.stringify({ inputSha256: report.inputSha256, ids, layouts }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ alignmentRows, crossFlow, runtime: report.runtime }, null, 2));
