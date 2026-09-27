import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sha256 } from '../embeddings/core.ts';
import { MAP_LAYOUT_SEED, mulberry32 } from '../embeddings/mapLayout.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { MAP_COORDINATE_MAX } from '../../src/domain/types.ts';
import type { RouteResult } from './routeFirst.ts';
import { normalizedMapDistance, pickBookMatchedId, rankPublishedNeighbor } from './routeMapGeometry.ts';

const started = performance.now();
const directory = '.private/research/map/route-first';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const snapshot = checked.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const graphText = await readFile('.private/research/map/graph-islands/study.json', 'utf8');
const routeText = await readFile(`${directory}/study.json`, 'utf8');
const route = JSON.parse(routeText) as { snapshotSha256: string; embeddingCacheSha256: string; graphArtifactSha256: string;
    records: { id: string; seedKind: string; paced: RouteResult; nearest: RouteResult }[]; parameters: { fixedCases: string[] } };
const snapshotSha = sha256(snapshotText); const cacheSha = sha256(cacheText); const graphSha = sha256(graphText);
if (route.snapshotSha256 !== snapshotSha || route.embeddingCacheSha256 !== cacheSha || route.graphArtifactSha256 !== graphSha) throw new Error('route input drift');
const pointById = new Map(snapshot.map!.points.map((point) => [point.highlightId, point]));
if (pointById.size !== snapshot.highlights.length || snapshot.highlights.some((highlight) => !pointById.has(highlight.id))) throw new Error('map incomplete');
const points = [...snapshot.map!.points].sort((a, b) => a.highlightId.localeCompare(b.highlightId));
const bookHighlights = new Map<string, string[]>();
for (const highlight of snapshot.highlights) bookHighlights.set(highlight.bookId, [...(bookHighlights.get(highlight.bookId) ?? []), highlight.id]);
for (const ids of bookHighlights.values()) ids.sort();
const bookById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight.bookId]));
const seed = (value: string) => (MAP_LAYOUT_SEED + Number.parseInt(sha256(value).slice(0, 8), 16)) >>> 0;
type EdgeCheck = { seedId: string; kind: RouteResult['kind']; stepIndex: number; fromId: string; toId: string; bookId: string;
    source: { x: number; y: number }; target: { x: number; y: number }; target2dRank: number; normalizedDistance: number;
    matchedControlId: string; control: { x: number; y: number }; controlDistance: number; identicalControl: boolean };
const edges: EdgeCheck[] = [];
for (const record of route.records) for (const kind of ['paced', 'nearest'] as const) {
    for (const [index, step] of record[kind].steps.entries()) {
        const from = pointById.get(step.fromId)!; const to = pointById.get(step.toId)!;
        if (!from || !to || step.fromId === step.toId || bookById.get(step.toId) === bookById.get(step.fromId)) throw new Error('invalid cross-book edge');
        const rank = rankPublishedNeighbor(points, step.fromId, step.toId);
        const pool = bookHighlights.get(bookById.get(step.toId)!)!;
        const matchedControlId = pickBookMatchedId(pool, mulberry32(seed(`${record.id}:${kind}:${index}`)));
        const control = pointById.get(matchedControlId)!;
        edges.push({ seedId: record.id, kind, stepIndex: index, fromId: step.fromId, toId: step.toId, bookId: bookById.get(step.toId)!,
            source: { x: from.x, y: from.y }, target: { x: to.x, y: to.y }, target2dRank: rank,
            normalizedDistance: normalizedMapDistance(from, to), matchedControlId, control: { x: control.x, y: control.y },
            controlDistance: normalizedMapDistance(from, control), identicalControl: matchedControlId === step.toId });
    }
}
const percentile = (values: number[], fraction: number) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? null;
const summary = (subset: EdgeCheck[], category: string) => ({ category, steps: subset.length, medianMapDistance: percentile(subset.map((edge) => edge.normalizedDistance), .5),
    p90MapDistance: percentile(subset.map((edge) => edge.normalizedDistance), .9),
    medianMatchedBookRandomDistance: percentile(subset.map((edge) => edge.controlDistance), .5),
    p90MatchedBookRandomDistance: percentile(subset.map((edge) => edge.controlDistance), .9),
    median2dRank: percentile(subset.map((edge) => edge.target2dRank), .5), top30InPublished2d: subset.filter((edge) => edge.target2dRank <= 30).length,
    closerThanMatchedBookRandom: subset.filter((edge) => edge.normalizedDistance < edge.controlDistance).length,
    fartherThanMatchedBookRandom: subset.filter((edge) => edge.normalizedDistance > edge.controlDistance).length,
    exactTies: subset.filter((edge) => edge.normalizedDistance === edge.controlDistance).length,
    identicalControl: subset.filter((edge) => edge.identicalControl).length });
const bookSeeds = new Set(route.records.filter((record) => record.seedKind === 'book-first').map((record) => record.id));
const fixedCases = new Set(route.parameters.fixedCases);
const summaries = [
    ...(['paced', 'nearest'] as const).map((kind) => summary(edges.filter((edge) => edge.kind === kind && bookSeeds.has(edge.seedId)), `108-book-first:${kind}`)),
    ...(['paced', 'nearest'] as const).map((kind) => summary(edges.filter((edge) => edge.kind === kind && fixedCases.has(edge.seedId)), `five-fixed:${kind}`)),
];
const report = { schemaVersion: 1, algorithm: 'route-vs-published-map-book-controlled-2d-v1', generatedAt: new Date().toISOString(),
    inputSha256: snapshotSha, embeddingCacheSha256: cacheSha, graphArtifactSha256: graphSha, routeArtifactSha256: sha256(routeText),
    implementationSha256: sha256(await readFile('scripts/research/study-route-map-trace.ts', 'utf8') + '\0' + await readFile('scripts/research/routeMapGeometry.ts', 'utf8')),
    parameters: { mapVersion: snapshot.map!.version, points: points.length, dimensionalScale: MAP_COORDINATE_MAX * Math.SQRT2, rankPopulation: points.length - 1,
        seedScope: '108 book-first plus five fixed (overlap preserved)', seedBase: MAP_LAYOUT_SEED,
        matchedControl: 'same target book sorted ID with replacement per edge; mulberry32((seedBase + sha256(recordId:kind:stepIndex).first32) >>> 0)', k2d: 30 },
    summaries, edges, runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/spatial-trace.json`, JSON.stringify(report) + '\n');
console.log(JSON.stringify({ summaries, runtime: report.runtime }, null, 2));
