import { describe, expect, it } from 'vitest';
import {
    createInitialState,
    describeBookDeadEnd,
    describeDeadEnd,
    encounterReducer,
    isBusy,
    type EncounterContext,
} from './encounter.ts';
import { selectSequential } from './sequence.ts';
import { selectNextQuote } from './serendipity.ts';
import type { Highlight } from './types.ts';

function highlight(id: string, overrides: Partial<Highlight> = {}): Highlight {
    return {
        id,
        bookId: 'b-001',
        text: `passage ${id}`,
        year: 2025,
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
        ...overrides,
    };
}

describe('encounter transitions', () => {
    it('starts idle on the first committed draw', () => {
        const state = createInitialState(HIGHLIGHTS, 'h-001');
        expect(state.phase).toBe('idle');
        expect(state.currentId).toBe('h-001');
        expect(state.commitCount).toBe(0);
        expect(isBusy(state)).toBe(false);
    });

    it('ignores an unknown initial id instead of rendering it', () => {
        const state = createInitialState(HIGHLIGHTS, 'h-404');
        expect(state.currentId).toBeNull();
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

    it('opens a specific passage, cancels the transition and keeps the history honest', () => {
        const context = makeContext();
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);

        expect(state.phase).toBe('idle');
        expect(state.pending).toBeNull();
        expect(state.currentId).toBe('h-003');
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

    it('records a cycle reset when the selector asks for one', () => {
        const context = makeContext({
            selector: () => ({ kind: 'selected', id: 'h-002', reason: 'all', cycleReset: true }),
        });
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.seenInCycle).toEqual(['h-002']);
        expect(state.historyIds).toEqual(['h-001', 'h-002']);
    });
});

describe('source reveal', () => {
    it('opens and closes the source panel for the current passage', () => {
        const context = makeContext();
        let state = createInitialState(HIGHLIGHTS, 'h-001');
        expect(state.sourceOpen).toBe(false);

        state = encounterReducer(state, { type: 'OPEN_SOURCE' }, context);
        expect(state.sourceOpen).toBe(true);
        // Opening the source is not a draw: it must not disturb the exposure counters.
        expect(state.commitCount).toBe(0);

        expect(encounterReducer(state, { type: 'OPEN_SOURCE' }, context)).toBe(state);

        state = encounterReducer(state, { type: 'CLOSE_SOURCE' }, context);
        expect(state.sourceOpen).toBe(false);
        expect(encounterReducer(state, { type: 'CLOSE_SOURCE' }, context)).toBe(state);
    });

    it('ignores a source request when there is no passage', () => {
        const context = makeContext();
        const empty = createInitialState([], null);
        expect(encounterReducer(empty, { type: 'OPEN_SOURCE' }, context)).toBe(empty);
    });

    it('closes the source as soon as a global passage is requested', () => {
        const context = makeContext();
        let state = encounterReducer(createInitialState(HIGHLIGHTS, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        expect(state.sourceOpen).toBe(true);
        state = encounterReducer(state, { type: 'NEXT_GLOBAL' }, context);
        expect(state.sourceOpen).toBe(false);
    });

    it('moves inside one book and keeps the source open', () => {
        const bookHighlights = [
            highlight('h-001', { bookId: 'b-001' }),
            highlight('h-002', { bookId: 'b-001' }),
            highlight('h-003', { bookId: 'b-002' }),
        ];
        const context = makeContext({ highlights: bookHighlights, selector: selectNextQuote });
        let state = encounterReducer(createInitialState(bookHighlights, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        expect(state.pending?.id).toBe('h-002');
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);

        expect(state.currentId).toBe('h-002');
        expect(state.sourceOpen).toBe(true);
        expect(state.commitCount).toBe(1);
        expect(state.phase).toBe('entering');
    });

    it('never leaves the book and reports exhaustion instead', () => {
        const bookHighlights = [
            highlight('h-001', { bookId: 'b-001' }),
            highlight('h-002', { bookId: 'b-001' }),
            highlight('h-003', { bookId: 'b-002' }),
        ];
        const context = makeContext({ highlights: bookHighlights, selector: selectNextQuote });
        let state = encounterReducer(createInitialState(bookHighlights, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        state = encounterReducer(state, { type: 'TRANSITION_END' }, context);
        expect(state.currentId).toBe('h-002');

        // Every passage of this book has now been seen; b-002 must not be substituted in.
        const exhausted = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        expect(exhausted.lastResult.kind).toBe('exhausted-book');
        expect(exhausted.currentId).toBe('h-002');
        expect(exhausted.commitCount).toBe(state.commitCount);
        expect(describeBookDeadEnd(exhausted)).toContain('已经看完');
        expect(describeBookDeadEnd(state)).toBeNull();
    });

    it('ignores book moves while a transition is in flight and without a passage', () => {
        const context = makeContext({ selector: selectNextQuote });
        const idle = createInitialState(HIGHLIGHTS, 'h-001');
        const busy = encounterReducer(idle, { type: 'NEXT_GLOBAL' }, context);
        expect(encounterReducer(busy, { type: 'NEXT_IN_BOOK' }, context)).toBe(busy);
        expect(encounterReducer(createInitialState([], null), { type: 'NEXT_IN_BOOK' }, context).currentId).toBeNull();
    });

    it('updates the source panel for a direct open of another passage', () => {
        const context = makeContext();
        let state = encounterReducer(createInitialState(HIGHLIGHTS, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);
        expect(state.currentId).toBe('h-003');
        expect(state.sourceOpen).toBe(false);
    });
});

describe('deterministic reference ordering', () => {
    const base = { historyIds: [], seenInCycle: [], rng: () => 0 };

    it('walks the snapshot in order and wraps around', () => {
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
            ...base,
            highlights,
            currentId: 'h-001',
            scope: { kind: 'book', bookId: 'b-001' },
        });
        expect(result.kind).toBe('only-current');
    });
});
