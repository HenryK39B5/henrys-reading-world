import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import type { GraphPoint } from './graphIslands.ts';
import { farthestLandmarks, witnessAtlas, type WitnessAtlas, type WitnessEdge } from './landmarkWitness.ts';

const started = performance.now();
const out = '.private/research/map/landmark-witness';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const prior = JSON.parse(await readFile('.private/research/map/graph-islands/study.json', 'utf8')) as { snapshotSha256: string; embeddingCacheSha256: string; graphs: Record<string, { edges: { source: string; target: string }[] }> };
const snapshotSha = sha256(snapshotText); const cacheSha = sha256(cacheText);
if (snapshotSha !== prior.snapshotSha256 || cacheSha !== prior.embeddingCacheSha256 || cache.dimensions !== 1024) throw new Error('frozen graph/corpus inputs differ');
const snapshot = checked.snapshot;
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const points: GraphPoint[] = highlights.map((highlight) => {
    const embedding = cache.vectors[highlight.id];
    if (!embedding || embedding.textHash !== highlightTextHash(highlight)) throw new Error(`stale vector ${highlight.id}`);
    return { id: highlight.id, bookId: highlight.bookId, values: embedding.values };
});
const degrees = new Map(points.map((point) => [point.id, 0]));
for (const { source, target } of prior.graphs['16']!.edges) { degrees.set(source, degrees.get(source)! + 1); degrees.set(target, degrees.get(target)! + 1); }
const seedId = [...degrees].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
const landmarkIds = farthestLandmarks(points, seedId, 128);
const atlas64 = witnessAtlas(points, landmarkIds.slice(0, 64));
const atlas128 = witnessAtlas(points, landmarkIds);
const byId = new Map(highlights.map((highlight) => [highlight.id, highlight]));
const titles = new Map(snapshot.books.map((book) => [book.id, book.title]));
const passage = (id: string) => { const h = byId.get(id)!; return { id, bookId: h.bookId, title: titles.get(h.bookId), text: h.text }; };
const componentStats = (atlas: WitnessAtlas, minWitness: number) => {
    const ids = atlas.landmarkIds;
    const position = new Map(ids.map((id, i) => [id, i]));
    const parent = ids.map((_id, i) => i);
    const find = (i: number): number => { while (i !== parent[i]) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
    const retained = atlas.edges.filter((edge) => edge.witnesses.length >= minWitness);
    for (const edge of retained) parent[find(position.get(edge.source)!)] = find(position.get(edge.target)!);
    const counts = new Map<number, number>();
    for (let i = 0; i < ids.length; i += 1) { const root = find(i); counts.set(root, (counts.get(root) ?? 0) + 1); }
    return { minWitness, edges: retained.length, supportedByMultipleBooks: retained.filter((edge) => new Set(edge.witnesses.map((w) => w.bookId)).size >= 2).length,
        components: counts.size, isolatedLandmarks: [...counts.values()].filter((size) => size === 1).length, maxComponentSize: Math.max(...counts.values()) };
};
const summarize = (atlas: WitnessAtlas) => {
    const witnessCounts = atlas.edges.map((edge) => edge.witnesses.length).sort((a, b) => a - b);
    const seconds = atlas.assignments.map((assignment) => assignment.secondScore).sort((a, b) => a - b);
    const primaryCounts = atlas.nodes.map((node) => node.primaryIds.length).sort((a, b) => a - b);
    const sameBook = atlas.edges.filter((edge) => new Set(edge.witnesses.map((w) => w.bookId)).size === 1).length;
    return { landmarks: atlas.landmarkIds.length, witnesses: atlas.witnessCount, edges: atlas.edges.length, emptyPrimary: primaryCounts.filter((value) => value === 0).length,
        emptySecondary: atlas.nodes.filter((node) => node.secondaryIds.length === 0).length, maxPrimary: primaryCounts.at(-1) ?? 0,
        medianPrimary: primaryCounts[Math.floor((primaryCounts.length - 1) / 2)] ?? 0, maxWitnessPerEdge: witnessCounts.at(-1) ?? 0,
        medianWitnessPerEdge: witnessCounts[Math.floor((witnessCounts.length - 1) / 2)] ?? 0,
        oneBookEdges: sameBook, secondScoreMin: seconds[0], secondScoreP05: seconds[Math.floor(seconds.length * .05)],
        summaries: [1, 4, 8].map((count) => componentStats(atlas, count)) };
};
const common64 = new Set(atlas64.edges.map((edge) => `${edge.source}|${edge.target}`));
const shared128 = new Set(atlas128.edges.filter((edge) => atlas64.landmarkIds.includes(edge.source) && atlas64.landmarkIds.includes(edge.target)).map((edge) => `${edge.source}|${edge.target}`));
const stability = { sharedLandmarks: 64, edges64: common64.size, edgesStillSupported128: [...common64].filter((key) => shared128.has(key)).length, newEdgesBetweenSharedLandmarks: [...shared128].filter((key) => !common64.has(key)).length };
const cases = ['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754'];
const excerptEdge = (edge: WitnessEdge) => ({ source: passage(edge.source), target: passage(edge.target), witnessCount: edge.witnesses.length,
    bookCount: new Set(edge.witnesses.map((w) => w.bookId)).size, witnessExcerpts: edge.witnesses.slice(0, 4).map((w) => ({ ...passage(w.id), firstScore: w.firstScore, secondScore: w.secondScore })) });
const review = ([atlas64, atlas128] as const).map((atlas) => {
    const sorted = [...atlas.edges].sort((a, b) => b.witnesses.length - a.witnesses.length || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
    const byAssignment = new Map(atlas.assignments.map((assignment) => [assignment.id, assignment]));
    return { landmarks: atlas.landmarkIds.length, largestWitnessEdge: sorted[0] ? excerptEdge(sorted[0]) : null,
        smallestWitnessEdge: sorted.at(-1) ? excerptEdge(sorted.at(-1)!) : null,
        cases: cases.map((id) => {
            const assignment = byAssignment.get(id);
            if (!assignment) return { case: passage(id), isLandmark: true, assignment: null, edge: null };
            const edge = atlas.edges.find((candidate) => candidate.witnesses.some((w) => w.id === id));
            if (!edge) throw new Error('case witness edge missing');
            return { case: passage(id), isLandmark: false, assignment, edge: excerptEdge(edge) };
        }) };
});
const report = { schemaVersion: 1, algorithm: 'real-landmark-two-nearest-witness-one-skeleton-v1', generatedAt: new Date().toISOString(), snapshotSha256: snapshotSha, embeddingCacheSha256: cacheSha,
    graphArtifactSha256: sha256(await readFile('.private/research/map/graph-islands/study.json', 'utf8')),
    implementationSha256: sha256(await readFile('scripts/research/landmarkWitness.ts', 'utf8') + '\0' + await readFile('scripts/research/study-landmark-witness.ts', 'utf8')),
    parameters: { seedId, seedRule: 'highest reciprocal k16 degree, tie stable ID', landmarks: [64, 128], selection: 'max-min on cosine distance, prefix nested', witnessRule: 'non-landmark passage selects nearest two real landmarks', edgeSupport: 'explicit shared witness ID', edgeThresholds: [1, 4, 8], noBookOrTagTraining: true },
    summaries: [summarize(atlas64), summarize(atlas128)], stability, atlases: { 64: atlas64, 128: atlas128 },
    runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report) + '\n');
await writeFile(`${out}/review.json`, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ seedId, summaries: report.summaries, stability, caseLandmarks: review.map((row) => ({ landmarks: row.landmarks, ids: row.cases.map((entry) => ({ id: entry.case.id, isLandmark: entry.isLandmark })) })), runtime: report.runtime }, null, 2));
