import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { UMAP } from 'umap-js';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { MAP_LAYOUT_SEED, mulberry32, normalizeMapPoints } from '../embeddings/mapLayout.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { compareNeighborhoods, fitContrastive, median, normalizeRows, orderedNeighbors, projectLinear, type LinearModel } from './projectionWindows.ts';
import { bookHoldout, equalBookSummary, nontrivialMemberTask } from './bookProjectionHoldout.ts';

const out = '.private/research/map/projection-pipeline-holdout';
const start = performance.now();
const input = await readFile('src/data/public-snapshot.json', 'utf8');
const valid = validateSnapshot(JSON.parse(input) as unknown, { expectedVisibility: 'public' });
if (!valid.ok) throw new Error(valid.errors.join('; '));
const snapshot = valid.snapshot;
const baseline = JSON.parse(await readFile('.private/research/map/projection-window/study.json', 'utf8')) as {
    inputSha256: string; embeddingFileSha256: string; implementationSha256: string; pca: LinearModel;
    queryIds: string[]; cases: { id: string; tagId: string }[]; queries: { id: string; bookSample: boolean }[];
};
const viewer = JSON.parse(await readFile('.private/research/map/projection-window/viewer-data.json', 'utf8')) as {
    views: { id: string; coordinates: number[][] }[];
};
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
if (baseline.inputSha256 !== sha256(input) || baseline.embeddingFileSha256 !== sha256(cacheText)) throw new Error('R2-A fixed input changed');
const cache = JSON.parse(cacheText) as EmbeddingCache;
if (cache.model !== 'Xenova/bge-large-zh-v1.5@a48549b-q8-cls' || cache.provider !== 'local' || cache.dimensions !== 1024) throw new Error('fixed model changed');
const points = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const ids = points.map((p) => p.id);
const byId = new Map(ids.map((id, i) => [id, i]));
const vectors = normalizeRows(points.map((p) => {
    const vector = cache.vectors[p.id];
    if (vector === undefined || vector.textHash !== highlightTextHash(p) || vector.values.length !== 1024) throw new Error(`stale/missing vector ${p.id}`);
    return vector.values;
}));
const scores = projectLinear(vectors, baseline.pca);
const parameters = { nNeighbors: 24, minDist: 0.14, spread: 1.25, nEpochs: 350 };
const umap = new UMAP({ nComponents: 2, ...parameters, random: mulberry32(MAP_LAYOUT_SEED) });
console.log(`PCA64 Euclidean UMAP: ${ids.length} fixed public rows`);
const raw = await umap.fitAsync(scores, (epoch) => { if (epoch > 0 && epoch % 100 === 0) console.log(`UMAP ${epoch}/350`); });
const normalized = normalizeMapPoints(ids.map((highlightId, i) => ({ highlightId, x: raw[i]![0]!, y: raw[i]![1]! }))).map((p) => [p.x, p.y]);
const pipelineViews = [
    { id: 'pca64-umap-raw', title: 'PCA64 UMAP · 原始', coordinates: raw, topic: null, alpha: null, theta: null },
    { id: 'pca64-umap-normalized', title: 'PCA64 UMAP · 生产归一化', coordinates: normalized, topic: null, alpha: null, theta: null },
];
const globalQueries = baseline.queryIds.map((id) => {
    const i = byId.get(id)!; const high = orderedNeighbors(vectors, ids, i, 'cosine-unit');
    return { id, bookSample: baseline.queries.find((q) => q.id === id)!.bookSample, views: pipelineViews.map((v) => {
        const low = orderedNeighbors(v.coordinates, ids, i, 'euclidean');
        return { id: v.id, k: [15, 30, 60].map((k) => compareNeighborhoods(high, low, k)), nearest30: low.slice(0, 30).map((p) => ids[p.index]!) };
    }) };
});
const pipelineSummary = pipelineViews.map((v) => ({ id: v.id, k: [15, 30, 60].map((k, ki) => {
    const queries = globalQueries.filter((q) => q.bookSample).map((q) => q.views.find((w) => w.id === v.id)!.k[ki]!);
    return { k, medianRecall: median(queries.map((q) => q.recall!)), meanRecall: queries.reduce((sum, q) => sum + q.recall!, 0) / queries.length, medianOutsideHighTopTenPercentShare: median(queries.map((q) => q.outsideHighTopTenPercentShare!)) };
}) }));
const uniqueCases = baseline.cases.filter((c, i, list) => list.findIndex((other) => other.id === c.id) === i);
const topics = ['tag-026', 'tag-031', 'tag-050'];
const supplementalViews: { id: string; title: string; coordinates: number[][]; topic: string; alpha: number; theta: null; heldoutBookId: string; caseId: string }[] = [];
const books = new Map(snapshot.books.map((b) => [b.id, b]));
const crossBookReferences = uniqueCases.map((c) => {
    const i = byId.get(c.id)!;
    const high = orderedNeighbors(vectors, ids, i, 'cosine-unit').filter((n) => points[n.index]!.bookId !== points[i]!.bookId);
    return { id: c.id, neighborIds: high.slice(0, 30).map((p) => ids[p.index]!) };
});
type NeighborMetric = ReturnType<typeof compareNeighborhoods>;
type SourceEvidence = { id: string; k: NeighborMetric[]; nearest30: string[]; membersK5: NeighborMetric & { nontrivial: boolean; chanceRecall: number } };
type FoldQuery = { id: string; bookId: string; highNearest30: string[]; sources: SourceEvidence[] };
type Fold = { topic: string; bookId: string; status: string; trainForegroundCount: number; trainBackgroundCount: number; heldoutRecordCount?: number; queries: FoldQuery[] };
const folds: Fold[] = [];
for (const topic of topics) {
    const bookIds = [...new Set(points.filter((p) => p.tagIds.includes(topic)).map((p) => p.bookId))].sort();
    for (const bookId of bookIds) {
        const split = bookHoldout(points, topic, bookId);
        console.log(`Holdout ${topic}/${bookId}: fg=${split.foreground.length}, queries=${split.queries.length}, ${split.status}`);
        if (split.status !== 'evaluated') { folds.push({ topic, bookId, status: split.status, trainForegroundCount: split.foreground.length, trainBackgroundCount: split.background.length, queries: [] }); continue; }
        const model = fitContrastive(split.foreground.map((i) => scores[i]!), split.background.map((i) => scores[i]!), 1);
        const loo = projectLinear(scores, model);
        const sources = [
            { id: 'published', rows: viewer.views.find((v) => v.id === 'published')!.coordinates },
            { id: 'pca-0', rows: viewer.views.find((v) => v.id === 'pca-0')!.coordinates },
            { id: 'in-sample-cpca64', rows: viewer.views.find((v) => v.id === `cpca-${topic}-1`)!.coordinates },
            { id: 'leave-book-cpca64', rows: loo },
        ];
        const queries = split.queries.map((i) => {
            const high = orderedNeighbors(vectors, ids, i, 'cosine-unit').filter((n) => points[n.index]!.bookId !== bookId);
            const highMembers = high.filter((n) => points[n.index]!.tagIds.includes(topic));
            return { id: ids[i]!, bookId, highNearest30: high.slice(0, 30).map((n) => ids[n.index]!), sources: sources.map((s) => {
                const low = orderedNeighbors(s.rows, ids, i, 'euclidean').filter((n) => points[n.index]!.bookId !== bookId);
                const lowMembers = low.filter((n) => points[n.index]!.tagIds.includes(topic));
                return { id: s.id, k: [15, 30, 60].map((k) => compareNeighborhoods(high, low, k)), nearest30: low.slice(0, 30).map((n) => ids[n.index]!),
                    membersK5: { nontrivial: nontrivialMemberTask(highMembers.length, 5), chanceRecall: Math.min(5, highMembers.length) / highMembers.length, ...compareNeighborhoods(highMembers, lowMembers, 5) } };
            }) };
        });
        folds.push({ topic, bookId, status: split.status, trainForegroundCount: split.foreground.length, trainBackgroundCount: split.background.length, heldoutRecordCount: points.filter((p) => p.bookId === bookId).length, queries });
        const c = uniqueCases.find((c) => c.tagId === topic && points[byId.get(c.id)!]!.bookId === bookId);
        if (c !== undefined) supplementalViews.push({ id: `loo-${topic}-${bookId}`, title: `${snapshot.tags.find((t) => t.id === topic)!.title} · 留书 ${books.get(bookId)!.title}`, coordinates: loo, topic, alpha: 1, theta: null, heldoutBookId: bookId, caseId: c.id });
    }
}
const sourceIds = ['published', 'pca-0', 'in-sample-cpca64', 'leave-book-cpca64'];
const holdoutSummary = topics.map((topic) => {
    const selected = folds.filter((f) => f.topic === topic && f.status === 'evaluated');
    const queries = selected.flatMap((f) => f.queries);
    return { topic, folds: selected.length, queries: queries.length, skipped: folds.filter((f) => f.topic === topic && f.status !== 'evaluated').length,
        sources: sourceIds.map((source) => ({ id: source,
            globalK30: equalBookSummary(queries.map((q) => ({ bookId: q.bookId, value: q.sources.find((s) => s.id === source)!.k[1]!.recall! }))),
            memberK5: equalBookSummary(queries.flatMap((q) => { const m = q.sources.find((s) => s.id === source)!.membersK5; return m.nontrivial ? [{ bookId: q.bookId, value: m.recall! }] : []; })),
        })) };
});
await mkdir(out, { recursive: true });
const report = {
    schemaVersion: 1, algorithm: 'pca-umap-book-holdout-study-v1', generatedAt: new Date().toISOString(),
    inputSha256: sha256(input), embeddingFileSha256: sha256(cacheText), baseImplementationSha256: baseline.implementationSha256,
    implementationSha256: sha256(await readFile('scripts/research/study-projection-pipeline-holdout.ts', 'utf8') + '\0' + await readFile('scripts/research/bookProjectionHoldout.ts', 'utf8')),
    parameters: { topics, alpha: 1, pcaDimensions: 64, pcaFittedAllPublic: true, leaveEntireBookFromBothCovariances: true, onlyCrossBookCandidates: true, umapSeed: MAP_LAYOUT_SEED, umap: parameters, umapDistance: 'euclidean', ks: [15, 30, 60], membersK: 5 },
    pipelineSummary, holdoutSummary, globalQueries, folds,
    runtime: { totalMilliseconds: Math.round(performance.now() - start), maxRssKiB: process.resourceUsage().maxRSS, node: process.version },
};
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(`${out}/viewer-supplement.json`, JSON.stringify({ inputSha256: report.inputSha256, views: [...pipelineViews, ...supplementalViews], crossBookReferences,
    summary: [
        ...pipelineSummary.map((s) => ({ id: s.id, recall30: s.k[1]!.medianRecall })),
        ...supplementalViews.map((v) => { const fold = folds.find((f) => f.topic === v.topic && f.bookId === v.heldoutBookId)!; return { id: v.id, recall30: median(fold.queries.map((q) => q.sources.find((s) => s.id === 'leave-book-cpca64')!.k[1]!.recall!)), sampleLabel: `留书跨书 · ${fold.queries.length} 查询` }; }),
    ],
}) + '\n', 'utf8');
const review = ['# R2-B: frozen case cross-book text packet', '', 'References and both views exclude the query source book. Conditional axes alone exclude the held book; shared PCA64 is transductive.', ''];
for (const c of uniqueCases) {
    const point = points[byId.get(c.id)!]!;
    const fold = folds.find((f) => f.topic === c.tagId && f.bookId === point.bookId)!;
    review.push(`## ${c.tagId} ${c.id} | ${books.get(point.bookId)!.title}`, '', point.text, '');
    const q = fold.queries.find((q) => q.id === c.id);
    if (q === undefined) { review.push(`Not evaluable: ${fold.status}`, ''); continue; }
    for (const source of ['original1024', 'in-sample-cpca64', 'leave-book-cpca64']) {
        const nearest = source === 'original1024' ? q.highNearest30 : q.sources.find((s) => s.id === source)!.nearest30;
        review.push(`### ${source}`, '');
        for (const id of nearest.slice(0, 5)) {
            const p = points[byId.get(id)!]!;
            review.push(`- ${id} | ${books.get(p.bookId)!.title} | ${p.tagIds.length === 0 ? 'unknown' : p.tagIds.join(', ')}`, '', p.text, '');
        }
    }
}
await writeFile(`${out}/nearest-text-review.md`, review.join('\n'), 'utf8');
console.log(JSON.stringify({ pipelineSummary, holdoutSummary: holdoutSummary.map((t) => ({ topic: t.topic, folds: t.folds, queries: t.queries, sources: t.sources.map((s) => ({ id: s.id, crossBook30: s.globalK30.mean, members5: s.memberK5.mean })) })), supplementalViews: supplementalViews.map((v) => v.id), runtime: report.runtime }, null, 2));
