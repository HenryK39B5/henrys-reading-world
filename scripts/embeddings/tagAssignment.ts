import type { AssignmentConfidence, AssignmentFlag } from '../../src/domain/topicTags.ts';

export const TAG_ASSIGNMENT_PROJECTION_DIMENSIONS = 96;
export const TAG_ASSIGNMENT_PROJECTION_SEED = 0x54414736;

export type RankedTagEvidence = {
    tagId: string;
    score: number;
    semanticZ: number;
    neighbourShare: number;
    lexical: boolean;
};

export type ProposedTagAssignment = {
    tagIds: string[];
    confidence: AssignmentConfidence;
    flags: AssignmentFlag[];
};

function mix(value: number): number {
    let mixed = value >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return mixed >>> 0;
}

/** A deterministic private projection used only by Batch 6 assignment scoring. */
export function projectForTagAssignment(
    source: readonly number[],
    dimensions = TAG_ASSIGNMENT_PROJECTION_DIMENSIONS,
): number[] {
    if (source.length === 0 || source.some((value) => !Number.isFinite(value))) {
        throw new Error('tag assignment projection requires a non-empty finite vector');
    }
    if (!Number.isInteger(dimensions) || dimensions < 16) {
        throw new Error('tag assignment projection dimensions must be an integer of at least 16');
    }
    const result = Array.from<number>({ length: dimensions }).fill(0);
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
        const value = source[sourceIndex] ?? 0;
        for (let lane = 0; lane < 4; lane += 1) {
            const hash = mix(sourceIndex ^ Math.imul(lane + 1, 0x9e3779b1) ^ TAG_ASSIGNMENT_PROJECTION_SEED);
            const target = hash % dimensions;
            result[target] = (result[target] ?? 0) + ((hash & 0x80000000) === 0 ? value : -value);
        }
    }
    const norm = Math.sqrt(result.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) {
        throw new Error('tag assignment projection requires a non-zero vector');
    }
    return result.map((value) => value / norm);
}

export function dotProjected(left: readonly number[], right: readonly number[]): number {
    if (left.length === 0 || left.length !== right.length) {
        throw new Error('projected dot product requires equal non-empty vectors');
    }
    let result = 0;
    for (let index = 0; index < left.length; index += 1) {
        result += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return result;
}

export function meanProjected(vectors: readonly number[][]): number[] {
    if (vectors.length === 0) throw new Error('cannot average zero projected vectors');
    const dimensions = vectors[0]?.length ?? 0;
    const result = Array.from<number>({ length: dimensions }).fill(0);
    for (const vector of vectors) {
        if (vector.length !== dimensions) throw new Error('projected vectors have inconsistent dimensions');
        for (let index = 0; index < dimensions; index += 1) {
            result[index] = (result[index] ?? 0) + (vector[index] ?? 0);
        }
    }
    const norm = Math.sqrt(result.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) throw new Error('projected centroid is zero');
    return result.map((value) => value / norm);
}

/**
 * Convert ranked evidence into a conservative 1–3 tag proposal.
 * Eligibility is independent of final review status; low evidence remains a draft downstream.
 */
export function proposeTagAssignment(
    ranked: readonly RankedTagEvidence[],
    editorialOrder: ReadonlyMap<string, number>,
): ProposedTagAssignment {
    const first = ranked[0];
    if (first === undefined) throw new Error('tag assignment requires at least one ranked candidate');
    const second = ranked[1];
    const third = ranked[2];
    const selected = [first];
    if (
        second !== undefined &&
        second.score >= 0.9 &&
        first.score - second.score <= 0.8 &&
        (second.lexical || second.neighbourShare >= 0.12 || second.semanticZ >= 1.15)
    ) {
        selected.push(second);
    }
    if (
        third !== undefined &&
        third.score >= 1.2 &&
        first.score - third.score <= 0.58 &&
        (third.lexical || third.neighbourShare >= 0.16)
    ) {
        selected.push(third);
    }
    const margin = second === undefined ? first.score : first.score - second.score;
    const support = Number(first.semanticZ >= 0.9) + Number(first.neighbourShare >= 0.14) + Number(first.lexical);
    const confidence: AssignmentConfidence =
        first.score >= 1.75 && margin >= 0.2 && support >= 2
            ? 'high'
            : first.score >= 0.9 && support >= 1
              ? 'medium'
              : 'low';
    const flags: AssignmentFlag[] = [];
    if (confidence === 'low') flags.push('low-confidence');
    if (first.semanticZ < 0) flags.push('semantic-outlier');
    if (second !== undefined && margin < 0.14) flags.push('near-boundary');
    if (selected.length === 1 && second !== undefined && second.score >= 0.72) flags.push('possible-missing-tag');
    return {
        tagIds: selected
            .map((candidate) => candidate.tagId)
            .sort((left, right) => (editorialOrder.get(left) ?? 0) - (editorialOrder.get(right) ?? 0)),
        confidence,
        flags,
    };
}

export function shouldReviewAutomatically(first: RankedTagEvidence, confidence: AssignmentConfidence, margin: number): boolean {
    if (confidence === 'high') return true;
    if (confidence === 'low') return false;
    const independentSupport = Number(first.semanticZ >= 0.8) + Number(first.neighbourShare >= 0.13) + Number(first.lexical);
    return first.score >= 1.2 && margin >= 0.08 && independentSupport >= 2;
}

export function rerankerSupportsPrimary(
    primaryTagId: string,
    scores: readonly { tagId: string; score: number }[],
    maximumRank = 1,
): boolean {
    if (!Number.isInteger(maximumRank) || maximumRank < 0) throw new Error('maximum reranker rank must be a non-negative integer');
    const ranked = [...scores].sort((left, right) => right.score - left.score || left.tagId.localeCompare(right.tagId));
    const rank = ranked.findIndex((candidate) => candidate.tagId === primaryTagId);
    return rank >= 0 && rank <= maximumRank;
}
