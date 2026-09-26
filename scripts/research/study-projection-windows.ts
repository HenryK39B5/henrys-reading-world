import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { UMAP } from 'umap-js';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { cosineDistance, MAP_LAYOUT_SEED, mulberry32, normalizeMapPoints, projectForMap } from '../embeddings/mapLayout.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { anchorCandidates } from './localTopicAnchors.ts';
import { compareNeighborhoods, fitContrastive, fitPca, median, normalizeRows, orderedNeighbors, projectLinear, rotatePcaPlane } from './projectionWindows.ts';

const out = '.private/research/map/projection-window';
const started = performance.now();
const stageTimes: Record<string, number> = {};
const timed = (stage: string, start: number) => { stageTimes[stage] = Math.round(performance.now() - start); console.log(`${stage}: ${stageTimes[stage]}ms`); };
const foregroundIds = ['tag-026', 'tag-031', 'tag-050'] as const;
const alphas = [0, 1, 3] as const;
const input = await readFile('src/data/public-snapshot.json', 'utf8');
const validated = validateSnapshot(JSON.parse(input) as unknown, { expectedVisibility: 'public' });
if (!validated.ok) throw new Error(validated.errors.join('; '));
const snapshot = validated.snapshot;
if (snapshot.map === undefined) throw new Error('map required');
const cacheInput = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const cache = JSON.parse(cacheInput) as EmbeddingCache;
if (cache.provider !== 'local' || cache.dimensions !== 1024 || cache.model !== 'Xenova/bge-large-zh-v1.5@a48549b-q8-cls') throw new Error('fixed embedding cache mismatch');
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const ids = highlights.map((h) => h.id);
const indexById = new Map(ids.map((id, index) => [id, index]));
const vectors = normalizeRows(highlights.map((h) => {
    const cached = cache.vectors[h.id];
    if (cached === undefined || cached.textHash !== highlightTextHash(h) || cached.values.length !== 1024) throw new Error(`missing/stale cache ${h.id}`);
    return cached.values;
}));
const currentById = new Map(snapshot.map.points.map((p) => [p.highlightId, p]));
const current = ids.map((id) => { const p = currentById.get(id)!; return [p.x, p.y]; });
const researchPoints = highlights.map((h, i) => ({ id: h.id, bookId: h.bookId, tagIds: h.tagIds, x: current[i]![0]!, y: current[i]![1]! }));
const bookQueries = snapshot.books.map((book) => highlights.filter((h) => h.bookId === book.id)
    .map((h) => ({ id: h.id, hash: sha256(`r2-book-query-v1:${h.id}`) })).sort((a, b) => a.hash.localeCompare(b.hash))[0]!.id);
const cases = foregroundIds.flatMap((tagId) => {
    const candidates = anchorCandidates(researchPoints.filter((p) => p.tagIds.includes(tagId)));
    return ['localDensity', 'localBookCapped'].map((method) => ({ tagId, method, id: candidates[method as 'localDensity' | 'localBookCapped'].id }));
});
const queryIds = [...new Set([...bookQueries, ...cases.map((c) => c.id)])];
await mkdir(out, { recursive: true });
await writeFile(`${out}/frozen-queries.json`, JSON.stringify({ inputSha256: sha256(input), bookQueries, cases, queryIds }, null, 2) + '\n', 'utf8');
console.log(`Frozen queries ${queryIds.length}, public rows ${vectors.length}, original dimensions 1024`);
let mark = performance.now();
const pca = fitPca(vectors, 64);
const scores = projectLinear(vectors, pca);
timed('pca1024To64', mark);
const rp = vectors.map((v) => projectForMap(v));
const parameters = { nNeighbors: 24, minDist: 0.14, spread: 1.25, nEpochs: 350 };
mark = performance.now();
const umap = new UMAP({ nComponents: 2, ...parameters, distanceFn: cosineDistance, random: mulberry32(MAP_LAYOUT_SEED) });
const publicUmap = await umap.fitAsync(rp, (epoch) => { if (epoch > 0 && epoch % 100 === 0) console.log(`Public UMAP epoch ${epoch}/350`); });
timed('publicUmap96', mark);

type View = { id: string; title: string; coordinates: number[][]; topic: string | null; alpha: number | null; theta: number | null };
const publicNormalized = normalizeMapPoints(ids.map((highlightId, i) => ({ highlightId, x: publicUmap[i]![0]!, y: publicUmap[i]![1]! }))).map((p) => [p.x, p.y]);
const views: View[] = [
    { id: 'published', title: '线上坐标', coordinates: current, topic: null, alpha: null, theta: null },
    { id: 'public-umap', title: '公开 UMAP · 生产归一化', coordinates: publicNormalized, topic: null, alpha: null, theta: null },
    { id: 'public-umap-raw', title: '公开 UMAP · 原始输出', coordinates: publicUmap, topic: null, alpha: null, theta: null },
    ...[0, 30, 60, 90].map((theta) => ({ id: `pca-${theta}`, title: `全局 PCA · ${theta}°`, coordinates: rotatePcaPlane(scores, theta), topic: null, alpha: null, theta })),
];
const contrastModels = [];
for (const topic of foregroundIds) {
    mark = performance.now();
    const mask = highlights.map((h) => h.tagIds.includes(topic));
    const fg = scores.filter((_, i) => mask[i]);
    const bg = scores.filter((_, i) => !mask[i]);
    for (const alpha of alphas) {
        const model = fitContrastive(fg, bg, alpha);
        const coordinates = projectLinear(scores, model);
        const title = snapshot.tags.find((tag) => tag.id === topic)!.title;
        views.push({ id: `cpca-${topic}-${alpha}`, title: `${title} cPCA · α=${alpha}`, coordinates, topic, alpha, theta: null });
        contrastModels.push({ topic, alpha, inputDimensions: 64, foregroundCount: fg.length, backgroundCount: bg.length, ...model });
    }
    timed(`contrastive-${topic}`, mark);
    mark = performance.now();
    const full = fitContrastive(vectors.filter((_, i) => mask[i]), vectors.filter((_, i) => !mask[i]), 1);
    full.mean = pca.mean;
    const coordinates = projectLinear(vectors, full);
    const title = snapshot.tags.find((tag) => tag.id === topic)!.title;
    views.push({ id: `cpca1024-${topic}-1`, title: `${title} cPCA1024 · α=1`, coordinates, topic, alpha: 1, theta: null });
    contrastModels.push({ topic, alpha: 1, inputDimensions: 1024, foregroundCount: fg.length, backgroundCount: bg.length, ...full });
    timed(`contrastive1024-${topic}`, mark);
}
if (views.some((v) => v.coordinates.length !== ids.length || v.coordinates.some((row) => row.length !== 2 || row.some((x) => !Number.isFinite(x))))) throw new Error('invalid observation coordinates');

mark = performance.now();
const spaces = [
    { id: 'rp96', rows: rp, metric: 'cosine-unit' as const },
    { id: 'pca64', rows: scores, metric: 'euclidean' as const },
    ...views.map((v) => ({ id: v.id, rows: v.coordinates, metric: 'euclidean' as const })),
];
const queries = queryIds.map((id, qi) => {
    const index = indexById.get(id)!;
    const reference = orderedNeighbors(vectors, ids, index, 'cosine-unit');
    const referenceRanks = new Map(reference.map((r, rank) => [r.index, rank + 1]));
    const bySpace = spaces.map((space) => {
        const ordered = orderedNeighbors(space.rows, ids, index, space.metric);
        return {
            space: space.id,
            k: [15, 30, 60].map((k) => compareNeighborhoods(reference, ordered, k)),
            tiesK30: compareNeighborhoods(reference, ordered, 30, true),
            nearest60: ordered.slice(0, 60).map((r) => ({ id: ids[r.index]!, distance: r.distance, highRank: referenceRanks.get(r.index)! })),
        };
    });
    if (qi % 20 === 0) console.log(`Neighborhood query ${qi + 1}/${queryIds.length}`);
    return { id, bookSample: bookQueries.includes(id), referenceNearest60: reference.slice(0, 60).map((r) => ({ id: ids[r.index]!, distance: r.distance })), bySpace };
});
timed('neighborhoodAudits', mark);
const summary = ['book-sample', 'case-queries', 'all'].map((group) => {
    const selected = queries.filter((q) => group === 'book-sample' ? q.bookSample : group === 'case-queries' ? cases.some((c) => c.id === q.id) : true);
    return {
        group, count: selected.length,
        spaces: spaces.map((s) => ({ space: s.id, k: [15, 30, 60].map((k, ki) => {
            const metrics = selected.map((q) => q.bySpace.find((entry) => entry.space === s.id)!.k[ki]!);
            return {
                k, medianRecall: median(metrics.map((m) => m.recall!)), meanRecall: metrics.reduce((sum, m) => sum + m.recall!, 0) / metrics.length,
                medianMeanNormalizedHighRank: median(metrics.map((m) => m.meanNormalizedHighRank!)),
                medianOutsideHighTopTenPercentShare: median(metrics.map((m) => m.outsideHighTopTenPercentShare!)),
            };
        }) })),
    };
});
const withinTopic = foregroundIds.map((topic) => {
    const memberIndices = highlights.flatMap((h, i) => h.tagIds.includes(topic) ? [i] : []);
    const memberIds = memberIndices.map((i) => ids[i]!);
    const memberVectors = memberIndices.map((i) => vectors[i]!);
    const memberSpaces = spaces.map((s) => ({ ...s, rows: memberIndices.map((i) => s.rows[i]!) }));
    const perMember = memberIds.map((id, index) => {
        const high = orderedNeighbors(memberVectors, memberIds, index, 'cosine-unit');
        return { id, spaces: memberSpaces.map((space) => ({ space: space.id, k: [5, 10].map((k) => compareNeighborhoods(high, orderedNeighbors(space.rows, memberIds, index, space.metric), k)) })) };
    });
    return {
        topic, count: memberIds.length, perMember,
        spaces: memberSpaces.map((s) => ({ space: s.id, k: [5, 10].map((k, ki) => {
            const values = perMember.map((m) => m.spaces.find((x) => x.space === s.id)!.k[ki]!.recall!);
            const chance = Math.min(k, memberIds.length - 1) / (memberIds.length - 1);
            return { k, chanceRecall: chance, medianRecall: median(values), meanRecall: values.reduce((a, b) => a + b, 0) / values.length, medianChanceCorrectedRecall: chance === 1 ? null : (median(values) - chance) / (1 - chance) };
        }) })),
    };
});
const fearIds = cases.filter((c) => c.tagId === 'tag-026').map((c) => c.id);
const fearOrders = fearIds.map((id) => orderedNeighbors(vectors, ids, indexById.get(id)!, 'cosine-unit'));
const fearPair = {
    ids: fearIds,
    mutualHighRanks: fearOrders.map((rows, i) => rows.findIndex((r) => ids[r.index] === fearIds[1 - i]) + 1),
    cosineDistance: fearOrders[0]!.find((r) => ids[r.index] === fearIds[1])!.distance,
    highK30Overlap: fearOrders[0]!.slice(0, 30).filter((r) => fearOrders[1]!.slice(0, 30).some((s) => s.index === r.index)).length,
};
const report = {
    schemaVersion: 1, algorithm: 'projection-window-study-v1', generatedAt: new Date().toISOString(),
    implementationSha256: sha256(await readFile('scripts/research/projectionWindows.ts', 'utf8') + '\0' + await readFile('scripts/research/study-projection-windows.ts', 'utf8')),
    inputSha256: sha256(input), embeddingFileSha256: sha256(cacheInput), mapVersion: snapshot.map.version,
    model: { provider: cache.provider, name: cache.model, dimensions: cache.dimensions, cacheGeneratedAt: cache.generatedAt },
    parameters: { foregroundIds, alphas, pcaDimensions: 64, publicUmapNormalization: 'production-1pct-axis-clipping-and-integer-plus-raw-control', normalizeRows: true, featureStandardize: false, umapSeed: MAP_LAYOUT_SEED, umap: parameters, ks: [15, 30, 60], tieTolerance: 1e-12, supplement: { fullContrastDimensions: 1024, fullContrastAlpha: 1, withinTopicKs: [5, 10], preregisteredAfterFirstGlobalResults: true }, queryRule: 'sha256-r2-book-query-v1-plus-r1-anchors', publishedFittingRows: 4663, experimentFittingRows: ids.length },
    pca: { retainedVariance64: pca.eigenvalues.slice(0, 64).reduce((a, b) => a + b, 0) / pca.totalVariance, firstTwoVariance: (pca.eigenvalues[0]! + pca.eigenvalues[1]!) / pca.totalVariance, ...pca },
    contrastModels, cases, queryIds, summary, withinTopic, fearPair, queries,
    runtime: { stageMilliseconds: stageTimes, totalMilliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version, matrix: '6.15.0', umap: '1.4.0' },
};
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n', 'utf8');
const books = new Map(snapshot.books.map((b) => [b.id, b]));
const byId = new Map(highlights.map((h) => [h.id, h]));
const review = ['# R2: frozen case-query original-text contrasts', '', `Input SHA256: ${report.inputSha256}`, '', 'Five nearest actual records per representation; unknown/other tags are not confirmed negatives.', 'Cosine neighbors are model evidence, not semantic ground truth. This is not complete book context.', ''];
for (const c of cases) {
    const query = byId.get(c.id)!;
    const evidence = queries.find((q) => q.id === c.id)!;
    review.push(`## ${c.tagId} ${c.method} ${c.id}`, '', `Source: ${books.get(query.bookId)!.title}`, '', query.text, '');
    for (const space of ['original1024', 'published', `cpca-${c.tagId}-1`, `cpca1024-${c.tagId}-1`]) {
        const neighbors = space === 'original1024' ? evidence.referenceNearest60 : evidence.bySpace.find((s) => s.space === space)!.nearest60;
        review.push(`### ${space}`, '');
        for (const neighbor of neighbors.slice(0, 5)) {
            const h = byId.get(neighbor.id)!;
            review.push(`- ${h.id} | ${books.get(h.bookId)!.title} | ${h.tagIds.length === 0 ? 'unknown' : h.tagIds.join(', ')} | ${'highRank' in neighbor ? `high rank ${neighbor.highRank}` : 'high-dimensional neighbor'}`, '', h.text, '');
        }
    }
}
await writeFile(`${out}/nearest-text-review.md`, review.join('\n'), 'utf8');
const viewer = {
    schemaVersion: 1, inputSha256: report.inputSha256, sourceModel: cache.model,
    points: highlights.map((h, index) => ({ id: h.id, bookId: h.bookId, source: books.get(h.bookId)!.title, author: books.get(h.bookId)!.author, text: h.text, tags: h.tagIds, pc4: scores[index]!.slice(0, 4) })),
    tagTitles: Object.fromEntries(snapshot.tags.map((t) => [t.id, t.title])),
    topics: snapshot.tags.filter((t) => foregroundIds.includes(t.id as typeof foregroundIds[number])).map((t) => ({ id: t.id, title: t.title, count: highlights.filter((h) => h.tagIds.includes(t.id)).length })),
    views, cases, queries: queries.map((q) => ({ id: q.id, referenceNearest30: q.referenceNearest60.slice(0, 30).map((r) => r.id) })),
    summary: summary.find((s) => s.group === 'book-sample')!.spaces.map((s) => ({ id: s.space, recall30: s.k[1]!.medianRecall })),
};
await writeFile(`${out}/viewer-data.json`, JSON.stringify(viewer) + '\n', 'utf8');
console.log(JSON.stringify({ pcaRetained64: report.pca.retainedVariance64, pcaFirst2: report.pca.firstTwoVariance, fearPair, runtime: report.runtime, summary: summary[0] }, null, 2));
console.log(`Local-only outputs: ${out}`);
