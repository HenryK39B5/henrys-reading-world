import { describe, expect, it } from 'vitest';
import { createInitialState, describeDeadEnd, encounterReducer, isBusy, type EncounterContext } from './encounter.ts';
import { selectSequential } from './sequence.ts';
import type { Highlight } from './types.ts';

function highlight(id: string, overrides: Partial<Highlight> = {}): Highlight {
    return {
        id,
        bookId: 'b-001',
        text: `passage ${id}`,
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

const HIGHLIGHTS: Highlight[] = [highlight('h-001'), highlight('h-002'), highlight('h-003')];

function makeContext(overrides: Partial<EncounterContext> = {}): EncounterContext {
    return {
        highlights: HIGHLIGHTS,
        durations: { exit: 160, enter: 280 },
        selector: selectSequential,
        rng: () => 0.5,
        nowYear: 2025,
        ...overrides,
    };
}

describe('encounter transitions', () => {
    it('starts idle on the first committed draw', () => {
        const state = createInitialState(HIGHLIGHTS, 'h-001');
        expect(state.phase).toBe('idle');
        expect(state.currentId).toBe('h-001');
        expect(state.globalDrawCount).toBe(1);
        expect(state.commitCount).toBe(0);
        expect(isBusy(state)).toBe(false);
    });

    it('ignores an unknown initial id instead of rendering it', () => {
        const state = createInitialState(HIGHLIGHTS, 'h-404');
        expect(state.currentId).toBeNull();
        expect(state.globalDrawCount).toBe(0);
    });

    it('moves through exiting -> committing -> entering -> idle', () => {
        const context = makeContext();
        let state = createInitialState(HIGHLIGHTS, 'h-001');

        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(state.phase).toBe('exiting');
        expect(state.pending?.id).toBe('h-002');
        expect(state.currentId).toBe('h-001');

        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.phase).toBe('entering');
        expect(state.currentId).toBe('h-002');
        expect(state.globalDrawCount).toBe(2);
        expect(state.commitCount).toBe(1);

        state = encounterReducer(state, { type: 'TRANSITION_END' }, context);
        expect(state.phase).toBe('idle');
    });

    it('swallows rapid repeat clicks while a transition is in flight', () => {
        const context = makeContext();
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        const afterFirst = state;

        for (let index = 0; index < 20; index += 1) {
            state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        }
        expect(state).toBe(afterFirst);
        expect(state.pending?.id).toBe('h-002');
        expect(state.commitCount).toBe(0);

        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.currentId).toBe('h-002');
        expect(state.commitCount).toBe(1);
        expect(state.globalDrawCount).toBe(2);
    });

    it('commits immediately when transitions are disabled for reduced motion', () => {
        const context = makeContext({ durations: { exit: 0, enter: 0 } });
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(state.phase).toBe('idle');
        expect(state.currentId).toBe('h-002');
        expect(state.commitCount).toBe(1);
        expect(state.pending).toBeNull();
    });

    it('ignores a commit event that does not match a transition in flight', () => {
        const context = makeContext();
        const state = createInitialState(HIGHLIGHTS, 'h-001');
        expect(encounterReducer(state, { type: 'COMMIT_QUOTE' }, context)).toBe(state);
        expect(encounterReducer(state, { type: 'TRANSITION_END' }, context)).toBe(state);
    });

    it('reports a single-passage space instead of looping forever', () => {
        const context = makeContext({ highlights: [highlight('h-001')] });
        const state = createInitialState([highlight('h-001')], 'h-001');
        const next = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(next.lastResult.kind).toBe('only-current');
        expect(next.commitCount).toBe(0);
        expect(describeDeadEnd(next)).toContain('只收录了一处划线');
        expect(describeDeadEnd(state)).toBeNull();
    });

    it('reports an empty snapshot without inventing content', () => {
        const context = makeContext({ highlights: [] });
        const state = createInitialState([], null);
        const next = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(next.lastResult.kind).toBe('empty');
        expect(next.currentId).toBeNull();
    });

    it('opens a specific passage without consuming a global draw and cancels the transition', () => {
        const context = makeContext();
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);

        expect(state.phase).toBe('idle');
        expect(state.pending).toBeNull();
        expect(state.currentId).toBe('h-003');
        expect(state.globalDrawCount).toBe(1);
        expect(state.commitCount).toBe(1);
        // Even after a cancelled transition, the next global draw is still based on the real history.
        const resumed = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(resumed.pending?.id).toBe('h-001');
    });

    it('ignores an unknown id and a no-op reopen', () => {
        const context = makeContext();
        const state = createInitialState(HIGHLIGHTS, 'h-001');
        expect(encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-404' }, context)).toBe(state);
        expect(encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-001' }, context)).toBe(state);
    });

    it('does not mutate the state or the input list', () => {
        const context = makeContext();
        const highlightsBefore = JSON.stringify(HIGHLIGHTS);
        const state = createInitialState(HIGHLIGHTS, 'h-001');
        const stateBefore = JSON.stringify(state);
        const next = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        encounterReducer(next, { type: 'COMMIT_QUOTE' }, context);
        expect(JSON.stringify(state)).toBe(stateBefore);
        expect(JSON.stringify(HIGHLIGHTS)).toBe(highlightsBefore);
    });

    it('records a cycle reset when the engine asks for one', () => {
        const context = makeContext({
            selector: () => ({ kind: 'selected', id: 'h-002', reason: 'explore', cycleReset: true }),
        });
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.seenInCycle).toEqual(['h-002']);
        expect(state.historyIds).toEqual(['h-001', 'h-002']);
    });
});

describe('slice 1 placeholder ordering', () => {
    it('walks the snapshot in order and wraps around', () => {
        const base = { historyIds: [], seenInCycle: [], globalDrawCount: 1, rng: () => 0, nowYear: 2025 };
        expect(selectSequential({ ...base, highlights: HIGHLIGHTS, currentId: 'h-001', scope: { kind: 'global' } })).toEqual({
            kind: 'selected',
            id: 'h-002',
            reason: 'sequential',
        });
        expect(selectSequential({ ...base, highlights: HIGHLIGHTS, currentId: 'h-003', scope: { kind: 'global' } })).toEqual({
            kind: 'selected',
            id: 'h-001',
            reason: 'sequential',
        });
    });

    it('stays inside one book when the scope is a book', () => {
        const highlights = [highlight('h-001'), highlight('h-002', { bookId: 'b-002' })];
        const result = selectSequential({
            highlights,
            currentId: 'h-001',
            historyIds: [],
            seenInCycle: [],
            globalDrawCount: 1,
            scope: { kind: 'book', bookId: 'b-001' },
            rng: () => 0,
            nowYear: 2025,
        });
        expect(result.kind).toBe('only-current');
    });
});
