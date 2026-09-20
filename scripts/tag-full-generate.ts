import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
    type HighlightTagAssignment,
    type TopicTagDefinition,
} from '../src/domain/topicTags.ts';
import { EMBEDDING_INPUT_VERSION, snapshotEmbeddingHash, type EmbeddingCache } from './embeddings/core.ts';
import {
    dotProjected,
    meanProjected,
    projectForTagAssignment,
    proposeTagAssignment,
    type RankedTagEvidence,
} from './embeddings/tagAssignment.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { providerDefaults } from './embeddings/providers.ts';

const BATCH_SIZE = 250;
const MODEL = 'local-reviewed-seed-query-knn-v1';

type Suggestion = {
    highlightId: string;
    tagIds: string[];
    confidence: 'low' | 'medium' | 'high';
    candidates: Array<RankedTagEvidence>;
    flags: string[];
    rationale: string;
};

type BatchSuggestion = {
    schemaVersion: 1;
    batchId: string;
    batchIndex: number;
    batchCount: number;
    generatedAt: string;
    snapshotHash: string;
    vocabularyHash: string;
    model: string;
    inputVersion: string;
    highlightIds: string[];
    suggestions: Suggestion[];
};

type TagModel = {
    tag: TopicTagDefinition;
    centroid: number[];
    query: number[];
    mean: number;
    deviation: number;
};

type TrainingEntry = {
    highlightId: string;
    bookId: string;
    tagIds: string[];
    vector: number[];
};

const LEXICAL_EVIDENCE: Readonly<Record<string, RegExp>> = {
    'tag-001': /不确定|未知|无从确定|不可知/u,
    'tag-002': /风险|损失|脆弱|暴露|止损/u,
    'tag-003': /概率|赔率|随机游走|贝叶斯|分布/u,
    'tag-004': /运气|幸运|偶然|碰巧/u,
    'tag-005': /决策|决断|方案|取舍/u,
    'tag-006': /预测|预言|推断未来/u,
    'tag-007': /认知偏差|偏见|错觉|幸存者偏差|确认偏误/u,
    'tag-008': /因果|原因|归因|相关不等于因果/u,
    'tag-009': /证据|事实|论证|资料|验证/u,
    'tag-010': /自我认识|认识自己|了解自己|自知/u,
    'tag-011': /选择|抉择|取舍/u,
    'tag-012': /行动|实践|开始做|执行/u,
    'tag-013': /习惯|每天重复|微行为|惯性/u,
    'tag-014': /自控|自制|意志力|克制|冲动/u,
    'tag-015': /成长|成熟|进步|改变自己/u,
    'tag-016': /学习|练习|反馈|技能|知识/u,
    'tag-017': /阅读|读书|读者|文本/u,
    'tag-018': /时间|等待|时光|节奏/u,
    'tag-019': /精力|疲劳|睡眠|休息|体能|注意力/u,
    'tag-020': /创造|创作|创新|灵感/u,
    'tag-021': /关怀|怜悯|慈悲|爱人|被爱|给予爱/u,
    'tag-022': /伴侣|婚姻|亲密关系|夫妻|恋爱/u,
    'tag-023': /父母|母亲|父亲|家庭|家人|孩子|亲子/u,
    'tag-024': /信任|背叛|可靠/u,
    'tag-025': /孤独|孤单|独处|寂寞/u,
    'tag-026': /恐惧|害怕|焦虑|畏惧/u,
    'tag-027': /欲望|贪婪|诱惑|性欲|渴求/u,
    'tag-028': /痛苦|创伤|悲伤|受苦|苦难/u,
    'tag-029': /沟通|倾听|提问|对话|表达/u,
    'tag-030': /幸福|快乐|满足|喜悦/u,
    'tag-031': /意义|值得|目的|生命方向/u,
    'tag-032': /自由|自主|强制|奴役/u,
    'tag-033': /责任|负责|义务|担当/u,
    'tag-034': /道德|善恶|正当|良知|伦理/u,
    'tag-035': /人性|本性|人的天性/u,
    'tag-036': /死亡|死去|去世|临终|衰老|哀悼/u,
    'tag-037': /荒诞|无理|虚无|失序/u,
    'tag-038': /财富|资产|致富|富人|金钱/u,
    'tag-039': /市场|价格机制|供需|竞争/u,
    'tag-040': /交易|买卖|投机|仓位|止盈/u,
    'tag-041': /货币|通胀|金本位|国债|信用货币/u,
    'tag-042': /管理|管理者|授权|组织目标/u,
    'tag-043': /协作|合作|分工|团队/u,
    'tag-044': /复杂性|复杂系统|反馈回路|涌现/u,
    'tag-045': /代码|软件|模块|数据系统|架构|程序员/u,
    'tag-046': /权力|支配|服从|政治力量|统治/u,
    'tag-047': /制度|体制|规则|激励机制/u,
    'tag-048': /改革|转型|变革|路径依赖/u,
    'tag-049': /民主|法治|宪法|权力制衡|公民权利/u,
    'tag-050': /阶层|阶级|社会流动|出身/u,
    'tag-051': /从众|群体思维|集体疯狂|群体心理/u,
    'tag-052': /宣传|舆论|洗脑|信息封锁|审查/u,
    'tag-053': /历史叙事|集体记忆|重写历史|历史记忆/u,
    'tag-054': /债务|负债|杠杆|偿还|借债/u,
    'tag-055': /失败|挫折|成败|败北/u,
    'tag-056': /希望|盼望|曙光|绝望中/u,
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

function parseArguments(): { force: boolean; refinement: number | null } {
    const refineArgument = process.argv.find((argument) => argument.startsWith('--refine='));
    const refinement = refineArgument === undefined ? null : Number(refineArgument.slice('--refine='.length));
    if (refinement !== null && (!Number.isInteger(refinement) || refinement < 1)) {
        throw new Error('--refine must be a positive integer');
    }
    return { force: process.argv.includes('--force'), refinement };
}

function standardDeviation(values: readonly number[], mean: number): number {
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
}

function topNeighbours(vector: number[], bookId: string, training: readonly TrainingEntry[]): TrainingEntry[] {
    return training
        .filter((entry) => entry.bookId !== bookId)
        .map((entry) => ({ entry, similarity: dotProjected(vector, entry.vector) }))
        .sort((left, right) => right.similarity - left.similarity || left.entry.highlightId.localeCompare(right.entry.highlightId))
        .slice(0, 18)
        .map(({ entry }) => entry);
}

function neighbourShares(vector: number[], bookId: string, training: readonly TrainingEntry[]): Map<string, number> {
    const neighbours = topNeighbours(vector, bookId, training);
    const weights = new Map<string, number>();
    let total = 0;
    for (const neighbour of neighbours) {
        const similarity = dotProjected(vector, neighbour.vector);
        const weight = Math.max(0, similarity - 0.32) ** 2;
        if (weight === 0) continue;
        total += weight;
        for (const tagId of neighbour.tagIds) weights.set(tagId, (weights.get(tagId) ?? 0) + weight / neighbour.tagIds.length);
    }
    if (total === 0) return weights;
    for (const [tagId, weight] of weights) weights.set(tagId, weight / total);
    return weights;
}

async function main(): Promise<void> {
    const { force, refinement } = parseArguments();
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const outputRoot = refinement === null
        ? resolve(tagsRoot, 'batch6', 'suggestions')
        : resolve(tagsRoot, 'batch6', `refinement-${String(refinement)}`, 'suggestions');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    const snapshot: Snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    const vocabulary = vocabularyCheck.value;
    const baselinePath = resolve(tagsRoot, 'batch6', 'baseline-assignments.json');
    let assignmentSource = resolve(tagsRoot, 'assignments.json');
    if (refinement === null) {
        try {
            await access(baselinePath);
            assignmentSource = baselinePath;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    const existingCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(assignmentSource, 'utf8')) as unknown,
        snapshot,
        vocabulary,
    );
    if (!existingCheck.ok) throw new Error(`existing assignments do not validate: ${existingCheck.errors.join('; ')}`);
    const existing = existingCheck.value;
    const manifest = JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary-manifest.json'), 'utf8')) as { vocabularyHash: string };
    const migration = JSON.parse(await readFile(resolve(tagsRoot, 'id-migration.json'), 'utf8')) as { tags: Record<string, string> };
    const curated = JSON.parse(await readFile(resolve(tagsRoot, 'curated-seeds.json'), 'utf8')) as { tags: Array<{ tagId: string; seedIds: string[] }> };
    const queryCache = JSON.parse(await readFile(resolve(tagsRoot, 'candidate-query-vectors.json'), 'utf8')) as { vectors: Record<string, number[]> };
    const { model, dimensions } = providerDefaults('local');
    const cacheName = `local--${model.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-')}--${String(dimensions)}.json`;
    const cache = JSON.parse(await readFile(resolve(embeddingPrivatePaths().cache, cacheName), 'utf8')) as EmbeddingCache;
    if (cache.provider !== 'local' || cache.model !== model || cache.dimensions !== dimensions) {
        throw new Error('selected local embedding cache does not match the pinned model');
    }
    const vectors = new Map(snapshot.highlights.map((highlight) => {
        const vector = cache.vectors[highlight.id]?.values;
        if (vector === undefined) throw new Error(`embedding cache is missing ${highlight.id}`);
        return [highlight.id, projectForTagAssignment(vector)] as const;
    }));
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const reviewed = existing.assignments.filter((assignment) => assignment.status === 'reviewed');
    const training: TrainingEntry[] = reviewed.map((assignment) => {
        const highlight = highlightById.get(assignment.highlightId);
        const vector = vectors.get(assignment.highlightId);
        if (highlight === undefined || vector === undefined) throw new Error(`reviewed training item is missing ${assignment.highlightId}`);
        return { highlightId: highlight.id, bookId: highlight.bookId, tagIds: assignment.tagIds, vector };
    });
    const reviewedByTag = new Map<string, HighlightTagAssignment[]>();
    for (const assignment of reviewed) {
        for (const tagId of assignment.tagIds) {
            const items = reviewedByTag.get(tagId) ?? [];
            items.push(assignment);
            reviewedByTag.set(tagId, items);
        }
    }
    const candidateByStable = new Map(Object.entries(migration.tags).map(([candidateId, stableId]) => [stableId, candidateId]));
    const curatedByCandidate = new Map(curated.tags.map((entry) => [entry.tagId, entry.seedIds]));
    const allVectors = snapshot.highlights.map((highlight) => vectors.get(highlight.id) ?? []);
    const tagModels: TagModel[] = vocabulary.tags.map((tag) => {
        const candidateId = candidateByStable.get(tag.id);
        if (candidateId === undefined) throw new Error(`missing candidate migration for ${tag.id}`);
        const seedIds = curatedByCandidate.get(candidateId);
        if (seedIds === undefined) throw new Error(`missing curated seeds for ${tag.id}`);
        const modelIds = new Set([
            ...seedIds,
            ...(reviewedByTag.get(tag.id) ?? []).map((assignment) => assignment.highlightId),
        ]);
        const centroid = meanProjected([...modelIds].map((id) => vectors.get(id) ?? []));
        const query = projectForTagAssignment(queryCache.vectors[candidateId] ?? []);
        const rawScores = allVectors.map((vector) => dotProjected(centroid, vector) * 0.72 + dotProjected(query, vector) * 0.28);
        const mean = rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length;
        return { tag, centroid, query, mean, deviation: standardDeviation(rawScores, mean) };
    });
    const editorialOrder = new Map(vocabulary.tags.map((tag) => [tag.id, tag.editorialOrder]));
    const suggest = (highlight: Snapshot['highlights'][number]): Suggestion => {
        const vector = vectors.get(highlight.id) ?? [];
        const shares = neighbourShares(vector, highlight.bookId, training);
        const ranked = tagModels.map((tagModel): RankedTagEvidence => {
            const raw = dotProjected(tagModel.centroid, vector) * 0.72 + dotProjected(tagModel.query, vector) * 0.28;
            const semanticZ = (raw - tagModel.mean) / tagModel.deviation;
            const neighbourShare = shares.get(tagModel.tag.id) ?? 0;
            const lexical = LEXICAL_EVIDENCE[tagModel.tag.id]?.test(highlight.text) ?? false;
            return {
                tagId: tagModel.tag.id,
                semanticZ: Number(semanticZ.toFixed(6)),
                neighbourShare: Number(neighbourShare.toFixed(6)),
                lexical,
                score: Number((semanticZ + neighbourShare * 1.8 + (lexical ? 0.75 : 0)).toFixed(6)),
            };
        }).sort((left, right) => right.score - left.score || left.tagId.localeCompare(right.tagId));
        const proposal = proposeTagAssignment(ranked, editorialOrder);
        const first = ranked[0];
        const second = ranked[1];
        if (first === undefined) throw new Error(`no candidates for ${highlight.id}`);
        const margin = first.score - (second?.score ?? 0);
        return {
            highlightId: highlight.id,
            tagIds: proposal.tagIds,
            confidence: proposal.confidence,
            candidates: ranked.slice(0, 10),
            flags: proposal.flags,
            rationale:
                `Batch 6 本机 ensemble；top=${first.score.toFixed(3)}，semantic=${first.semanticZ.toFixed(3)}，` +
                `neighbour=${first.neighbourShare.toFixed(3)}，lexical=${first.lexical ? 'yes' : 'no'}，margin=${margin.toFixed(3)}；需经批次复核。`,
        };
    };
    const existingIds = new Set(existing.assignments.map((assignment) => assignment.highlightId));
    let remaining: Snapshot['highlights'];
    if (refinement === null) {
        remaining = snapshot.highlights.filter((highlight) => !existingIds.has(highlight.id));
    } else {
        const baselineCheck = validateTopicTagAssignments(
            JSON.parse(await readFile(baselinePath, 'utf8')) as unknown,
            snapshot,
            vocabulary,
        );
        if (!baselineCheck.ok) throw new Error(`Batch 6 baseline does not validate: ${baselineCheck.errors.join('; ')}`);
        const protectedDraftIds = new Set(
            baselineCheck.value.assignments.filter((assignment) => assignment.status === 'draft').map((assignment) => assignment.highlightId),
        );
        const targetIds = new Set(
            existing.assignments
                .filter((assignment) => assignment.status === 'draft' && !protectedDraftIds.has(assignment.highlightId))
                .map((assignment) => assignment.highlightId),
        );
        remaining = snapshot.highlights.filter((highlight) => targetIds.has(highlight.id));
    }
    remaining.sort((left, right) => left.id.localeCompare(right.id));
    const snapshotHash = snapshotEmbeddingHash(snapshot);
    const calibrationEntries = reviewed.map((assignment) => {
        const highlight = highlightById.get(assignment.highlightId);
        if (highlight === undefined) throw new Error(`calibration item is missing ${assignment.highlightId}`);
        const suggestion = suggest(highlight);
        const actual = new Set(assignment.tagIds);
        const proposed = new Set(suggestion.tagIds);
        const intersection = [...proposed].filter((tagId) => actual.has(tagId)).length;
        const top3 = new Set(suggestion.candidates.slice(0, 3).map((candidate) => candidate.tagId));
        const top5 = new Set(suggestion.candidates.slice(0, 5).map((candidate) => candidate.tagId));
        const top10 = new Set(suggestion.candidates.slice(0, 10).map((candidate) => candidate.tagId));
        return {
            highlightId: assignment.highlightId,
            confidence: suggestion.confidence,
            top1Hit: actual.has(suggestion.candidates[0]?.tagId ?? ''),
            anyTop3: [...actual].some((tagId) => top3.has(tagId)),
            allTop3: [...actual].every((tagId) => top3.has(tagId)),
            allTop5: [...actual].every((tagId) => top5.has(tagId)),
            allTop10: [...actual].every((tagId) => top10.has(tagId)),
            candidateTagIds: suggestion.candidates.slice(0, 10).map((candidate) => candidate.tagId),
            candidates: suggestion.candidates.slice(0, 10),
            exact: assignment.tagIds.length === suggestion.tagIds.length && assignment.tagIds.every((tagId) => proposed.has(tagId)),
            precision: intersection / proposed.size,
            recall: intersection / actual.size,
        };
    });
    const meanMetric = (key: 'precision' | 'recall'): number =>
        calibrationEntries.reduce((sum, entry) => sum + entry[key], 0) / calibrationEntries.length;
    const calibration = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        evaluatedReviewedAssignments: calibrationEntries.length,
        note: 'Diagnostic reuse of the reviewed pilot; centroids include reviewed examples, while neighbours exclude the same book. Not an independent held-out estimate.',
        top1Accuracy: calibrationEntries.filter((entry) => entry.top1Hit).length / calibrationEntries.length,
        exactSetAccuracy: calibrationEntries.filter((entry) => entry.exact).length / calibrationEntries.length,
        anyActualInTop3: calibrationEntries.filter((entry) => entry.anyTop3).length / calibrationEntries.length,
        allActualInTop3: calibrationEntries.filter((entry) => entry.allTop3).length / calibrationEntries.length,
        allActualInTop5: calibrationEntries.filter((entry) => entry.allTop5).length / calibrationEntries.length,
        allActualInTop10: calibrationEntries.filter((entry) => entry.allTop10).length / calibrationEntries.length,
        entries: calibrationEntries,
        meanPrecision: meanMetric('precision'),
        meanRecall: meanMetric('recall'),
        byConfidence: Object.fromEntries((['high', 'medium', 'low'] as const).map((level) => {
            const entries = calibrationEntries.filter((entry) => entry.confidence === level);
            return [level, {
                count: entries.length,
                top1Accuracy: entries.length === 0 ? 0 : entries.filter((entry) => entry.top1Hit).length / entries.length,
                exactSetAccuracy: entries.length === 0 ? 0 : entries.filter((entry) => entry.exact).length / entries.length,
                meanPrecision: entries.length === 0 ? 0 : entries.reduce((sum, entry) => sum + entry.precision, 0) / entries.length,
                meanRecall: entries.length === 0 ? 0 : entries.reduce((sum, entry) => sum + entry.recall, 0) / entries.length,
                allActualInTop3: entries.length === 0 ? 0 : entries.filter((entry) => entry.allTop3).length / entries.length,
            }];
        })),
    };
    await writeAtomic(
        refinement === null
            ? resolve(tagsRoot, 'batch6', 'calibration.json')
            : resolve(tagsRoot, 'batch6', `refinement-${String(refinement)}`, 'calibration.json'),
        calibration,
    );
    const batchCount = Math.ceil(remaining.length / BATCH_SIZE);
    await mkdir(outputRoot, { recursive: true });
    let written = 0;
    let skipped = 0;
    const confidence = { high: 0, medium: 0, low: 0 };
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
        const batchNumber = batchIndex + 1;
        const batchId = `batch-${String(batchNumber).padStart(3, '0')}`;
        const path = resolve(outputRoot, `${batchId}.json`);
        if (!force) {
            try {
                await access(path);
                skipped += 1;
                continue;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }
        const highlights = remaining.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
        const suggestions: Suggestion[] = highlights.map((highlight) => {
            const suggestion = suggest(highlight);
            confidence[suggestion.confidence] += 1;
            return suggestion;
        });
        const output: BatchSuggestion = {
            schemaVersion: 1,
            batchId,
            batchIndex: batchNumber,
            batchCount,
            generatedAt: new Date().toISOString(),
            snapshotHash,
            vocabularyHash: manifest.vocabularyHash,
            model: MODEL,
            inputVersion: EMBEDDING_INPUT_VERSION,
            highlightIds: highlights.map((highlight) => highlight.id),
            suggestions,
        };
        await writeAtomic(path, output);
        written += 1;
    }
    console.log(
        `${refinement === null ? 'Batch 6' : `Batch 6 refinement ${String(refinement)}`} suggestions: ` +
        `${String(remaining.length)} remaining highlights in ${String(batchCount)} batch(es)`,
    );
    console.log(`written/skipped: ${String(written)} / ${String(skipped)}; batch size ${String(BATCH_SIZE)}`);
    console.log(`confidence high/medium/low: ${String(confidence.high)} / ${String(confidence.medium)} / ${String(confidence.low)}`);
    console.log(
        `pilot diagnostic top1/exact/precision/recall: ${(calibration.top1Accuracy * 100).toFixed(1)}% / ` +
        `${(calibration.exactSetAccuracy * 100).toFixed(1)}% / ${(calibration.meanPrecision * 100).toFixed(1)}% / ` +
        `${(calibration.meanRecall * 100).toFixed(1)}%`,
    );
    console.log(`existing assignments preserved: ${String(existing.assignments.length)}`);
}

await main();
