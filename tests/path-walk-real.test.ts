import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pathCandidates, pathRound } from '../src/domain/pathWalk.ts';
import { PATH_VECTOR_DIMENSIONS, type Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';

const SNAPSHOT_PATH = resolve(process.cwd(), '.private', 'local-snapshot.json');
const ASSIGNMENTS_PATH = resolve(process.cwd(), '.private', 'tags', 'assignments.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH) && existsSync(ASSIGNMENTS_PATH);

function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

function localSnapshot(): Snapshot {
    const checked = validateSnapshot(JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!checked.ok) {
        throw new Error(checked.errors.join('; '));
    }
    return checked.snapshot;
}

describe.skipIf(!hasSnapshot)('real Batch 4 path pilot', () => {
    it('exports a small path vector for every reviewed assignment and no draft', () => {
        const snapshot = localSnapshot();
        const assignmentFile = JSON.parse(readFileSync(ASSIGNMENTS_PATH, 'utf8')) as {
            assignments: Array<{ highlightId: string; status: string }>;
        };
        const expectedReviewedIds = new Set(
            assignmentFile.assignments
                .filter((assignment) => assignment.status === 'reviewed')
                .map((assignment) => assignment.highlightId),
        );
        const tagged = snapshot.highlights.filter((highlight) => highlight.tagIds.length > 0);
        const untagged = snapshot.highlights.filter((highlight) => highlight.tagIds.length === 0);
        expect(new Set(tagged.map((highlight) => highlight.id))).toEqual(expectedReviewedIds);
        expect(tagged.every((highlight) => highlight.pathVector?.length === PATH_VECTOR_DIMENSIONS)).toBe(true);
        expect(untagged.every((highlight) => highlight.pathVector === undefined)).toBe(true);
    });

    it('reaches every reviewed candidate in all 56 paths with rhythm on or off', () => {
        const snapshot = localSnapshot();
        let differentOrders = 0;
        for (const [index, tag] of snapshot.tags.entries()) {
            const candidates = pathCandidates(snapshot.highlights, tag.id);
            expect(candidates.length, tag.id).toBeGreaterThan(0);
            const expected = new Set(candidates.map((highlight) => highlight.id));
            const uniform = pathRound(tag.id, snapshot.highlights, 'uniform', seeded(index + 1));
            const semantic = pathRound(tag.id, snapshot.highlights, 'semantic', seeded(index + 1));
            expect(new Set(uniform), `${tag.id} uniform`).toEqual(expected);
            expect(new Set(semantic), `${tag.id} semantic`).toEqual(expected);
            if (uniform.join('\0') !== semantic.join('\0')) {
                differentOrders += 1;
            }
        }
        expect(differentOrders).toBeGreaterThan(0);
    });
});
