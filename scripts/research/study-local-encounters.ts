import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { indexSnapshot } from '../../src/domain/snapshot.ts';
import type { Snapshot } from '../../src/domain/types.ts';
import { mapReadingWindow, otherBooksInWindow } from '../../src/domain/mapReading.ts';
import { highlightTextHash, type EmbeddingCache } from '../embeddings/core.ts';
import { compareLocalEncounters, median, stableUnit, type LocalEncounterComparison } from './localEncounterEvidence.ts';

const OUTPUT = '.private/research/map/local-encounters';
const VECTORS = '.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json';
const SEED = 'local-encounters-2026-09-28-v1';
const CASES = ['h-025', 'h-2288', 'h-3501', 'h-4504', 'h-043'];
const WIDTH = 720; const HEIGHT = 520; const ZOOM = 4;
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const started = performance.now();

const [snapshotText, vectorText, previousText, implementation, driver] = await Promise.all([
    readFile('src/data/public-snapshot.json', 'utf8'), readFile(VECTORS, 'utf8'),
    readFile('.private/research/map/graph-islands/study.json', 'utf8'),
    readFile('scripts/research/localEncounterEvidence.ts', 'utf8'), readFile('scripts/research/study-local-encounters.ts', 'utf8'),
]);
const snapshotSha = sha(snapshotText); const vectorSha = sha(vectorText);
const previous = JSON.parse(previousText) as { snapshotSha256: string; embeddingCacheSha256: string };
if (previous.snapshotSha256 !== snapshotSha || previous.embeddingCacheSha256 !== vectorSha) throw new Error('published input or local vector cache drifted from R4-E');
const snapshot = JSON.parse(snapshotText) as Snapshot;
const cache = JSON.parse(vectorText) as EmbeddingCache;
if (cache.provider !== 'local' || cache.dimensions !== 1024 || cache.model !== 'Xenova/bge-large-zh-v1.5@a48549b-q8-cls') throw new Error('unexpected embedding cache');
const index = indexSnapshot(snapshot);
const points = new Map(snapshot.map?.points.map((point) => [point.highlightId, point]) ?? []);
if (points.size !== snapshot.highlights.length) throw new Error('published map must cover every highlight exactly once');
const normalized = new Map<string, Float32Array>();
for (const highlight of snapshot.highlights) {
    const cached = cache.vectors[highlight.id];
    if (cached === undefined || cached.textHash !== highlightTextHash(highlight) || cached.values.length !== 1024 ||
        cached.values.some((value) => !Number.isFinite(value))) throw new Error(`missing or stale public vector for ${highlight.id}`);
    let normSquared = 0;
    for (const value of cached.values) normSquared += value * value;
    const norm = Math.sqrt(normSquared);
    if (norm <= 0) throw new Error(`zero vector for ${highlight.id}`);
    normalized.set(highlight.id, Float32Array.from(cached.values, (value) => value / norm));
}
function cosine(a: string, b: string): number {
    const left = normalized.get(a); const right = normalized.get(b);
    if (left === undefined || right === undefined) throw new Error('comparison escapes the approved corpus');
    let dot = 0;
    for (let i = 0; i < left.length; i += 1) dot += left[i]! * right[i]!;
    return dot;
}

const anchorIds: string[] = [];
for (const book of [...index.booksInUse].sort((a, b) => a.id.localeCompare(b.id))) {
    const rows = [...index.highlightsByBook.get(book.id) ?? []].sort((a, b) => a.id.localeCompare(b.id));
    if (rows.length === 0) throw new Error('book in use has no highlights');
    const first = Math.floor(stableUnit(`${SEED}|${book.id}|first`) * rows.length);
    anchorIds.push(rows[first]!.id);
    if (rows.length > 1) {
        const next = 1 + Math.floor(stableUnit(`${SEED}|${book.id}|second`) * (rows.length - 1));
        anchorIds.push(rows[(first + next) % rows.length]!.id);
    }
}

const comparisons: LocalEncounterComparison[] = [];
let anchorsWithoutOtherBook = 0;
let selectedSinglePointBooks = 0;
const invariance: Array<{ anchorId: string; canvas: string; missing: number; extra: number; bookOrderChanged: boolean }> = [];
const windows = new Map<string, ReturnType<typeof mapReadingWindow>>();
function windowFor(id: string) {
    const point = points.get(id);
    if (point === undefined) throw new Error(`no map point for ${id}`);
    return mapReadingWindow(index, { centerX: point.x, centerY: point.y, zoom: ZOOM }, WIDTH, HEIGHT);
}
for (const id of anchorIds) {
    const window = windowFor(id);
    windows.set(id, window);
    const anchor = window.entries.find((entry) => entry.highlight.id === id);
    if (anchor === undefined) throw new Error(`circle lost its actual centre ${id}`);
    const others = otherBooksInWindow(window, anchor);
    if (others.length === 0) anchorsWithoutOtherBook++;
    for (const group of others.slice(0, 2)) {
        const row = compareLocalEncounters(window, id, group.book.id, cosine, stableUnit(`${SEED}|${id}|${group.book.id}|control`));
        if (row === null) throw new Error('selected book fell out of its own circle');
        if (row.otherBookWindowCount === 1) selectedSinglePointBooks++;
        comparisons.push(row);
    }
}
for (const id of anchorIds.slice(0, 24)) {
    const point = points.get(id)!;
    const base = windows.get(id)!;
    for (const [width, height] of [[390, 520], [320, 500]]) {
        const resized = mapReadingWindow(index, { centerX: point.x, centerY: point.y, zoom: ZOOM }, width!, height!);
        const baseIds = new Set(base.entries.map((entry) => entry.highlight.id));
        const nextIds = new Set(resized.entries.map((entry) => entry.highlight.id));
        invariance.push({ anchorId: id, canvas: `${width}x${height}`,
            missing: [...baseIds].filter((entry) => !nextIds.has(entry)).length,
            extra: [...nextIds].filter((entry) => !baseIds.has(entry)).length,
            bookOrderChanged: resized.books.slice(0, 3).map((group) => group.book.id).join(',') !== base.books.slice(0, 3).map((group) => group.book.id).join(',') });
    }
}

const eligible = comparisons.filter((row) => row.otherBookWindowCount > 1);
const mean = (values: number[]): number | null => values.length === 0 ? null : values.reduce((sum, n) => sum + n, 0) / values.length;
const perBook = new Map<string, number[]>();
for (const row of eligible) perBook.set(row.anchorBookId, [...(perBook.get(row.anchorBookId) ?? []), row.actual.cosine - row.control.cosine]);
const actualAndControlKnown = eligible.filter((row) => row.actual.bothReviewed && row.control.bothReviewed);
const actualAndModelKnown = eligible.filter((row) => row.actual.bothReviewed && row.model.bothReviewed);
function stratum(rows: LocalEncounterComparison[]) {
    const known = rows.filter((row) => row.actual.bothReviewed && row.control.bothReviewed);
    return { cases: rows.length, anchorBooks: new Set(rows.map((row) => row.anchorBookId)).size,
        actualMinusControlMean: mean(rows.map((row) => row.actual.cosine - row.control.cosine)),
        actualMinusControlMedian: median(rows.map((row) => row.actual.cosine - row.control.cosine)),
        modelChanges: rows.filter((row) => row.actual.id !== row.model.id).length,
        modelMinusActualDistanceMedian: median(rows.map((row) => row.model.distance - row.actual.distance)),
        knownActualControl: known.length,
        sharedActual: known.filter((row) => row.actual.sharedReviewedTagIds.length > 0).length,
        sharedControl: known.filter((row) => row.control.sharedReviewedTagIds.length > 0).length };
}
const summary = {
    anchorCount: anchorIds.length,
    anchorBookCount: new Set(anchorIds.map((id) => index.highlightsById.get(id)!.bookId)).size,
    anchorsWithoutOtherBook,
    comparisonCount: comparisons.length,
    selectedSinglePointBooks,
    eligibleCount: eligible.length,
    eligibleAnchorBookCount: perBook.size,
    sameActualAsModel: eligible.filter((row) => row.actual.id === row.model.id).length,
    sameActualAsControl: eligible.filter((row) => row.actual.id === row.control.id).length,
    actualMinusControlCosineMean: mean(eligible.map((row) => row.actual.cosine - row.control.cosine)),
    actualMinusControlCosineMedian: median(eligible.map((row) => row.actual.cosine - row.control.cosine)),
    bookBalancedActualMinusControlCosineMean: mean([...perBook.values()].map((values) => mean(values)!)),
    bookBalancedActualMinusControlCosineMedian: median([...perBook.values()].map((values) => mean(values)!)),
    byChosenBookWindowCount: {
        sparseTwoToThree: stratum(eligible.filter((row) => row.otherBookWindowCount <= 3)),
        mediumFourToNine: stratum(eligible.filter((row) => row.otherBookWindowCount >= 4 && row.otherBookWindowCount <= 9)),
        denseTenOrMore: stratum(eligible.filter((row) => row.otherBookWindowCount >= 10)),
    },
    byAnchorReviewedState: {
        reviewed: stratum(eligible.filter((row) => row.anchorHasReviewedTag)),
        unknown: stratum(eligible.filter((row) => !row.anchorHasReviewedTag)),
    },
    actualHigherCosineThanControl: eligible.filter((row) => row.actual.cosine > row.control.cosine + 1e-7).length,
    actualLowerCosineThanControl: eligible.filter((row) => row.actual.cosine + 1e-7 < row.control.cosine).length,
    modelMinusActualCosineMedian: median(eligible.map((row) => row.model.cosine - row.actual.cosine)),
    modelMinusActualDistanceMedian: median(eligible.map((row) => row.model.distance - row.actual.distance)),
    modelOverTwiceActualDistance: eligible.filter((row) => row.actual.distance > 0 && row.model.distance > row.actual.distance * 2).length,
    anchorReviewedCount: eligible.filter((row) => row.anchorHasReviewedTag).length,
    knownActualControlCount: actualAndControlKnown.length,
    actualSharedReviewedCount: actualAndControlKnown.filter((row) => row.actual.sharedReviewedTagIds.length > 0).length,
    controlSharedReviewedCount: actualAndControlKnown.filter((row) => row.control.sharedReviewedTagIds.length > 0).length,
    knownActualModelCount: actualAndModelKnown.length,
    modelSharedReviewedCount: actualAndModelKnown.filter((row) => row.model.sharedReviewedTagIds.length > 0).length,
    knownActualModelSharedReviewedCount: actualAndModelKnown.filter((row) => row.actual.sharedReviewedTagIds.length > 0).length,
    aspectRatioChecks: invariance.length,
    aspectRatioMismatches: invariance.filter((row) => row.missing || row.extra || row.bookOrderChanged).length,
};

const changed = eligible.filter((row) => row.actual.id !== row.model.id);
const largestModelGain = [...changed].sort((a, b) =>
    (b.model.cosine - b.actual.cosine) - (a.model.cosine - a.actual.cosine) || a.anchorId.localeCompare(b.anchorId)).slice(0, 4);
const smallestBaselineDelta = [...eligible].sort((a, b) =>
    Math.abs(a.actual.cosine - a.control.cosine) - Math.abs(b.actual.cosine - b.control.cosine) || a.anchorId.localeCompare(b.anchorId)).slice(0, 4);
const fixedCases = CASES.map((id) => {
    if (!index.highlightsById.has(id)) return { id, status: 'not-in-public-snapshot' };
    const window = windows.get(id) ?? windowFor(id);
    const anchor = window.entries.find((entry) => entry.highlight.id === id)!;
    const book = otherBooksInWindow(window, anchor)[0];
    if (book === undefined) return { id, status: 'no-other-book-in-circle' };
    return { id, status: 'compared', comparison: compareLocalEncounters(window, id, book.book.id, cosine, stableUnit(`${SEED}|${id}|${book.book.id}|control`)) };
});
const reviewSlots = [
    ...largestModelGain.map((row) => ({ reason: 'largest-model-gain', row })),
    ...smallestBaselineDelta.map((row) => ({ reason: 'smallest-actual-control-gap', row })),
    ...fixedCases.filter((row) => row.status === 'compared').slice(0, 4).map((item) => ({ reason: 'predeclared-counterexample', row: item.comparison! })),
];
function original(id: string): string {
    const h = index.highlightsById.get(id); const book = h === undefined ? undefined : index.booksById.get(h.bookId);
    if (h === undefined || book === undefined) throw new Error('review original not in public snapshot');
    return `《${book.title}》${book.author} [${id}] ${h.text}`;
}
const review = ['# 真实原文核对包（非盲审；模型增幅不是语义真值）', '',
    ...reviewSlots.flatMap(({ reason, row }, i) => [
        `## ${String(i + 1)}. ${reason} · 锚点 ${row.anchorId} → 《${index.booksById.get(row.otherBookId)!.title}》`,
        `候选书圈内 ${row.otherBookWindowCount} 句；A/B/C 原向量cos ${row.actual.cosine.toFixed(4)} / ${row.model.cosine.toFixed(4)} / ${row.control.cosine.toFixed(4)}；二维距离 ${row.actual.distance.toFixed(0)} / ${row.model.distance.toFixed(0)} / ${row.control.distance.toFixed(0)}。共有已审Tag为真实交集，不作为好坏打分。`,
        '', `① ${original(row.anchorId)}`, '', `A 当前：${original(row.actual.id)}`, '',
        `B 原空间：${original(row.model.id)}`, '', `C 同书随机：${original(row.control.id)}`, '',
        '研究者原文判断：待核对（不得由脚本代填）', '',
    ])
].join('\n');
const inputs = { snapshotSha256: snapshotSha, vectorCacheSha256: vectorSha,
    implementationSha256: sha(implementation + '\0' + driver), model: cache.model };
const parameters = { seed: SEED, zoom: ZOOM, canvas: [WIDTH, HEIGHT],
    anchorSampling: 'one/two fixed hashed IDs per book', selectedOtherBooks: 2,
    actual: 'closest existing published 2D point in reader-selected book and circle',
    model: 'highest normalized local 1024d cosine within same book and circle',
    control: 'uniform deterministic hashed draw from same book and circle',
    reviewedTags: 'shared tag only when both passages were reviewed; unknown is not negative' };
const canonical = { schemaVersion: 1, inputs, parameters, summary, invariance, fixedCases, reviewSlots: reviewSlots.map(({ reason, row }) => ({ reason, anchorId: row.anchorId, bookId: row.otherBookId, ids: [row.actual.id, row.model.id, row.control.id] })), comparisons };
await mkdir(OUTPUT, { recursive: true });
await Promise.all([
    writeFile(`${OUTPUT}/canonical.json`, `${JSON.stringify(canonical, null, 2)}\n`),
    writeFile(`${OUTPUT}/review.md`, `${review}\n`),
    writeFile(`${OUTPUT}/run.json`, `${JSON.stringify({ canonicalSha256: sha(`${JSON.stringify(canonical, null, 2)}\n`), inputs, parameters,
        runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } }, null, 2)}\n`),
]);
console.log(JSON.stringify({ output: OUTPUT, ...summary, canonicalSha256: sha(`${JSON.stringify(canonical, null, 2)}\n`) }, null, 2));
