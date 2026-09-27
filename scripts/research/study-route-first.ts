import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { MAP_LAYOUT_SEED, mulberry32 } from '../embeddings/mapLayout.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import type { NeighborGraph } from './graphIslands.ts';
import { routeFirst, type RouteResult } from './routeFirst.ts';

const started = performance.now(); const out = '.private/research/map/route-first';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const verified = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!verified.ok) throw new Error(verified.errors.join('; '));
const snapshot = verified.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const priorText = await readFile('.private/research/map/graph-islands/study.json', 'utf8');
const prior = JSON.parse(priorText) as { snapshotSha256: string; embeddingCacheSha256: string; graphs: Record<'16', NeighborGraph> };
const snapshotSha = sha256(snapshotText); const cacheSha = sha256(cacheText);
if (snapshotSha !== prior.snapshotSha256 || cacheSha !== prior.embeddingCacheSha256 || cache.dimensions !== 1024) throw new Error('input hash/model mismatch');
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
for (const highlight of highlights) if (cache.vectors[highlight.id]?.textHash !== highlightTextHash(highlight)) throw new Error(`stale highlight vector ${highlight.id}`);
const graph = prior.graphs['16'];
if (graph.ids.length !== highlights.length || highlights.some((h, i) => graph.ids[i] !== h.id || graph.books[h.id] !== h.bookId || graph.nominations[h.id]?.length !== 16)) throw new Error('frozen k16 graph mismatch');
const firstByBook = new Map<string, string>();
for (const h of highlights) if (!firstByBook.has(h.bookId)) firstByBook.set(h.bookId, h.id);
const bookSeeds = [...firstByBook].sort((a, b) => a[0].localeCompare(b[0])).map(([, id]) => id);
if (bookSeeds.length !== 108) throw new Error('unexpected number of public books');
const fixedCases = ['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754'];
const seeds = [...new Set([...bookSeeds, ...fixedCases])];
const seedFor = (id: string) => (MAP_LAYOUT_SEED + Number.parseInt(sha256(`route:${id}`).slice(0, 8), 16)) >>> 0;
const records = seeds.map((id) => {
    const paced = routeFirst(graph, id, 'paced', mulberry32(seedFor(id)));
    const nearest = routeFirst(graph, id, 'nearest', () => { throw new Error('nearest route used RNG'); });
    const set = new Set(paced.visitedIds.slice(1));
    const shared = nearest.visitedIds.slice(1).filter((passage) => set.has(passage)).length;
    return { id, seedKind: bookSeeds.includes(id) ? 'book-first' as const : 'fixed-case' as const, paced, nearest,
        intersection: shared, union: set.size + nearest.visitedIds.length - 1 - shared };
});
const summarize = (subset: typeof records, kind: 'paced' | 'nearest') => {
    const routes = subset.map((record) => record[kind]);
    const allSteps = routes.flatMap((route) => route.steps);
    const bookCounts = routes.map((route) => new Set(route.visitedBooks).size).sort((a, b) => a - b);
    const finished = routes.filter((route) => route.status === 'limit').length;
    return { kind, routes: routes.length, sixHopCompleted: finished, deadEnds: routes.length - finished,
        medianSteps: routes.map((route) => route.steps.length).sort((a, b) => a - b)[Math.floor((routes.length - 1) / 2)] ?? 0,
        medianUniqueBooks: bookCounts[Math.floor((bookCounts.length - 1) / 2)] ?? 0,
        medianRank: allSteps.map((step) => step.rank).sort((a, b) => a - b)[Math.floor((allSteps.length - 1) / 2)] ?? null,
        medianScore: allSteps.map((step) => step.score).sort((a, b) => a - b)[Math.floor((allSteps.length - 1) / 2)] ?? null,
        bandFallbacks: allSteps.filter((step) => step.bandFallback).length,
        stepsWithOneOrFewerOtherBooks: allSteps.filter((step) => step.availableBooks <= 1).length,
        distinctEndIds: new Set(routes.map((route) => route.visitedIds.at(-1))).size };
};
const summaries = { bookFirst: [summarize(records.filter((record) => record.seedKind === 'book-first'), 'paced'), summarize(records.filter((record) => record.seedKind === 'book-first'), 'nearest')],
    addedCases: [summarize(records.filter((record) => record.seedKind === 'fixed-case'), 'paced'), summarize(records.filter((record) => record.seedKind === 'fixed-case'), 'nearest')],
    allSeeds: seeds.length, seedOverlap: fixedCases.filter((id) => bookSeeds.includes(id)),
    sameReachableIds: records.filter((record) => record.paced.visitedIds.join('|') === record.nearest.visitedIds.join('|')).length,
    medianIntersectionOverUnion: records.map((record) => record.union ? record.intersection / record.union : 1).sort((a, b) => a - b)[Math.floor((records.length - 1) / 2)] };
const byHighlight = new Map(highlights.map((h) => [h.id, h]));
const titles = new Map(snapshot.books.map((book) => [book.id, book.title]));
const passage = (id: string) => { const highlight = byHighlight.get(id)!; return { id, bookId: highlight.bookId, title: titles.get(highlight.bookId), tagIds: highlight.tagIds, text: highlight.text }; };
const expand = (route: RouteResult) => ({ seed: passage(route.seedId), kind: route.kind, status: route.status,
    steps: route.steps.map((step) => ({ ...step, from: passage(step.fromId), to: passage(step.toId) })) });
const reviewIds = [...new Set([...fixedCases, ...bookSeeds.slice(0, 5)])];
const review = reviewIds.map((id) => ({ id, paced: expand(records.find((record) => record.id === id)!.paced), nearest: expand(records.find((record) => record.id === id)!.nearest) }));
const report = { schemaVersion: 1, algorithm: 'top16-book-crossing-rank-paced-walk-v1', generatedAt: new Date().toISOString(),
    snapshotSha256: snapshotSha, embeddingCacheSha256: cacheSha, graphArtifactSha256: sha256(priorText),
    implementationSha256: sha256(await readFile('scripts/research/routeFirst.ts', 'utf8') + '\0' + await readFile('scripts/research/study-route-first.ts', 'utf8')),
    parameters: { corpus: highlights.length, books: bookSeeds.length, fixedCases, reviewIds, seeds, seedMixer: MAP_LAYOUT_SEED, directedK: 16, length: 6,
        rhythm: ['inner:1-4', 'side:5-10', 'outer:11-16', 'side:5-10', 'inner:1-4', 'outer:11-16'],
        rule: 'cross-book, unseen passage, fresh-book preference in selected band, fallback recorded, no 2D/label completion' },
    summaries, records, runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report) + '\n');
await writeFile(`${out}/review.json`, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ summaries, fixed: fixedCases.map((id) => { const row = records.find((r) => r.id === id)!; return { id, pacedSteps: row.paced.steps.length, nearestSteps: row.nearest.steps.length, pacedFallbacks: row.paced.steps.filter((step) => step.bandFallback).length }; }), runtime: report.runtime }, null, 2));
