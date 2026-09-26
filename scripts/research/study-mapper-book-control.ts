import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { highlightTextHash, sha256, type EmbeddingCache } from '../embeddings/core.ts';
import { MAP_LAYOUT_SEED, mulberry32 } from '../embeddings/mapLayout.ts';
import { normalizeRows, median } from './projectionWindows.ts';
import { matchedCasePairs, type MatchedPair } from './mapperBookControl.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import type { MapperPoint } from './mapperBaseline.ts';
import type { PartitionGraph } from './mapperPartition.ts';

const started = performance.now();
const out = '.private/research/map/mapper-book-control';
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const checked = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!checked.ok) throw new Error(checked.errors.join('; '));
const snapshot = checked.snapshot;
const cacheText = await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json', 'utf8');
const previousText = await readFile('.private/research/map/mapper-partition/study.json', 'utf8');
const previous = JSON.parse(previousText) as { inputSha256: string; embeddingFileSha256: string; lensArtifactSha256: string; implementationSha256: string; graphs: Record<string, PartitionGraph> };
const lensText = await readFile('.private/research/map/mapper-baseline/study.json', 'utf8');
const lens = JSON.parse(lensText) as { inputSha256: string; embeddingFileSha256: string; lens: { pc1Scores: number[]; pc2Scores: number[] } };
const snapshotSha = sha256(snapshotText); const cacheSha = sha256(cacheText);
if (snapshotSha !== previous.inputSha256 || snapshotSha !== lens.inputSha256 || cacheSha !== previous.embeddingFileSha256 || cacheSha !== lens.embeddingFileSha256 || sha256(lensText) !== previous.lensArtifactSha256) throw new Error('R4-C input or lens artifact changed');
const r4cImplementation = sha256(await readFile('scripts/research/mapperPartition.ts', 'utf8') + '\0' + await readFile('scripts/research/study-mapper-partition.ts', 'utf8') + '\0' + await readFile('scripts/embeddings/clustering.ts', 'utf8'));
if (r4cImplementation !== previous.implementationSha256) throw new Error('R4-C implementation changed');
const cache = JSON.parse(cacheText) as EmbeddingCache;
const highlights = [...snapshot.highlights].sort((a, b) => a.id.localeCompare(b.id));
const vectors = normalizeRows(highlights.map((highlight) => {
    const entry = cache.vectors[highlight.id];
    if (entry === undefined || entry.textHash !== highlightTextHash(highlight)) throw new Error(`stale vector ${highlight.id}`);
    return entry.values;
}));
const points: MapperPoint[] = highlights.map((highlight, index) => ({ id: highlight.id, values: vectors[index]!, bookId: highlight.bookId, tagIds: highlight.tagIds }));
const byHighlight = new Map(highlights.map((highlight) => [highlight.id, highlight]));
const cases = ['h-3501', 'h-898', 'h-2288', 'h-4504', 'h-1754'];
const configurations = ['pc1-c8-t32', 'pc1-c8-t64', 'pc2-c8-t32', 'pc2-c8-t64'];
const seedFor = (value: string) => (MAP_LAYOUT_SEED + Number.parseInt(sha256(value).slice(0, 8), 16)) >>> 0;
type Attempt = { configuration: string; caseId: string; role: 'nearest' | 'farthest'; status: 'ready' | 'missing-node' | 'no-cross-book-member' | 'no-matched-control'; pair?: MatchedPair; itemId?: string; order?: 'member-first' | 'control-first' };
const attempts: Attempt[] = [];
const packet: string[] = ['# R4-D 原文对照（身份隐藏）', '', '每组比较同一锚点与 A、B 两条真实划线。请先独立作答，再看单独保存的答案键。请判断语义关系，不因共用一个词、相同文体或书籍印象直接判为相关。', '', '每组填写：`A / B / 两者相近 / 都不相关 / 无法判断`；再写一句理由、是否仅为字面相似、是否缺少上下文。此文件故意没有答案或预填评价。', ''];
const key: Array<{ itemId: string; configuration: string; caseId: string; role: 'nearest' | 'farthest'; nodeId: string; anchorBookId: string; memberId: string; memberBookId: string; controlId: string; controlBookId: string; memberOption: 'A' | 'B'; controlPoolSize: number; memberSimilarity: number; controlSimilarity: number }> = [];
for (const configuration of configurations) {
    const graph = previous.graphs[configuration];
    if (!graph) throw new Error(`missing frozen graph ${configuration}`);
    const rawScores = configuration.startsWith('pc1') ? lens.lens.pc1Scores : lens.lens.pc2Scores;
    if (rawScores.length !== points.length) throw new Error('lens score length mismatch');
    for (const caseId of cases) {
        let drawIndex = 0;
        const pairs = matchedCasePairs(points, rawScores, graph, caseId, () => mulberry32(seedFor(`${configuration}:${caseId}:${drawIndex++ === 0 ? 'nearest' : 'farthest'}`))());
        if (pairs.length === 0) {
            const status = graph.nodes.some((node) => node.memberIds.includes(caseId)) ? 'no-cross-book-member' : 'missing-node';
            for (const role of ['nearest', 'farthest'] as const) attempts.push({ configuration, caseId, role, status });
            continue;
        }
        for (const pair of pairs) {
            if (pair.controlId === null || pair.controlSimilarity === null) {
                attempts.push({ configuration, caseId, role: pair.role, status: 'no-matched-control', pair });
                continue;
            }
            const itemId = `R4D-${String(key.length + 1).padStart(3, '0')}`;
            const memberOption: 'A' | 'B' = mulberry32(seedFor(`order:${configuration}:${caseId}:${pair.role}`))() < .5 ? 'A' : 'B';
            const anchor = byHighlight.get(caseId)!;
            const member = byHighlight.get(pair.memberId)!;
            const control = byHighlight.get(pair.controlId)!;
            const choices = memberOption === 'A' ? [member, control] : [control, member];
            packet.push(`## ${itemId}`, '', `锚点：${anchor.text}`, '', `A：${choices[0]!.text}`, '', `B：${choices[1]!.text}`, '', '选择：____   理由：____   字面相似或文体影响：____   不确定之处：____', '');
            attempts.push({ configuration, caseId, role: pair.role, status: 'ready', pair, itemId, order: memberOption === 'A' ? 'member-first' : 'control-first' });
            key.push({ itemId, configuration, caseId, role: pair.role, nodeId: pair.nodeId, anchorBookId: anchor.bookId, memberId: pair.memberId, memberBookId: member.bookId, controlId: pair.controlId, controlBookId: control.bookId, memberOption, controlPoolSize: pair.controlPoolSize, memberSimilarity: pair.memberSimilarity, controlSimilarity: pair.controlSimilarity });
        }
    }
}
const diagnostics = configurations.map((configuration) => {
    const subset = attempts.filter((attempt) => attempt.configuration === configuration);
    const paired = subset.filter((attempt) => attempt.status === 'ready').map((attempt) => attempt.pair!);
    const differences = paired.map((pair) => pair.memberSimilarity - pair.controlSimilarity!);
    return { configuration, attempted: subset.length, paired: paired.length, noMatchedControl: subset.filter((attempt) => attempt.status === 'no-matched-control').length, noCrossBookMember: subset.filter((attempt) => attempt.status === 'no-cross-book-member').length, missingNode: subset.filter((attempt) => attempt.status === 'missing-node').length, medianModelDifference: differences.length ? median(differences) : null, losses: differences.filter((value) => value <= 0).length, nearPaired: subset.filter((attempt) => attempt.status === 'ready' && attempt.pair?.role === 'nearest').length, farPaired: subset.filter((attempt) => attempt.status === 'ready' && attempt.pair?.role === 'farthest').length };
});
const report = { schemaVersion: 1, algorithm: 'mapper-book-matched-case-audit-v1', generatedAt: new Date().toISOString(), inputSha256: snapshotSha, embeddingFileSha256: cacheSha, r4cArtifactSha256: sha256(previousText), lensArtifactSha256: sha256(lensText), implementationSha256: sha256(await readFile('scripts/research/mapperBookControl.ts', 'utf8') + '\0' + await readFile('scripts/research/study-mapper-book-control.ts', 'utf8')), parameters: { cases, configurations, seed: MAP_LAYOUT_SEED, selection: 'smallest surviving node; nearest/farthest cross-book cosine; seeded random control in same book and lens cover outside node', review: 'blinded text packet, answer key separate; no human ratings yet' }, diagnostics, attempts, runtime: { milliseconds: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS, node: process.version } };
await mkdir(out, { recursive: true });
await writeFile(`${out}/study.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile(`${out}/answer-key.json`, JSON.stringify(key, null, 2) + '\n');
await writeFile(`${out}/blind-packet.md`, packet.join('\n') + '\n');
console.log(JSON.stringify({ diagnostics, packetItems: key.length, runtime: report.runtime }, null, 2));
