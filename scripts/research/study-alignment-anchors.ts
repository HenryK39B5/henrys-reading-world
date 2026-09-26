import { readFile, writeFile } from 'node:fs/promises';
import { sha256 } from '../embeddings/core.ts';
import { orderedNeighbors } from './projectionWindows.ts';
import { alignFromAnchors, alignSimilarity, normalizedDisplacements, pairwiseDistanceCorrelation } from './alignmentStability.ts';

type Layout = { id: string; flow: string; seed: number; coordinates: [number, number][] };
type LayoutArtifact = { inputSha256: string; ids: string[]; layouts: Layout[] };
const start = performance.now();
const out = '.private/research/map/alignment-stability';
const layouts = JSON.parse(await readFile(`${out}/layouts.json`, 'utf8')) as LayoutArtifact;
const baseline = JSON.parse(await readFile('.private/research/map/projection-window/study.json', 'utf8')) as { inputSha256: string; queryIds: string[]; cases: { id: string }[] };
if (layouts.inputSha256 !== baseline.inputSha256) throw new Error('R3-A layout input changed');
const indexById = new Map(layouts.ids.map((id, index) => [id, index]));
const caseIds = [...new Set(baseline.cases.map((c) => c.id))];
const anchorIndices = caseIds.map((id) => indexById.get(id)).filter((index): index is number => index !== undefined);
if (anchorIndices.length < 2) throw new Error('fixed case anchors missing');
const byFlow = new Map<string, Layout[]>();
for (const layout of layouts.layouts) byFlow.set(layout.flow, [...(byFlow.get(layout.flow) ?? []), layout]);
const referenceSeed = 1296126005;
const queryIndices = baseline.queryIds.map((id) => indexById.get(id)).filter((index): index is number => index !== undefined);
const rows = [...byFlow].flatMap(([flow, entries]) => {
    const reference = entries.find((entry) => entry.seed === referenceSeed)!;
    return entries.map((entry) => {
        const global = alignSimilarity(entry.coordinates, reference.coordinates, false);
        const anchored = alignFromAnchors(entry.coordinates, reference.coordinates, anchorIndices, false);
        const globalCase = caseIds.map((id) => global.points[indexById.get(id)!]!);
        const anchoredCase = caseIds.map((id) => anchored.points[indexById.get(id)!]!);
        const targetCase = caseIds.map((id) => reference.coordinates[indexById.get(id)!]!);
        const globalQueryDisplacements = normalizedDisplacements(queryIndices.map((index) => global.points[index]!), queryIndices.map((index) => reference.coordinates[index]!));
        const anchoredQueryDisplacements = normalizedDisplacements(queryIndices.map((index) => anchored.points[index]!), queryIndices.map((index) => reference.coordinates[index]!));
        const globalAnchorFit = normalizedDisplacements(globalCase, targetCase);
        const anchoredAnchorFit = normalizedDisplacements(anchoredCase, targetCase);
        const globalNeighborInvariance = queryIndices.map((index) => {
            const raw = orderedNeighbors(entry.coordinates, layouts.ids, index, 'euclidean').slice(0, 30).map((n) => n.index);
            const transformed = orderedNeighbors(global.points, layouts.ids, index, 'euclidean').slice(0, 30).map((n) => n.index);
            return raw.every((value, i) => value === transformed[i]);
        }).every(Boolean);
        const anchoredNeighborInvariance = queryIndices.map((index) => {
            const raw = orderedNeighbors(entry.coordinates, layouts.ids, index, 'euclidean').slice(0, 30).map((n) => n.index);
            const transformed = orderedNeighbors(anchored.points, layouts.ids, index, 'euclidean').slice(0, 30).map((n) => n.index);
            return raw.every((value, i) => value === transformed[i]);
        }).every(Boolean);
        return {
            flow, seed: entry.seed, reference: entry.seed === referenceSeed,
            global: { alignmentRmse: global.normalizedRmse, all: normalizedDisplacements(global.points, reference.coordinates), cases: globalAnchorFit, queries: globalQueryDisplacements, pairwiseDistanceCorrelation: pairwiseDistanceCorrelation(global.points, reference.coordinates), neighborOrderInvariant: globalNeighborInvariance },
            sharedCaseAnchors: { fitRmse: anchored.normalizedRmse, all: normalizedDisplacements(anchored.points, reference.coordinates), cases: anchoredAnchorFit, queries: anchoredQueryDisplacements, pairwiseDistanceCorrelation: pairwiseDistanceCorrelation(anchored.points, reference.coordinates), neighborOrderInvariant: anchoredNeighborInvariance },
        };
    });
});
const nonReference = rows.filter((row) => !row.reference);
const summary = [...new Set(rows.map((row) => row.flow))].map((flow) => {
    const selected = nonReference.filter((row) => row.flow === flow);
    return {
        flow, count: selected.length,
        global: { medianCaseDisplacement: median(selected.map((row) => row.global.cases.median)), medianQueryDisplacement: median(selected.map((row) => row.global.queries.median)), medianRmse: median(selected.map((row) => row.global.alignmentRmse)) },
        sharedCaseAnchors: { medianCaseDisplacement: median(selected.map((row) => row.sharedCaseAnchors.cases.median)), medianQueryDisplacement: median(selected.map((row) => row.sharedCaseAnchors.queries.median)), medianRmse: median(selected.map((row) => row.sharedCaseAnchors.fitRmse)) },
        allNeighborOrdersInvariant: selected.every((row) => row.global.neighborOrderInvariant && row.sharedCaseAnchors.neighborOrderInvariant),
    };
});
function median(values: readonly number[]): number { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; }
const report = {
    schemaVersion: 1, algorithm: 'alignment-anchor-readability-study-v1', generatedAt: new Date().toISOString(), inputSha256: layouts.inputSha256, implementationSha256: sha256(await readFile('scripts/research/alignmentStability.ts', 'utf8') + '\0' + await readFile('scripts/research/study-alignment-anchors.ts', 'utf8')),
    parameters: { referenceSeed, anchorIds: caseIds, anchorCount: anchorIndices.length, alignment: 'translation+uniform-scale+rotation; no reflection', queryCount: queryIndices.length },
    summary, rows, interpretation: { similarityTransformPreservesExactNeighborOrder: true, anchorFitDoesNotImproveNeighborhoodGeometry: true },
    runtime: { totalMilliseconds: Math.round(performance.now() - start), node: process.version },
};
await writeFile(`${out}/anchor-study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ summary, anchorIds: caseIds, runtime: report.runtime }, null, 2));
