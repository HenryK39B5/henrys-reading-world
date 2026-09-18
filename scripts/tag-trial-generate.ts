import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { validateTopicTagVocabulary, validateTopicTagAssignments, type AssignmentConfidence, type TopicTagAssignments } from '../src/domain/topicTags.ts';
import { EMBEDDING_INPUT_VERSION, snapshotEmbeddingHash, type EmbeddingCache } from './embeddings/core.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

function norm(values: number[]): number {
    const result = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(result) || result === 0) throw new Error('invalid vector norm');
    return result;
}
function normalized(values: number[]): number[] { const n = norm(values); return values.map((value) => value / n); }
function dot(left: number[], right: number[]): number { let value = 0; for (let index = 0; index < left.length; index += 1) value += (left[index] ?? 0) * (right[index] ?? 0); return value; }
function centroid(vectors: number[][]): number[] {
    const result = Array.from<number>({ length: vectors[0]?.length ?? 0 }).fill(0);
    for (const vector of vectors) for (let index = 0; index < result.length; index += 1) result[index] = (result[index] ?? 0) + (vector[index] ?? 0);
    return normalized(result);
}
async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); await rename(temporary, path);
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, { expectedVisibility: 'local-only' });
    if (!snapshotCheck.ok) throw new Error(snapshotCheck.errors.join('; '));
    const snapshot: Snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(root, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const vocabulary = vocabularyCheck.value;
    const manifest = JSON.parse(await readFile(resolve(root, 'vocabulary-manifest.json'), 'utf8')) as { vocabularyHash: string };
    const migration = JSON.parse(await readFile(resolve(root, 'id-migration.json'), 'utf8')) as { tags: Record<string, string> };
    const curated = JSON.parse(await readFile(resolve(root, 'curated-seeds.json'), 'utf8')) as { tags: Array<{ tagId: string; seedIds: string[] }> };
    const queryCache = JSON.parse(await readFile(resolve(root, 'candidate-query-vectors.json'), 'utf8')) as { vectors: Record<string, number[]> };
    const sample = JSON.parse(await readFile(resolve(root, 'discovery-sample.json'), 'utf8')) as { selectionVersion: string; entries: Array<{ id: string }> };
    const embeddingPaths = embeddingPrivatePaths();
    const cache = JSON.parse(await readFile(resolve(embeddingPaths.cache, 'siliconflow--baai-bge-large-zh-v1.5--1024.json'), 'utf8')) as EmbeddingCache;
    const stableToCandidate = new Map(Object.entries(migration.tags).map(([candidateId, stableId]) => [stableId, candidateId]));
    const curatedByCandidate = new Map(curated.tags.map((entry) => [entry.tagId, entry.seedIds]));
    const allHighlights = [...snapshot.highlights].sort((left, right) => left.id.localeCompare(right.id));
    const vectors = new Map(allHighlights.map((highlight) => [highlight.id, normalized(cache.vectors[highlight.id]?.values ?? [])]));
    const tagModels = vocabulary.tags.map((tag) => {
        const candidateId = stableToCandidate.get(tag.id); if (candidateId === undefined) throw new Error(`missing candidate migration for ${tag.id}`);
        const seedIds = curatedByCandidate.get(candidateId); if (seedIds === undefined) throw new Error(`missing curated seeds for ${tag.id}`);
        const seedCentroid = centroid(seedIds.map((id) => vectors.get(id) ?? []));
        const query = normalized(queryCache.vectors[candidateId] ?? []);
        const rawScores = allHighlights.map((highlight) => {
            const vector = vectors.get(highlight.id) ?? [];
            return dot(seedCentroid, vector) * 0.7 + dot(query, vector) * 0.3;
        });
        const mean = rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length;
        const deviation = Math.sqrt(rawScores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / rawScores.length) || 1;
        return { tag, seedCentroid, query, mean, deviation };
    });
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const generatedAt = new Date().toISOString();
    const assignments = sample.entries.map((entry) => {
        const highlight = highlightById.get(entry.id); if (highlight === undefined) throw new Error(`sample references ${entry.id}`);
        const vector = vectors.get(entry.id) ?? [];
        const ranked = tagModels.map((model) => {
            const raw = dot(model.seedCentroid, vector) * 0.7 + dot(model.query, vector) * 0.3;
            const terms = [model.tag.title, ...model.tag.aliases, ...model.tag.includes].filter((term) => [...term].length >= 2);
            const lexical = terms.some((term) => highlight.text.includes(term)) ? 0.65 : 0;
            return { tagId: model.tag.id, score: (raw - model.mean) / model.deviation + lexical };
        }).sort((left, right) => right.score - left.score || left.tagId.localeCompare(right.tagId));
        const first = ranked[0]; const second = ranked[1]; const third = ranked[2];
        if (first === undefined) throw new Error('no tag candidates');
        const chosen = [first];
        if (second !== undefined && second.score >= 0.8 && first.score - second.score <= 0.85) chosen.push(second);
        if (third !== undefined && third.score >= 1.1 && first.score - third.score <= 0.65) chosen.push(third);
        const order = new Map(vocabulary.tags.map((tag) => [tag.id, tag.editorialOrder]));
        const tagIds = chosen.map((candidate) => candidate.tagId).sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
        const margin = second === undefined ? first.score : first.score - second.score;
        const confidence: AssignmentConfidence = first.score >= 1.8 && margin >= 0.25 ? 'high' : first.score >= 0.8 ? 'medium' : 'low';
        const flags: Array<'low-confidence' | 'semantic-outlier' | 'near-boundary' | 'possible-missing-tag'> = [];
        if (confidence === 'low') flags.push('low-confidence');
        if (first.score < 0) flags.push('semantic-outlier');
        if (second !== undefined && margin < 0.15) flags.push('near-boundary');
        if (tagIds.length === 1 && second !== undefined && second.score >= 0.65) flags.push('possible-missing-tag');
        return {
            highlightId: highlight.id,
            tagIds,
            status: 'draft' as const,
            provenance: 'ensemble' as const,
            confidence,
            rationale: `seed-centroid/query ensemble; top=${first.score.toFixed(3)}; margin=${margin.toFixed(3)}; agent review required before publication`,
            candidates: ranked.slice(0, 5).map((candidate) => ({ tagId: candidate.tagId, score: Number(candidate.score.toFixed(6)) })),
            flags,
            updatedAt: generatedAt,
        };
    });
    const output: TopicTagAssignments = {
        schemaVersion: 1,
        snapshotHash: snapshotEmbeddingHash(snapshot),
        vocabularyHash: manifest.vocabularyHash,
        generatedAt,
        model: 'BAAI/bge-large-zh-v1.5',
        inputVersion: EMBEDDING_INPUT_VERSION,
        sampleVersion: sample.selectionVersion,
        assignments,
    };
    const required = new Set(sample.entries.map((entry) => entry.id));
    const checked = validateTopicTagAssignments(output, snapshot, vocabulary, required);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    await writeAtomic(resolve(root, 'trial-suggestions.json'), checked.value);
    const distribution = [1, 2, 3].map((count) => checked.value.assignments.filter((assignment) => assignment.tagIds.length === count).length);
    console.log(`trial suggestions: ${String(checked.value.assignments.length)} assignments`);
    console.log(`tag counts 1/2/3: ${distribution.join(' / ')}`);
    console.log(`confidence high/medium/low: ${(['high','medium','low'] as const).map((confidence) => checked.value.assignments.filter((a) => a.confidence === confidence).length).join(' / ')}`);
}

await main();
