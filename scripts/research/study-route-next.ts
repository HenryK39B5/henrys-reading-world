import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deterministicNext, type NextData } from './routeNext.mjs';

const started = performance.now(); const dir = '.private/research/map/route-first';
const raw = await readFile(`${dir}/viewer-data.json`, 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const viewerSha256 = sha256(raw);
if (viewerSha256 !== 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d') throw new Error('frozen viewer changed');
const data = JSON.parse(raw) as NextData & { inputSha256: string; seeds: string[];
    points: Record<string, { id: string; bookId: string; bookTitle: string; text: string }>;
    publishedMap: { points: { highlightId: string; x: number; y: number }[] } };
const byMapId = new Map(data.publishedMap.points.map((point) => [point.highlightId, point]));
const fixed = new Set(['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754']);
if (data.seeds.length !== 11 || fixed.size !== 5 || data.publishedMap.points.length !== 3462 ||
    data.inputSha256 !== sha256(await readFile('src/data/public-snapshot.json', 'utf8'))) throw new Error('study data drift');
const records = data.seeds.map((seed) => {
    const trail = [seed]; const steps: { fromId: string; toId: string; rank: number; band: string | null; bandFallback: boolean; bookFallback: boolean;
        publishedDistance: number; publishedRank: number; fromBook: string; toBook: string; fromText?: string; toText?: string }[] = [];
    let status = 'limit';
    for (let index = 0; index < 6; index += 1) {
        const chosen = deterministicNext(data, trail);
        if (chosen.status !== 'ready') { status = chosen.status; break; }
        const fromId = trail.at(-1)!; const toId = chosen.candidate!.id;
        const from = byMapId.get(fromId)!; const to = byMapId.get(toId)!;
        if (!from || !to || data.points[fromId]!.bookId === data.points[toId]!.bookId || trail.includes(toId)) throw new Error('invalid real step');
        const squared = (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
        const publishedRank = 1 + data.publishedMap.points.filter((point) => point.highlightId !== fromId &&
            ((from.x - point.x) ** 2 + (from.y - point.y) ** 2 < squared ||
                ((from.x - point.x) ** 2 + (from.y - point.y) ** 2 === squared && point.highlightId < toId))).length;
        steps.push({ fromId, toId, rank: chosen.candidate!.rank, band: chosen.expectedBand, bandFallback: chosen.bandFallback,
            bookFallback: chosen.bookFallback, publishedDistance: Math.sqrt(squared) / (10_000 * Math.SQRT2), publishedRank,
            fromBook: data.points[fromId]!.bookTitle, toBook: data.points[toId]!.bookTitle,
            ...(fixed.has(seed) ? { fromText: data.points[fromId]!.text, toText: data.points[toId]!.text } : {}) });
        trail.push(toId);
    }
    return { seed, status, trail, steps };
});
const total = records.reduce((sum, record) => sum + record.steps.length, 0);
const summary = { seeds: records.length, distinctFixed: fixed.size, fullSix: records.filter((record) => record.status === 'limit').length,
    deadEnds: records.filter((record) => record.status === 'dead-end').map((record) => ({ seed: record.seed, steps: record.steps.length })),
    steps: total, bandFallback: records.reduce((sum, record) => sum + record.steps.filter((step) => step.bandFallback).length, 0),
    bookFallback: records.reduce((sum, record) => sum + record.steps.filter((step) => step.bookFallback).length, 0),
    farthestMapSteps: records.flatMap((record) => record.steps.map((step) => ({ seed: record.seed, ...step }))).sort((a, b) => b.publishedDistance - a.publishedDistance).slice(0, 6)
        .map((step) => ({ seed: step.seed, fromId: step.fromId, toId: step.toId, modelRank: step.rank, publishedRank: step.publishedRank, publishedDistance: step.publishedDistance })) };
const report = { algorithm: 'local-route-next-v1', inputSha256: data.inputSha256, viewerSha256,
    routeRuleSha256: sha256(await readFile('scripts/research/routeNext.mjs', 'utf8')),
    implementationSha256: sha256(await readFile('scripts/research/study-route-next.ts', 'utf8')),
    parameters: { rhythm: ['inner', 'side', 'outer', 'side', 'inner', 'outer'], originalNeighbors: 16,
        seededBy: 'FNV1a32(route-next-v1|full-history-IDs) -> mulberry32', maxSteps: 6, mapUsedForSelection: false },
    generatedAt: new Date().toISOString(), runtime: { milliseconds: Math.round(performance.now() - started), node: process.version, maxRssKiB: process.resourceUsage().maxRSS }, summary, records };
await mkdir(`${dir}/next-step`, { recursive: true });
await writeFile(`${dir}/next-step/study.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
