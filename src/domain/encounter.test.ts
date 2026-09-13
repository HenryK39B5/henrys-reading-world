import { describe, expect, it } from 'vitest';
import { selectNext } from './discovery.ts';
import {
    createInitialState,
    describeBookDeadEnd,
    describeDeadEnd,
    encounterReducer,
    isBusy,
    unseenInBookCount,
    type EncounterContext,
} from './encounter.ts';
import { selectSequential } from './sequence.ts';
import { EMPTY_CYCLE, type CycleState } from './selection.ts';
import type { Book, Highlight } from './types.ts';

/**
 * Encounter machine properties.
 *
 * The persistent stage range, the per-scope cycles and the atomic scope switch are the V2-B additions;
 * the transition, rapid-click, reduced-motion and source-reveal guarantees of v1 must all survive them.
 *
 * Real passage text never appears here.
 */
const READABLE = '这是一段长度适中的划线，用于验证长度规则。';

function makeBook(id: string, themeIds: string[] = ['t-001']): Book {
    return { id, title: `book ${id}`, author: 'author', themeIds };
}

function passage(id: string, bookId: string, text: string = READABLE): Highlight {
    return { id, bookId, text, year: 2025 };
}

const BOOKS: Book[] = [makeBook('b-001', ['t-001']), makeBook('b-002', ['t-002']), makeBook('b-003', ['t-001'])];
const HIGHLIGHTS: Highlight[] = [
    passage('h-001', 'b-001'),
    passage('h-002', 'b-002'),
    passage('h-003', 'b-003'),
    passage('h-004', 'b-001'),
];

function makeContext(overrides: Partial<EncounterContext> = {}): EncounterContext {
    return {
        books: BOOKS,
        highlights: HIGHLIGHTS,
        durations: { exit: 160, enter: 280 },
        selector: selectSequential,
        rng: () => 0.5,
        ...overrides,
    };
}

/** Stage one specific passage from a clean session, so a test starts from a known empty cycle. */
function openPassage(context: EncounterContext, id: string) {
    const empty = createInitialState({ ...context, highlights: [], books: [] });
    return encounterReducer(empty, { type: 'OPEN_HIGHLIGHT', id }, context);
}

function cycleOf(state: ReturnType<typeof createInitialState>, key: string): CycleState {
    return state.cycles[key] ?? EMPTY_CYCLE;
}

describe('encounter transitions', () => {
    it('starts idle on the engine opening draw without counting it as a visitor commit', () => {
        const state = createInitialState(makeContext({ selector: selectNext }));
        expect(state.phase).toBe('idle');
        expect(state.currentId).not.toBeNull();
        expect(state.commitCount).toBe(0);
        expect(state.historyIds).toHaveLength(1);
        expect(isBusy(state)).toBe(false);
        expect(state.lastResult.kind).toBe('selected');
    });

    it('opens on a real passage of the snapshot instead of an arbitrary id', () => {
        const state = createInitialState(makeContext({ selector: selectNext }));
        expect(HIGHLIGHTS.map((highlight) => highlight.id)).toContain(state.currentId);
    });

    it('honours a chosen opening record and ignores an unknown one', () => {
        const context = makeContext();
        const linked = createInitialState(context, 'h-003');
        expect(linked.currentId).toBe('h-003');
        expect(linked.lastResult).toEqual({
            kind: 'selected',
            id: 'h-003',
            bookId: 'b-003',
            reason: 'fallback',
            scopeKey: 'all',
        });
        expect(createInitialState(context, 'h-404').currentId).toBeNull();
    });

    it('moves through exiting -> committing -> entering -> idle', () => {
        const context = makeContext();
        let state = createInitialState(context, 'h-001');

        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
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
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        const afterFirst = state;

        for (let index = 0; index < 20; index += 1) {
            state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
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
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(state.phase).toBe('idle');
        expect(state.currentId).toBe('h-002');
        expect(state.commitCount).toBe(1);
        expect(state.pending).toBeNull();
    });

    it('ignores a commit event that does not match a transition in flight', () => {
        const context = makeContext();
        const state = createInitialState(context, 'h-001');
        expect(encounterReducer(state, { type: 'COMMIT_QUOTE' }, context)).toBe(state);
        expect(encounterReducer(state, { type: 'TRANSITION_END' }, context)).toBe(state);
    });

    it('reports a single-passage space instead of looping forever', () => {
        const single = [passage('h-001', 'b-001')];
        const context = makeContext({ highlights: single, selector: selectNext });
        const state = createInitialState(context, 'h-001');
        const next = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(next.lastResult.kind).toBe('only-current');
        expect(next.commitCount).toBe(0);
        expect(describeDeadEnd(next)).toContain('只收录了一处划线');
        expect(describeDeadEnd(state)).toBeNull();
    });

    it('reports an empty snapshot without inventing content', () => {
        const context = makeContext({ highlights: [], selector: selectNext });
        const state = createInitialState(context);
        expect(state.currentId).toBeNull();
        expect(state.lastResult.kind).toBe('empty');
        const next = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(next.lastResult.kind).toBe('empty');
        expect(next.currentId).toBeNull();

        // Entering a shelf is refused as well: there is nothing to show there.
        const switched = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-001' } }, context);
        expect(switched.stageScope).toEqual({ kind: 'all' });
        expect(switched.commitCount).toBe(0);
    });

    it('opens a specific passage, cancels the transition and keeps the history honest', () => {
        const context = makeContext();
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);

        expect(state.phase).toBe('idle');
        expect(state.pending).toBeNull();
        expect(state.currentId).toBe('h-003');
        expect(state.commitCount).toBe(1);
        // Even after a cancelled transition, the next stage draw is still based on the real history.
        const resumed = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(resumed.pending?.id).toBe('h-004');
    });

    it('ignores an unknown id and a no-op reopen', () => {
        const context = makeContext();
        const state = createInitialState(context, 'h-001');
        expect(encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-404' }, context)).toBe(state);
        expect(encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-001' }, context)).toBe(state);
    });

    it('does not mutate the state or the input list', () => {
        const context = makeContext();
        const highlightsBefore = JSON.stringify(HIGHLIGHTS);
        const state = createInitialState(context, 'h-001');
        const stateBefore = JSON.stringify(state);
        const next = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        encounterReducer(next, { type: 'COMMIT_QUOTE' }, context);
        expect(JSON.stringify(state)).toBe(stateBefore);
        expect(JSON.stringify(HIGHLIGHTS)).toBe(highlightsBefore);
    });

    it('records a cycle reset when the selector asks for one', () => {
        const context = makeContext({
            selector: () => ({ kind: 'selected', id: 'h-002', bookId: 'b-002', reason: 'all', scopeKey: 'all', cycleReset: true }),
        });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(cycleOf(state, 'all').highlightIds).toEqual(['h-002']);
        expect(state.historyIds).toEqual(['h-001', 'h-002']);
    });
});

describe('persistent stage scope', () => {
    it('starts in 随便看看', () => {
        const state = createInitialState(makeContext(), 'h-001');
        expect(state.stageScope).toEqual({ kind: 'all' });
    });

    it('switches the range and commits a passage of that range in one step', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context);

        // The label and the sentence can never disagree: t-002 only holds b-002.
        expect(state.stageScope).toEqual({ kind: 'theme', themeId: 't-002' });
        expect(state.currentId).toBe('h-002');
        expect(state.commitCount).toBe(1);
        expect(state.sourceOpen).toBe(false);
    });

    it('stays in the shelf for every following draw', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-001' } }, context);
        expect(state.stageScope).toEqual({ kind: 'theme', themeId: 't-001' });

        for (let index = 0; index < 4; index += 1) {
            state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
            state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
            expect(state.stageScope).toEqual({ kind: 'theme', themeId: 't-001' });
            // Only books filed on t-001 may appear while the visitor is in that shelf.
            const bookId = HIGHLIGHTS.find((item) => item.id === state.currentId)?.bookId;
            expect(['b-001', 'b-003']).toContain(bookId);
        }
    });

    it('refuses to enter a shelf that holds nothing, instead of showing a lying label', () => {
        const context = makeContext({ selector: selectNext });
        const state = createInitialState(context, 'h-001');
        const next = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-404' } }, context);

        expect(next.stageScope).toEqual({ kind: 'all' });
        expect(next.currentId).toBe('h-001');
        expect(next.lastResult.kind).toBe('empty');
        expect(next.commitCount).toBe(0);
    });

    it('changes the range without a redraw when the shelf holds only the passage on screen', () => {
        const books = [...BOOKS, makeBook('b-004', ['t-004'])];
        const highlights = [...HIGHLIGHTS, passage('h-005', 'b-004')];
        const context = makeContext({ books, highlights, selector: selectNext });
        const state = openPassage(context, 'h-005');

        const next = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-004' } }, context);
        expect(next.stageScope).toEqual({ kind: 'theme', themeId: 't-004' });
        expect(next.currentId).toBe('h-005');
        expect(next.lastResult.kind).toBe('only-current');
        expect(next.commitCount).toBe(state.commitCount);
    });

    it('ignores a switch to the range it is already in, and a switch while a draw is leaving', () => {
        const context = makeContext();
        const idle = createInitialState(context, 'h-001');
        expect(encounterReducer(idle, { type: 'SET_STAGE_SCOPE', scope: { kind: 'all' } }, context)).toBe(idle);

        const busy = encounterReducer(idle, { type: 'NEXT_STAGE' }, context);
        expect(busy.phase).toBe('exiting');
        expect(encounterReducer(busy, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context)).toBe(busy);
    });

    it('keeps a transient book move out of the stage range', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-001' } }, context);
        const scopeBefore = state.stageScope;

        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.stageScope).toEqual(scopeBefore);

        // And the next stage draw still belongs to the shelf the visitor is in.
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        const bookId = HIGHLIGHTS.find((item) => item.id === state.currentId)?.bookId;
        expect(['b-001', 'b-003']).toContain(bookId);
    });

    it('returns to the original range after leaving a book', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context);
        expect(state.stageScope).toEqual({ kind: 'theme', themeId: 't-002' });

        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);
        expect(state.stageScope).toEqual({ kind: 'theme', themeId: 't-002' });

        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(state.currentId).toBe('h-002');
    });

    it('returns to 随便看看 when asked', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context);
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'all' } }, context);
        expect(state.stageScope).toEqual({ kind: 'all' });
        expect(state.currentId).not.toBeNull();
    });
});

describe('cycles are kept per scope', () => {
    it('does not let a shelf consume the all-scope cycle', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        expect(cycleOf(state, 'all').highlightIds).toEqual(['h-001']);

        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context);
        expect(cycleOf(state, 'all').highlightIds).toEqual(['h-001']);
        expect(cycleOf(state, 'theme:t-002').highlightIds).toEqual(['h-002']);

        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'all' } }, context);
        expect(cycleOf(state, 'theme:t-002').highlightIds).toEqual(['h-002']);
    });

    it('keeps two shelves independent of each other', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-001' } }, context);
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-002' } }, context);
        state = encounterReducer(state, { type: 'SET_STAGE_SCOPE', scope: { kind: 'theme', themeId: 't-001' } }, context);

        expect(cycleOf(state, 'theme:t-001').highlightIds).toHaveLength(2);
        expect(cycleOf(state, 'theme:t-002').highlightIds).toEqual(['h-002']);
    });

    it('gives each book its own visit cycle', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);

        // b-001 holds h-001 and h-004, so the visit now remembers both.
        expect(cycleOf(state, 'book:b-001').highlightIds).toEqual(['h-001', 'h-004']);
        expect(cycleOf(state, 'book:b-002')).toEqual(EMPTY_CYCLE);
    });

    it('starts a fresh visit when the visitor arrives at another book', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-002' }, context);

        expect(cycleOf(state, 'book:b-001').highlightIds).toEqual(['h-001', 'h-004']);
        expect(cycleOf(state, 'book:b-002').highlightIds).toEqual(['h-002']);
    });

    it('remembers a direct open in the stage cycle so it is not drawn straight back', () => {
        const context = makeContext({ selector: selectNext });
        const state = openPassage(context, 'h-003');
        expect(cycleOf(state, 'all').highlightIds).toEqual(['h-003']);

        const next = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(next.pending?.id).not.toBe('h-003');
    });

    it('counts only the unseen passages of the current visit', () => {
        const context = makeContext({ selector: selectNext });
        let state = createInitialState(context, 'h-001');
        expect(unseenInBookCount(state, HIGHLIGHTS)).toBe(1);

        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        expect(unseenInBookCount(state, HIGHLIGHTS)).toBe(0);

        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-002' }, context);
        expect(unseenInBookCount(state, HIGHLIGHTS)).toBe(0);
        expect(unseenInBookCount(createInitialState(makeContext({ highlights: [] })), [])).toBe(0);
    });
});

describe('source reveal', () => {
    it('opens and closes the source panel for the current passage', () => {
        const context = makeContext();
        let state = createInitialState(context, 'h-001');
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
        const empty = createInitialState({ ...context, highlights: [], books: [] });
        expect(encounterReducer(empty, { type: 'OPEN_SOURCE' }, context)).toBe(empty);
    });

    it('closes the source as soon as a stage passage is requested', () => {
        const context = makeContext();
        let state = encounterReducer(createInitialState(context, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        expect(state.sourceOpen).toBe(true);
        state = encounterReducer(state, { type: 'NEXT_STAGE' }, context);
        expect(state.sourceOpen).toBe(false);
    });

    it('moves inside one book and keeps the source open', () => {
        const context = makeContext({ selector: selectNext });
        let state = encounterReducer(createInitialState(context, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        expect(state.pending?.id).toBe('h-004');
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);

        expect(state.currentId).toBe('h-004');
        expect(state.sourceOpen).toBe(true);
        expect(state.commitCount).toBe(1);
        expect(state.phase).toBe('entering');
    });

    it('never leaves the book and reports exhaustion instead', () => {
        const context = makeContext({ selector: selectNext });
        let state = encounterReducer(createInitialState(context, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        state = encounterReducer(state, { type: 'COMMIT_QUOTE' }, context);
        state = encounterReducer(state, { type: 'TRANSITION_END' }, context);
        expect(state.currentId).toBe('h-004');

        // Every passage of this book has now been seen; b-002 must not be substituted in.
        const exhausted = encounterReducer(state, { type: 'NEXT_IN_BOOK' }, context);
        expect(exhausted.lastResult.kind).toBe('exhausted-book');
        expect(exhausted.currentId).toBe('h-004');
        expect(exhausted.commitCount).toBe(state.commitCount);
        expect(describeBookDeadEnd(exhausted)).toContain('已经看完');
        expect(describeBookDeadEnd(state)).toBeNull();
    });

    it('ignores book moves while a transition is in flight and without a passage', () => {
        const context = makeContext({ selector: selectNext });
        const idle = createInitialState(context, 'h-001');
        const busy = encounterReducer(idle, { type: 'NEXT_STAGE' }, context);
        expect(encounterReducer(busy, { type: 'NEXT_IN_BOOK' }, context)).toBe(busy);
        const empty = createInitialState({ ...context, highlights: [], books: [] });
        expect(encounterReducer(empty, { type: 'NEXT_IN_BOOK' }, context).currentId).toBeNull();
    });

    it('updates the source panel for a direct open of another passage', () => {
        const context = makeContext();
        let state = encounterReducer(createInitialState(context, 'h-001'), { type: 'OPEN_SOURCE' }, context);
        state = encounterReducer(state, { type: 'OPEN_HIGHLIGHT', id: 'h-003' }, context);
        expect(state.currentId).toBe('h-003');
        expect(state.sourceOpen).toBe(false);
    });
});

describe('deterministic reference ordering', () => {
    const base = {
        books: BOOKS,
        highlights: HIGHLIGHTS,
        currentBookId: null,
        cycle: EMPTY_CYCLE,
        currentBand: null,
        recentIds: [],
        rng: () => 0,
    };

    it('walks the snapshot in order and wraps around', () => {
        expect(selectSequential({ ...base, currentId: 'h-001', scope: { kind: 'all' } })).toEqual({
            kind: 'selected',
            id: 'h-002',
            bookId: 'b-002',
            reason: 'all',
            scopeKey: 'all',
        });
        expect(selectSequential({ ...base, currentId: 'h-004', scope: { kind: 'all' } })).toEqual({
            kind: 'selected',
            id: 'h-001',
            bookId: 'b-001',
            reason: 'all',
            scopeKey: 'all',
        });
    });

    it('stays inside one book when the scope is a book', () => {
        const result = selectSequential({
            ...base,
            currentId: 'h-001',
            currentBookId: 'b-001',
            scope: { kind: 'book', bookId: 'b-001' },
        });
        expect(result.kind).toBe('selected');
        if (result.kind === 'selected') {
            expect(result.id).toBe('h-004');
            expect(result.reason).toBe('book');
        }
    });
});
