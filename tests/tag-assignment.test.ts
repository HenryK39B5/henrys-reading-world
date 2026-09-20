import { describe, expect, it } from 'vitest';
import {
    dotProjected,
    projectForTagAssignment,
    proposeTagAssignment,
    rerankerSupportsPrimary,
    shouldReviewAutomatically,
    type RankedTagEvidence,
} from '../scripts/embeddings/tagAssignment.ts';

const order = new Map([
    ['tag-001', 1],
    ['tag-002', 2],
    ['tag-003', 3],
]);

function evidence(overrides: Partial<RankedTagEvidence> & Pick<RankedTagEvidence, 'tagId' | 'score'>): RankedTagEvidence {
    return { semanticZ: 1, neighbourShare: 0.2, lexical: false, ...overrides };
}

describe('Batch 6 tag assignment scoring', () => {
    it('projects deterministically without reusing source dimensions', () => {
        const source = Array.from({ length: 128 }, (_, index) => Math.sin(index + 1));
        const first = projectForTagAssignment(source, 32);
        const second = projectForTagAssignment(source, 32);
        expect(first).toEqual(second);
        expect(first).toHaveLength(32);
        expect(dotProjected(first, first)).toBeCloseTo(1);
    });

    it('keeps a clear single tag and marks it high confidence', () => {
        const proposal = proposeTagAssignment([
            evidence({ tagId: 'tag-002', score: 2.1, lexical: true }),
            evidence({ tagId: 'tag-001', score: 0.5, neighbourShare: 0.05 }),
        ], order);
        expect(proposal.tagIds).toEqual(['tag-002']);
        expect(proposal.confidence).toBe('high');
        expect(proposal.flags).toEqual([]);
    });

    it('allows a supported boundary without adding an unsupported third tag', () => {
        const proposal = proposeTagAssignment([
            evidence({ tagId: 'tag-003', score: 1.7 }),
            evidence({ tagId: 'tag-001', score: 1.35, lexical: true }),
            evidence({ tagId: 'tag-002', score: 1.18, neighbourShare: 0.02 }),
        ], order);
        expect(proposal.tagIds).toEqual(['tag-001', 'tag-003']);
        expect(proposal.flags).not.toContain('possible-missing-tag');
    });

    it('keeps weak evidence draft-worthy instead of forcing reviewed coverage', () => {
        const first = evidence({ tagId: 'tag-001', score: 0.62, semanticZ: 0.2, neighbourShare: 0.04 });
        const proposal = proposeTagAssignment([first, evidence({ tagId: 'tag-002', score: 0.55 })], order);
        expect(proposal.confidence).toBe('low');
        expect(proposal.flags).toContain('low-confidence');
        expect(shouldReviewAutomatically(first, proposal.confidence, 0.07)).toBe(false);
    });

    it('requires the local reranker to place the embedding primary in its first two candidates', () => {
        const scores = [
            { tagId: 'tag-003', score: -1.2 },
            { tagId: 'tag-001', score: -2.4 },
            { tagId: 'tag-002', score: -3.1 },
        ];
        expect(rerankerSupportsPrimary('tag-001', scores)).toBe(true);
        expect(rerankerSupportsPrimary('tag-002', scores)).toBe(false);
        expect(rerankerSupportsPrimary('tag-003', scores, 0)).toBe(true);
        expect(() => rerankerSupportsPrimary('tag-003', scores, -1)).toThrow(/non-negative/u);
    });
});
