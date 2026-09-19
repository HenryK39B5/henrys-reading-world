import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    updateHighlightAssignment,
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
} from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

type UserReviewNotes = {
    schemaVersion: 1;
    entries: Array<{
        highlightId: string;
        rawDecision: string;
        matchedTagIds: string[];
        unmatchedTerms: string[];
    }>;
};

/** User proposals that the implementation agent resolved during the 2026-09-19 Batch 3 closeout. */
const BATCH_3_CLOSEOUT_ADJUDICATED = new Set([
    'h-1441', 'h-1984', 'h-2212', 'h-2425', 'h-2452', 'h-2512',
    'h-2539', 'h-2868', 'h-3132', 'h-3355', 'h-3526',
]);

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) {
        throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    }
    const vocabularyCheck = validateTopicTagVocabulary(
        JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown,
    );
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const sample = JSON.parse(await readFile(resolve(tagsRoot, 'discovery-sample.json'), 'utf8')) as {
        entries: Array<{ id: string }>;
    };
    const assignmentsCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(tagsRoot, 'assignments.json'), 'utf8')) as unknown,
        snapshotCheck.snapshot,
        vocabularyCheck.value,
        new Set(sample.entries.map((entry) => entry.id)),
    );
    if (!assignmentsCheck.ok) {
        throw new Error(`assignments do not validate: ${assignmentsCheck.errors.join('; ')}`);
    }
    const notes = JSON.parse(await readFile(resolve(tagsRoot, 'user-review-notes.json'), 'utf8')) as UserReviewNotes;
    if (notes.schemaVersion !== 1 || !Array.isArray(notes.entries)) {
        throw new Error('user review notes are missing or invalid; run npm run tags:review-import first');
    }

    let next = assignmentsCheck.value;
    let applied = 0;
    for (const note of notes.entries) {
        if (note.unmatchedTerms.length > 0 || note.matchedTagIds.length === 0 || note.matchedTagIds.length > 3) {
            continue;
        }
        next = updateHighlightAssignment(
            next,
            note.highlightId,
            {
                tagIds: note.matchedTagIds,
                status: 'reviewed',
                confidence: 'high',
                rationale: `Henry 在 review-queue.md 中填写：「${note.rawDecision}」。`,
                flags: [],
            },
            new Date().toISOString(),
        );
        applied += 1;
    }
    const finalCheck = validateTopicTagAssignments(
        next,
        snapshotCheck.snapshot,
        vocabularyCheck.value,
        new Set(sample.entries.map((entry) => entry.id)),
    );
    if (!finalCheck.ok) {
        throw new Error(`assignments fail after user decisions: ${finalCheck.errors.join('; ')}`);
    }
    await writeAtomic(resolve(tagsRoot, 'assignments.json'), finalCheck.value);
    const adjudicated = notes.entries.filter(
        (note) => note.unmatchedTerms.length > 0 && BATCH_3_CLOSEOUT_ADJUDICATED.has(note.highlightId),
    ).length;
    const pending = notes.entries.length - applied - adjudicated;
    console.log(`applied exact user decisions: ${String(applied)}`);
    console.log(`agent-adjudicated vocabulary proposals: ${String(adjudicated)}`);
    console.log(`still pending vocabulary adjudication: ${String(pending)}`);
    if (pending > 0) {
        throw new Error('user review notes still contain unadjudicated vocabulary proposals');
    }
}

await main();
