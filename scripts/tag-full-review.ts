import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
    type AssignmentFlag,
    type AssignmentProvenance,
    type HighlightTagAssignment,
    type TopicTagAssignments,
} from '../src/domain/topicTags.ts';
import { rerankerSupportsPrimary, shouldReviewAutomatically, type RankedTagEvidence } from './embeddings/tagAssignment.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

type Suggestion = {
    highlightId: string;
    tagIds: string[];
    confidence: 'low' | 'medium' | 'high';
    candidates: RankedTagEvidence[];
    flags: Array<'low-confidence' | 'semantic-outlier' | 'near-boundary' | 'possible-missing-tag'>;
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

type BatchDecision = {
    schemaVersion: 1;
    batchId: string;
    reviewedAt: string;
    reviewed: number;
    draft: number;
    decisions: Array<{
        highlightId: string;
        status: 'reviewed' | 'draft';
        provenance: AssignmentProvenance;
        tagIds: string[];
        confidence: 'low' | 'medium' | 'high';
        reason: string;
    }>;
};

type RerankerFile = {
    model: string;
    scores: Record<string, Array<{ tagId: string; score: number }>>;
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function decide(
    suggestion: Suggestion,
    reviewedAt: string,
    rerankerScores: readonly { tagId: string; score: number }[],
): HighlightTagAssignment {
    const first = suggestion.candidates[0];
    const second = suggestion.candidates[1];
    if (first === undefined) throw new Error(`suggestion ${suggestion.highlightId} has no candidate`);
    const margin = first.score - (second?.score ?? 0);
    const reviewed =
        suggestion.confidence === 'high' &&
        shouldReviewAutomatically(first, suggestion.confidence, margin) &&
        !suggestion.flags.includes('semantic-outlier') &&
        rerankerSupportsPrimary(first.tagId, rerankerScores);
    // Generated decisions deliberately keep one strongly supported tag. Multi-tag
    // assignments remain available as draft suggestions until their boundaries are reviewed.
    const reviewedTagIds = reviewed ? [first.tagId] : suggestion.tagIds;
    const provenance: AssignmentProvenance = reviewed
        ? first.lexical && suggestion.confidence !== 'high'
            ? 'lexical'
            : 'ensemble'
        : 'unresolved';
    const flags: AssignmentFlag[] = reviewed
        ? suggestion.flags.filter((flag) => flag === 'near-boundary')
        : [...new Set<AssignmentFlag>([...suggestion.flags, 'low-confidence'])];
    return {
        highlightId: suggestion.highlightId,
        tagIds: reviewedTagIds,
        status: reviewed ? 'reviewed' : 'draft',
        provenance,
        confidence: reviewed ? suggestion.confidence : 'low',
        rationale: reviewed
            ? `Batch 6 批次复核接受：${suggestion.rationale}`
            : `Batch 6 保守复核未获得足够独立证据；${suggestion.rationale} 保留候选但不进入 reviewed 数据。`,
        candidates: suggestion.candidates.map(({ tagId, score }) => ({ tagId, score })),
        flags,
        updatedAt: reviewedAt,
    };
}

function refinementArgument(): number | null {
    const argument = process.argv.find((value) => value.startsWith('--refine='));
    if (argument === undefined) return null;
    const refinement = Number(argument.slice('--refine='.length));
    if (!Number.isInteger(refinement) || refinement < 1) throw new Error('--refine must be a positive integer');
    return refinement;
}

async function main(): Promise<void> {
    const refinement = refinementArgument();
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const batchRoot = resolve(tagsRoot, 'batch6');
    const passRoot = refinement === null ? batchRoot : resolve(batchRoot, `refinement-${String(refinement)}`);
    const suggestionRoot = resolve(passRoot, 'suggestions');
    const decisionRoot = resolve(passRoot, 'decisions');
    const assignmentPath = resolve(tagsRoot, 'assignments.json');
    const baselinePath = resolve(batchRoot, 'baseline-assignments.json');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    const snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    const vocabulary = vocabularyCheck.value;
    const currentRaw = JSON.parse(await readFile(assignmentPath, 'utf8')) as unknown;
    const currentCheck = validateTopicTagAssignments(currentRaw, snapshot, vocabulary);
    if (!currentCheck.ok) throw new Error(`current assignments do not validate: ${currentCheck.errors.join('; ')}`);
    const reranker = JSON.parse(await readFile(resolve(batchRoot, 'reranker-scores.json'), 'utf8')) as RerankerFile;
    if (!(await exists(baselinePath))) await writeAtomic(baselinePath, currentCheck.value);
    const baselineCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(baselinePath, 'utf8')) as unknown,
        snapshot,
        vocabulary,
    );
    if (!baselineCheck.ok) throw new Error(`Batch 6 baseline does not validate: ${baselineCheck.errors.join('; ')}`);
    const baseline = baselineCheck.value;
    const source = refinement === null ? baseline : currentCheck.value;
    const suggestionFiles = (await import('node:fs/promises')).readdir(suggestionRoot).then((files) =>
        files.filter((file) => /^batch-\d{3}\.json$/u.test(file)).sort(),
    );
    const files = await suggestionFiles;
    if (files.length === 0) throw new Error('no Batch 6 suggestions; run npm run tags:full:generate first');
    const reviewedAt = new Date().toISOString();
    const generated: HighlightTagAssignment[] = [];
    const batchSummaries: Array<{ batchId: string; total: number; reviewed: number; draft: number }> = [];
    for (const file of files) {
        const batch = JSON.parse(await readFile(resolve(suggestionRoot, file), 'utf8')) as BatchSuggestion;
        if (batch.schemaVersion !== 1 || batch.suggestions.length !== batch.highlightIds.length) {
            throw new Error(`${file}: invalid Batch 6 suggestion shape`);
        }
        const decisions = batch.suggestions.map((suggestion) => {
            const scores = reranker.scores[suggestion.highlightId];
            if (scores === undefined || scores.length !== suggestion.candidates.length) {
                throw new Error(`missing reranker scores for ${suggestion.highlightId}`);
            }
            return decide(suggestion, reviewedAt, scores);
        });
        generated.push(...decisions);
        const reviewed = decisions.filter((assignment) => assignment.status === 'reviewed').length;
        const draft = decisions.length - reviewed;
        batchSummaries.push({ batchId: batch.batchId, total: decisions.length, reviewed, draft });
        const output: BatchDecision = {
            schemaVersion: 1,
            batchId: batch.batchId,
            reviewedAt,
            reviewed,
            draft,
            decisions: decisions.map((assignment) => ({
                highlightId: assignment.highlightId,
                status: assignment.status,
                provenance: assignment.provenance,
                tagIds: assignment.tagIds,
                confidence: assignment.confidence,
                reason: assignment.rationale,
            })),
        };
        await writeAtomic(resolve(decisionRoot, file), output);
    }
    const generatedIds = new Set(generated.map((assignment) => assignment.highlightId));
    const baselineIds = new Set(baseline.assignments.map((assignment) => assignment.highlightId));
    if (refinement === null && generated.some((assignment) => baselineIds.has(assignment.highlightId))) {
        throw new Error('Batch 6 suggestions overlap preserved baseline assignments');
    }
    if (generatedIds.size !== generated.length) throw new Error('Batch 6 generated duplicate highlight decisions');
    const untouched = source.assignments.filter((assignment) => !generatedIds.has(assignment.highlightId));
    const output: TopicTagAssignments = {
        ...source,
        generatedAt: reviewedAt,
        model: 'local-reviewed-seed-query-knn-v1',
        sampleVersion: refinement === null ? 'all-highlights-batch6-v1' : `all-highlights-batch6-refinement-${String(refinement)}`,
        assignments: [...untouched, ...generated],
    };
    const required = new Set(snapshot.highlights.map((highlight) => highlight.id));
    const finalCheck = validateTopicTagAssignments(output, snapshot, vocabulary, required);
    if (!finalCheck.ok) throw new Error(`full assignments do not validate: ${finalCheck.errors.join('; ')}`);
    await writeAtomic(assignmentPath, finalCheck.value);
    const reviewed = finalCheck.value.assignments.filter((assignment) => assignment.status === 'reviewed');
    const draft = finalCheck.value.assignments.filter((assignment) => assignment.status === 'draft');
    const report = {
        schemaVersion: 1,
        generatedAt: reviewedAt,
        assignments: finalCheck.value.assignments.length,
        reviewed: reviewed.length,
        draft: draft.length,
        preserved: untouched.length,
        generated: generated.length,
        originalBaseline: baseline.assignments.length,
        batches: batchSummaries,
        tagCounts: Object.fromEntries(vocabulary.tags.map((tag) => [
            tag.id,
            reviewed.filter((assignment) => assignment.tagIds.includes(tag.id)).length,
        ])),
        provenance: Object.fromEntries(['ensemble', 'lexical', 'override', 'unresolved', 'human'].map((kind) => [
            kind,
            finalCheck.value.assignments.filter((assignment) => assignment.provenance === kind).length,
        ])),
        draftHighlightIds: draft.map((assignment) => assignment.highlightId),
    };
    await writeAtomic(resolve(passRoot, 'audit.json'), report);
    console.log(
        `${refinement === null ? 'Batch 6' : `Batch 6 refinement ${String(refinement)}`} assignments: ` +
        `${String(report.assignments)} total; ${String(report.reviewed)} reviewed / ${String(report.draft)} draft`,
    );
    console.log(`preserved/generated: ${String(report.preserved)} / ${String(report.generated)}; batches ${String(batchSummaries.length)}`);
    console.log(`provenance: ${Object.entries(report.provenance).map(([key, value]) => `${key} ${String(value)}`).join(', ')}`);
    console.log(`batch review range: ${batchSummaries.map((batch) => `${batch.batchId} ${String(batch.reviewed)}/${String(batch.total)}`).join(', ')}`);
}

await main();
