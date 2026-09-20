import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import { validateTopicTagAssignments, validateTopicTagVocabulary, type HighlightTagAssignment } from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

type OverrideDecision = {
    highlightId: string;
    status: 'reviewed' | 'draft';
    tagIds: string[];
    reason: string;
};

type OverrideFile = {
    schemaVersion: 1;
    decisions: OverrideDecision[];
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const overridePath = resolve(tagsRoot, 'batch6', 'audit-overrides.json');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) throw new Error(snapshotCheck.errors.join('; '));
    const snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const vocabulary = vocabularyCheck.value;
    const assignmentPath = resolve(tagsRoot, 'assignments.json');
    const assignmentCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(assignmentPath, 'utf8')) as unknown,
        snapshot,
        vocabulary,
        new Set(snapshot.highlights.map((highlight) => highlight.id)),
    );
    if (!assignmentCheck.ok) throw new Error(assignmentCheck.errors.join('; '));
    const overrideFile = JSON.parse(await readFile(overridePath, 'utf8')) as OverrideFile;
    if (overrideFile.schemaVersion !== 1 || !Array.isArray(overrideFile.decisions)) throw new Error('invalid Batch 6 audit override file');
    const editorialOrder = new Map(vocabulary.tags.map((tag) => [tag.id, tag.editorialOrder]));
    const assignmentById = new Map(assignmentCheck.value.assignments.map((assignment) => [assignment.highlightId, assignment]));
    const seen = new Set<string>();
    const updatedAt = new Date().toISOString();
    for (const decision of overrideFile.decisions) {
        if (seen.has(decision.highlightId)) throw new Error(`duplicate override ${decision.highlightId}`);
        seen.add(decision.highlightId);
        const assignment = assignmentById.get(decision.highlightId);
        if (assignment === undefined) throw new Error(`override references missing highlight ${decision.highlightId}`);
        if (decision.reason.trim().length < 8) throw new Error(`override ${decision.highlightId} needs a specific reason`);
        const requestedTagIds = decision.status === 'draft' && decision.tagIds.length === 0
            ? assignment.tagIds
            : decision.tagIds;
        const uniqueTagIds = [...new Set(requestedTagIds)].sort(
            (left, right) => (editorialOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (editorialOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
        );
        if (decision.status === 'reviewed' && (uniqueTagIds.length < 1 || uniqueTagIds.length > 3)) {
            throw new Error(`reviewed override ${decision.highlightId} must contain 1–3 tags`);
        }
        if (decision.status === 'draft' && uniqueTagIds.length > 3) throw new Error(`draft override ${decision.highlightId} has too many candidates`);
        if (uniqueTagIds.some((tagId) => !editorialOrder.has(tagId))) throw new Error(`override ${decision.highlightId} references unknown tag`);
        const next: HighlightTagAssignment = {
            ...assignment,
            tagIds: uniqueTagIds,
            status: decision.status,
            provenance: decision.status === 'reviewed' ? 'override' : 'unresolved',
            confidence: decision.status === 'reviewed' ? 'high' : 'low',
            rationale: `Batch 6 全文审计：${decision.reason}`,
            flags: decision.status === 'reviewed' ? [] : [...new Set([...assignment.flags, 'low-confidence' as const])],
            updatedAt,
        };
        assignmentById.set(decision.highlightId, next);
    }
    const output = {
        ...assignmentCheck.value,
        generatedAt: updatedAt,
        sampleVersion: 'all-highlights-batch6-audit-overrides-v1',
        assignments: [...assignmentById.values()],
    };
    const finalCheck = validateTopicTagAssignments(output, snapshot, vocabulary, new Set(snapshot.highlights.map((highlight) => highlight.id)));
    if (!finalCheck.ok) throw new Error(finalCheck.errors.join('; '));
    await writeAtomic(assignmentPath, finalCheck.value);
    console.log(`Applied ${String(overrideFile.decisions.length)} Batch 6 audit override(s)`);
    console.log(`reviewed/draft: ${String(finalCheck.value.assignments.filter((assignment) => assignment.status === 'reviewed').length)} / ${String(finalCheck.value.assignments.filter((assignment) => assignment.status === 'draft').length)}`);
}

await main();
