import { describe, expect, it } from 'vitest';
import { phaseForDraw, scoreCandidate, selectNext, weightedPick } from './serendipity.ts';
import type { SelectionInput } from './selection.ts';
import type { Highlight } from './types.ts';

/** Structural fixtures: they pin algorithm behaviour, never real reading content. */
function highlight(id: string, overrides: Partial<Highlight> = {}): Highlight {
    return {
        id,
        bookId: 'b-001',
        text: 'x'.repeat(60),
        year: 2025,
        topicIds: [],
        qualityScore: 3,
        standaloneReadable: true,
        pinned: false,
        openingCandidate: false,
        surpriseCandidate: false,
        ...overrides,
    };
}

/** Removes the optional year, for the "no year recorded" cases. */
function withoutYear(item: Highlight): Highlight {
    const clone: { year?: number } = { ...item };
    delete clone.year;
    return clone as Highlight;
}

function makeInput(overrides: Partial<SelectionInput> = {}): SelectionInput {
    const highlights = overrides.highlights ?? [
        highlight('h-001', { qualityScore: 5, openingCandidate: true }),
        highlight('h-002', { bookId: 'b-002', topicIds: ['t-002'], openingCandidate: true }),
        highlight('h-003', { bookId: 'b-003', topicIds: ['t-003'] }),
    ];
    return {
        highlights,
        currentId: 'h-001',
        historyIds: ['h-001'],
        seenInCycle: ['h-001'],
        globalDrawCount: 0,
        scope: { kind: 'global' },
        rng: () => 0,
        ...overrides,
    };
}

describe('selection guarantees', () => {
    it('never returns the current passage or one already seen in the cycle', () => {
        const input = makeInput({ globalDrawCount: 3 });
        for (let index = 0; index < 200; index += 1) {
            const result = selectNext({ ...input, rng: () => index / 200 });
            expect(result.kind).toBe('selected');
            if (result.kind === 'selected') {
                expect(result.id).not.toBe('h-001');
                expect(input.seenInCycle).not.toContain(result.id);
            }
        }
    });

    it('keeps quality from overriding de-duplication', () => {
        const highlights = [highlight('h-001', { qualityScore: 5 }), highlight('h-002', { qualityScore: 1 })];
        const result = selectNext(
            makeInput({
                highlights,
                currentId: 'h-001',
                historyIds: ['h-001'],
                seenInCycle: ['h-001'],
                globalDrawCount: 3,
            }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-002', reason: 'explore' });
    });

    it('starts a new cycle when everything has been seen, and says so', () => {
        const input = makeInput({
            historyIds: ['h-001', 'h-002', 'h-003'],
            seenInCycle: ['h-001', 'h-002', 'h-003'],
            currentId: 'h-003',
            globalDrawCount: 4,
        });
        const result = selectNext(input);
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.cycleReset).toBe(true);
            expect(result.id).not.toBe('h-003');
        }
    });

    it('does not repeat the current passage when the pool is only recent passages', () => {
        const highlights = [highlight('h-001'), highlight('h-002')];
        const result = selectNext(
            makeInput({
                highlights,
                currentId: 'h-002',
                historyIds: ['h-001', 'h-002'],
                seenInCycle: ['h-001', 'h-002'],
                globalDrawCount: 4,
            }),
        );
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('h-001');
            expect(result.cycleReset).toBe(true);
        }
    });

    it('reports only-current and empty instead of looping', () => {
        expect(
            selectNext(makeInput({ highlights: [highlight('h-001')], currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'] })).kind,
        ).toBe('only-current');
        expect(selectNext(makeInput({ highlights: [], currentId: null, historyIds: [], seenInCycle: [] })).kind).toBe('empty');
    });
});

describe('opening draw', () => {
    it('prefers flagged opening candidates of a readable length', () => {
        const highlights = [
            highlight('h-001', { qualityScore: 1, openingCandidate: true, text: 'y'.repeat(200) }),
            highlight('h-002', { qualityScore: 1, openingCandidate: true, text: 'y'.repeat(60) }),
            highlight('h-003', { qualityScore: 5, openingCandidate: false, text: 'y'.repeat(60) }),
        ];
        const result = selectNext(makeInput({ highlights, currentId: null, historyIds: [], seenInCycle: [], globalDrawCount: 0 }));
        expect(result).toEqual({ kind: 'selected', id: 'h-002', reason: 'opening' });
    });

    it('falls back to readable length, then to the whole pool', () => {
        const noFlag = [highlight('h-001', { text: 'y'.repeat(400) }), highlight('h-002', { text: 'y'.repeat(90) })];
        expect(
            selectNext(makeInput({ highlights: noFlag, currentId: null, historyIds: [], seenInCycle: [], globalDrawCount: 0 })),
        ).toEqual({ kind: 'selected', id: 'h-002', reason: 'opening' });

        const allOutOfRange = [highlight('h-001', { text: 'y'.repeat(400) }), highlight('h-002', { text: 'y'.repeat(300) })];
        const result = selectNext(
            makeInput({ highlights: allOutOfRange, currentId: null, historyIds: [], seenInCycle: [], globalDrawCount: 0 }),
        );
        expect(result.kind).toBe('selected');
    });

    it('excludes passages that are not independently readable from the global stage', () => {
        const highlights = [
            highlight('h-001', { standaloneReadable: true, openingCandidate: true }),
            highlight('h-002', { standaloneReadable: false, openingCandidate: true, qualityScore: 5, pinned: true }),
        ];
        for (let index = 0; index < 50; index += 1) {
            const result = selectNext(
                makeInput({ highlights, currentId: null, historyIds: [], seenInCycle: [], globalDrawCount: 3, rng: () => index / 50 }),
            );
            expect(result.kind === 'selected' ? result.id : null).toBe('h-001');
        }
    });
});

describe('contrast draw', () => {
    it('prefers a different book with disjoint topics', () => {
        const highlights = [
            highlight('h-001', { topicIds: ['t-001'] }),
            highlight('h-002', { bookId: 'b-001', topicIds: ['t-002'], qualityScore: 5 }),
            highlight('h-003', { bookId: 'b-002', topicIds: ['t-001'], qualityScore: 5 }),
            highlight('h-004', { bookId: 'b-003', topicIds: ['t-009'] }),
        ];
        const result = selectNext(
            makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 1 }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-004', reason: 'contrast' });
    });

    it('treats unknown topics as unknown rather than as a contrast', () => {
        const highlights = [
            highlight('h-001', { topicIds: ['t-001'] }),
            highlight('h-002', { bookId: 'b-002', topicIds: [] }),
        ];
        const result = selectNext(
            makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 1 }),
        );
        expect(result.kind === 'selected' ? result.id : null).toBe('h-002');
    });

    it('stays stable when the whole snapshot is one book', () => {
        const highlights = [highlight('h-001'), highlight('h-002'), highlight('h-003')];
        const result = selectNext(
            makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 1 }),
        );
        expect(result.kind).toBe('selected');
    });
});

describe('surprise draw', () => {
    it('prefers another book that opens a topic the visitor has not met this session', () => {
        const highlights = [
            // Already seen this visit: t-001 from b-001.
            highlight('h-001', { bookId: 'b-001', topicIds: ['t-001'] }),
            // Same book, higher quality, but no new ground.
            highlight('h-002', { bookId: 'b-001', topicIds: ['t-002'], qualityScore: 5 }),
            // Another book repeating the same topic: a contrast, not a new territory.
            highlight('h-003', { bookId: 'b-002', topicIds: ['t-001'], qualityScore: 5 }),
            // Another book opening an unseen topic: the surprise.
            highlight('h-004', { bookId: 'b-003', topicIds: ['t-009'], qualityScore: 1 }),
        ];
        const result = selectNext(
            makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 2 }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-004', reason: 'surprise' });
    });

    it('treats a topic already shown earlier in the session as known ground', () => {
        const highlights = [
            highlight('h-001', { bookId: 'b-001', topicIds: ['t-001'] }),
            highlight('h-009', { bookId: 'b-009', topicIds: ['t-001'], qualityScore: 5 }),
            highlight('h-002', { bookId: 'b-002', topicIds: ['t-001', 't-002'], qualityScore: 1 }),
            highlight('h-004', { bookId: 'b-004', topicIds: ['t-009'], qualityScore: 1 }),
        ];
        // h-009 was already shown this visit, so t-001 is no longer new; only h-004 brings new ground.
        const result = selectNext(
            makeInput({
                highlights,
                currentId: 'h-002',
                historyIds: ['h-001', 'h-009', 'h-002'],
                seenInCycle: ['h-001', 'h-009', 'h-002'],
                globalDrawCount: 2,
            }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-004', reason: 'surprise' });
    });

    it('degrades to a plain contrast when no new territory remains', () => {
        const highlights = [
            highlight('h-001', { bookId: 'b-001', topicIds: ['t-001'] }),
            highlight('h-002', { bookId: 'b-002', topicIds: ['t-001'] }),
        ];
        const result = selectNext(
            makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 2 }),
        );
        expect(result).toEqual({ kind: 'selected', id: 'h-002', reason: 'surprise' });
    });

    it('ignores the bookmark year completely, present or missing', () => {
        const build = (withYears: boolean) => {
            const base = [
                highlight('h-001', { bookId: 'b-001', topicIds: ['t-001'] }),
                highlight('h-002', { bookId: 'b-002', topicIds: ['t-001'], qualityScore: 5 }),
                highlight('h-003', { bookId: 'b-003', topicIds: ['t-009'], qualityScore: 1 }),
            ];
            return withYears ? base : base.map((item) => withoutYear(item));
        };
        const pick = (highlights: Highlight[]) =>
            selectNext(
                makeInput({ highlights, currentId: 'h-001', historyIds: ['h-001'], seenInCycle: ['h-001'], globalDrawCount: 2 }),
            );
        // A very old passage and a passage with no year behave identically: only territory decides.
        expect(pick(build(true))).toEqual(pick(build(false)));
        expect(pick(build(true))).toEqual({ kind: 'selected', id: 'h-003', reason: 'surprise' });
    });
});

describe('book scope', () => {
    it('never crosses books and reports exhaustion inside the book', () => {
        const highlights = [
            highlight('h-001', { bookId: 'b-001' }),
            highlight('h-002', { bookId: 'b-001' }),
            highlight('h-003', { bookId: 'b-002' }),
        ];
        const input = makeInput({
            highlights,
            currentId: 'h-001',
            historyIds: ['h-001'],
            seenInCycle: ['h-001'],
            globalDrawCount: 5,
            scope: { kind: 'book', bookId: 'b-001' },
        });
        expect(selectNext(input)).toEqual({ kind: 'selected', id: 'h-002', reason: 'book' });

        const exhausted = selectNext({ ...input, currentId: 'h-002', seenInCycle: ['h-001', 'h-002'] });
        expect(exhausted.kind).toBe('exhausted-book');

        expect(selectNext({ ...input, scope: { kind: 'book', bookId: 'b-404' } }).kind).toBe('empty');
    });
});

describe('determinism and scoring', () => {
    it('is reproducible for a fixed rng and stable ordering', () => {
        const input = makeInput({ globalDrawCount: 4, rng: () => 0.42 });
        const first = selectNext(input);
        const second = selectNext(input);
        expect(first).toEqual(second);
    });

    it('samples across the shortlist instead of always taking one passage', () => {
        const highlights = ['h-001', 'h-002', 'h-003', 'h-004'].map((id) => highlight(id, { bookId: `b-${id.slice(-1)}` }));
        const picked = new Set<string>();
        for (let index = 0; index < 40; index += 1) {
            const result = selectNext(
                makeInput({
                    highlights,
                    currentId: 'h-001',
                    historyIds: ['h-001'],
                    seenInCycle: ['h-001'],
                    globalDrawCount: 4,
                    rng: () => index / 40,
                }),
            );
            if (result.kind === 'selected') {
                picked.add(result.id);
            }
        }
        expect(picked.size).toBeGreaterThan(1);
    });

    it('never returns a passage outside the supplied list', () => {
        const highlights = [highlight('h-001'), highlight('h-002')];
        const result = selectNext(makeInput({ highlights, globalDrawCount: 3 }));
        expect(result.kind === 'selected' ? result.id : null).toBe('h-002');
    });

    it('weights pins and quality without letting them break de-duplication', () => {
        const current = highlight('h-001', { bookId: 'b-001', topicIds: ['t-001'], year: 2026 });
        const pinned = highlight('h-002', { bookId: 'b-002', topicIds: ['t-002'], qualityScore: 5, pinned: true });
        const plain = highlight('h-003', { bookId: 'b-002', topicIds: ['t-002'], qualityScore: 3 });
        const input = makeInput({ highlights: [current, pinned, plain], globalDrawCount: 3 });
        expect(scoreCandidate(pinned, current, input)).toBeGreaterThan(scoreCandidate(plain, current, input));
    });

    it('penalises repeated exposure of the same passage', () => {
        const current = highlight('h-001', { bookId: 'b-001' });
        const candidate = highlight('h-002', { bookId: 'b-002' });
        const fresh = makeInput({ highlights: [current, candidate], globalDrawCount: 3 });
        const repeated = makeInput({ highlights: [current, candidate], historyIds: ['h-002', 'h-002', 'h-002', 'h-002'], globalDrawCount: 3 });
        expect(scoreCandidate(candidate, current, repeated)).toBeLessThan(scoreCandidate(candidate, current, fresh));
    });

    it('maps draw counts to the documented phases', () => {
        expect([0, 1, 2, 3, 7].map(phaseForDraw)).toEqual(['opening', 'contrast', 'surprise', 'explore', 'explore']);
    });

    it('falls back to the last candidate when the rng lands exactly on the total', () => {
        const candidates = [highlight('h-001'), highlight('h-002')];
        expect(weightedPick(candidates, [1, 1], () => 1)?.id).toBe('h-002');
        expect(weightedPick([], [], () => 0)).toBeNull();
    });
});
