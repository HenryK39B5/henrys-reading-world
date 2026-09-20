import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateTopicTagAssignments, validateTopicTagVocabulary } from '../src/domain/topicTags.ts';
import { scoreTagPassagePairs, TAG_RERANKER_MODEL } from './embeddings/tagReranker.ts';

type CalibrationEntry = { highlightId: string; candidateTagIds: string[] };
type Calibration = { entries: CalibrationEntry[] };
type CachedScore = { tagId: string; score: number };
type Cache = Record<string, CachedScore[]>;

function tagQuery(tag: { title: string; definition: string; includes: string[]; aliases: string[] }): string {
    const aliases = tag.aliases.length === 0 ? '' : `；也常写作：${tag.aliases.join('、')}`;
    return `主题“${tag.title}”：${tag.definition} 典型内容包括：${tag.includes.join('、')}${aliases}。`;
}

function overlap(predicted: readonly string[], actual: ReadonlySet<string>): { precision: number; recall: number; f1: number; exact: boolean } {
    const hits = predicted.filter((tagId) => actual.has(tagId)).length;
    const precision = hits / predicted.length;
    const recall = hits / actual.size;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { precision, recall, f1, exact: hits === predicted.length && hits === actual.size };
}

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await (await import('node:fs/promises')).rename(temporary, path);
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private');
    const snapshot = JSON.parse(await readFile(resolve(root, 'local-snapshot.json'), 'utf8')) as Snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(root, 'tags', 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const vocabulary = vocabularyCheck.value;
    const baselineCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(root, 'tags', 'batch6', 'baseline-assignments.json'), 'utf8')) as unknown,
        snapshot,
        vocabulary,
    );
    if (!baselineCheck.ok) throw new Error(baselineCheck.errors.join('; '));
    const calibration = JSON.parse(await readFile(resolve(root, 'tags', 'batch6', 'calibration.json'), 'utf8')) as Calibration;
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const tagById = new Map(vocabulary.tags.map((tag) => [tag.id, tag]));
    const actualById = new Map(
        baselineCheck.value.assignments
            .filter((assignment) => assignment.status === 'reviewed')
            .map((assignment) => [assignment.highlightId, new Set(assignment.tagIds)]),
    );
    const entries = calibration.entries.filter((entry) => actualById.has(entry.highlightId));
    const cachePath = resolve(root, 'tags', 'batch6', 'reranker-evaluation-cache.json');
    let cache: Cache = {};
    try {
        cache = JSON.parse(await readFile(cachePath, 'utf8')) as Cache;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    let completed = 0;
    for (const entry of entries) {
        if (cache[entry.highlightId]?.length === entry.candidateTagIds.length) {
            completed += 1;
            continue;
        }
        const highlight = highlightById.get(entry.highlightId);
        if (highlight === undefined) throw new Error(`missing highlight ${entry.highlightId}`);
        const definitions = entry.candidateTagIds.map((tagId) => {
            const tag = tagById.get(tagId);
            if (tag === undefined) throw new Error(`missing tag ${tagId}`);
            return tagQuery(tag);
        });
        const scores = await scoreTagPassagePairs(definitions, definitions.map(() => highlight.text));
        cache[entry.highlightId] = entry.candidateTagIds.map((tagId, index) => ({ tagId, score: scores[index] ?? Number.NEGATIVE_INFINITY }));
        completed += 1;
        if (completed % 20 === 0) {
            await writeAtomic(cachePath, cache);
            console.log(`reranked ${String(completed)} / ${String(entries.length)}`);
        }
    }
    await writeAtomic(cachePath, cache);

    const ranked = entries.map((entry) => ({
        highlightId: entry.highlightId,
        actual: actualById.get(entry.highlightId) ?? new Set<string>(),
        scores: [...(cache[entry.highlightId] ?? [])].sort((left, right) => right.score - left.score || left.tagId.localeCompare(right.tagId)),
    }));
    const top1Accuracy = ranked.filter((entry) => entry.actual.has(entry.scores[0]?.tagId ?? '')).length / ranked.length;
    const top3Any = ranked.filter((entry) => entry.scores.slice(0, 3).some((candidate) => entry.actual.has(candidate.tagId))).length / ranked.length;
    const candidateRecall = ranked.filter((entry) => [...entry.actual].every((tagId) => entry.scores.some((candidate) => candidate.tagId === tagId))).length / ranked.length;

    const trials: Array<{ minimum: number; margin: number; precision: number; recall: number; f1: number; exact: number; meanTags: number }> = [];
    for (let minimum = -10; minimum <= -1; minimum += 0.5) {
        for (let margin = 0.25; margin <= 4; margin += 0.25) {
            const metrics = ranked.map((entry) => {
                const top = entry.scores[0]?.score ?? Number.NEGATIVE_INFINITY;
                const predicted = entry.scores
                    .slice(0, 3)
                    .filter((candidate, index) => index === 0 || (candidate.score >= minimum && top - candidate.score <= margin))
                    .map((candidate) => candidate.tagId);
                return { ...overlap(predicted, entry.actual), tags: predicted.length };
            });
            trials.push({
                minimum,
                margin,
                precision: metrics.reduce((sum, metric) => sum + metric.precision, 0) / metrics.length,
                recall: metrics.reduce((sum, metric) => sum + metric.recall, 0) / metrics.length,
                f1: metrics.reduce((sum, metric) => sum + metric.f1, 0) / metrics.length,
                exact: metrics.filter((metric) => metric.exact).length / metrics.length,
                meanTags: metrics.reduce((sum, metric) => sum + metric.tags, 0) / metrics.length,
            });
        }
    }
    trials.sort((left, right) => right.f1 - left.f1 || right.precision - left.precision);
    const conservative = trials.filter((trial) => trial.precision >= 0.85).sort((left, right) => right.recall - left.recall || right.f1 - left.f1)[0] ?? null;
    const report = {
        generatedAt: new Date().toISOString(),
        model: TAG_RERANKER_MODEL,
        evaluationHighlights: ranked.length,
        candidateRecall,
        top1Accuracy,
        top3Any,
        bestMacroF1: trials[0],
        conservative,
        topTrials: trials.slice(0, 20),
    };
    await writeAtomic(resolve(root, 'tags', 'batch6', 'reranker-evaluation.json'), report);
    console.log(JSON.stringify(report, null, 2));
}

await main();
