/**
 * Encounter session state machine (docs/02 §5, docs/05 §4).
 *
 * Pure and synchronous: the reducer never schedules timers itself and never reads the clock, so
 * committing, ignoring rapid clicks and cancelling an in-flight transition are all testable
 * without a browser. The React layer only wires timer events into it.
 */
import type { SelectionInput, SelectionResult, Selector } from './selection.ts';
import type { Highlight } from './types.ts';

export type Phase = 'idle' | 'exiting' | 'entering';

/** 0 durations are used when the visitor asks for reduced motion. */
export type TransitionDurations = {
    exit: number;
    enter: number;
};

export type EncounterState = {
    phase: Phase;
    currentId: string | null;
    /** Chosen target of the transition in flight. */
    pending: Extract<SelectionResult, { kind: 'selected' }> | null;
    /** Which action started the transition in flight; a book move keeps the source panel open. */
    pendingScope: 'global' | 'book' | null;
    /** Whether the source panel is expanded for the current passage. */
    sourceOpen: boolean;
    /** Outcome of the most recent request, so the UI can explain "only one passage" etc. */
    lastResult: SelectionResult;
    /** Exposure order for the session; repeats only after a cycle reset. */
    historyIds: string[];
    /** Ids shown since the last cycle reset. */
    seenInCycle: string[];
    /** Committed global-stage draws. */
    globalDrawCount: number;
    /** Total committed changes, including direct opens; used to assert no double commits. */
    commitCount: number;
};

export type EncounterEvent =
    | { type: 'NEXT_GLOBAL' }
    /** Another passage from the book currently on screen; never crosses into another book. */
    | { type: 'NEXT_IN_BOOK' }
    | { type: 'COMMIT_QUOTE' }
    | { type: 'TRANSITION_END' }
    | { type: 'OPEN_SOURCE' }
    | { type: 'CLOSE_SOURCE' }
    | { type: 'OPEN_HIGHLIGHT'; id: string };

export type EncounterContext = {
    highlights: Highlight[];
    durations: TransitionDurations;
    selector: Selector;
    rng: () => number;
};

export function createInitialState(highlights: Highlight[], initialId: string | null): EncounterState {
    const known = initialId !== null && highlights.some((item) => item.id === initialId);
    const currentId = known ? initialId : null;
    return {
        phase: 'idle',
        currentId,
        pending: null,
        pendingScope: null,
        sourceOpen: false,
        // A valid deep link already counts as the first committed draw, so the next one is a contrast.
        lastResult: currentId === null ? { kind: 'empty' } : { kind: 'selected', id: currentId, reason: 'opening' },
        historyIds: currentId === null ? [] : [currentId],
        seenInCycle: currentId === null ? [] : [currentId],
        globalDrawCount: currentId === null ? 0 : 1,
        commitCount: 0,
    };
}

function selectionInput(state: EncounterState, context: EncounterContext, scope: SelectionInput['scope']): SelectionInput {
    return {
        highlights: context.highlights,
        currentId: state.currentId,
        historyIds: state.historyIds,
        seenInCycle: state.seenInCycle,
        globalDrawCount: state.globalDrawCount,
        scope,
        rng: context.rng,
    };
}

function commit(
    state: EncounterState,
    choice: Extract<SelectionResult, { kind: 'selected' }>,
    context: EncounterContext,
    sourceOpen: boolean,
    countsAsGlobalDraw: boolean,
): EncounterState {
    const seen = choice.cycleReset === true ? [choice.id] : [...state.seenInCycle, choice.id];
    return {
        ...state,
        phase: context.durations.enter === 0 ? 'idle' : 'entering',
        currentId: choice.id,
        pending: null,
        pendingScope: null,
        sourceOpen,
        lastResult: choice,
        historyIds: [...state.historyIds, choice.id],
        seenInCycle: seen,
        globalDrawCount: state.globalDrawCount + (countsAsGlobalDraw ? 1 : 0),
        commitCount: state.commitCount + 1,
    };
}

export function encounterReducer(state: EncounterState, event: EncounterEvent, context: EncounterContext): EncounterState {
    switch (event.type) {
        case 'NEXT_GLOBAL': {
            // Only one transition may be in flight; every other click is ignored rather than queued.
            if (state.phase !== 'idle') {
                return state;
            }
            const result = context.selector(selectionInput(state, context, { kind: 'global' }));
            // The source panel belongs to the passage that is leaving; close it with the request so the
            // outgoing view never shows a stale source.
            if (result.kind !== 'selected') {
                return { ...state, lastResult: result };
            }
            if (context.durations.exit === 0) {
                return commit(state, result, context, false, true);
            }
            return { ...state, phase: 'exiting', pending: result, pendingScope: 'global', sourceOpen: false };
        }

        case 'NEXT_IN_BOOK': {
            if (state.phase !== 'idle' || state.currentId === null) {
                return state;
            }
            const current = context.highlights.find((item) => item.id === state.currentId);
            if (current === undefined) {
                return state;
            }
            const result = context.selector(selectionInput(state, context, { kind: 'book', bookId: current.bookId }));
            if (result.kind !== 'selected') {
                // Exhausted book and empty book are reported to the visitor instead of silently moving on.
                return { ...state, lastResult: result };
            }
            if (context.durations.exit === 0) {
                return commit(state, result, context, true, false);
            }
            return { ...state, phase: 'exiting', pending: result, pendingScope: 'book', sourceOpen: true };
        }

        case 'COMMIT_QUOTE': {
            if (state.phase !== 'exiting' || state.pending === null) {
                return state;
            }
            const keepOpen = state.pendingScope === 'book';
            return commit(state, state.pending, context, keepOpen, state.pendingScope === 'global');
        }

        case 'TRANSITION_END': {
            return state.phase === 'entering' ? { ...state, phase: 'idle' } : state;
        }

        case 'OPEN_SOURCE': {
            if (state.currentId === null || state.sourceOpen) {
                return state;
            }
            return { ...state, sourceOpen: true };
        }

        case 'CLOSE_SOURCE': {
            return state.sourceOpen ? { ...state, sourceOpen: false } : state;
        }

        case 'OPEN_HIGHLIGHT': {
            const target = context.highlights.find((item) => item.id === event.id);
            if (target === undefined) {
                return state;
            }
            if (target.id === state.currentId && state.phase === 'idle') {
                return state;
            }
            // A direct open cancels any transition in flight and does not consume a global draw.
            return {
                ...state,
                phase: 'idle',
                currentId: target.id,
                pending: null,
                pendingScope: null,
                sourceOpen: false,
                lastResult: { kind: 'selected', id: target.id, reason: 'fallback' },
                historyIds: [...state.historyIds, target.id],
                seenInCycle: state.seenInCycle.includes(target.id) ? state.seenInCycle : [...state.seenInCycle, target.id],
                commitCount: state.commitCount + 1,
            };
        }

        default: {
            return state;
        }
    }
}

export function isBusy(state: EncounterState): boolean {
    return state.phase !== 'idle';
}

/** True when the visitor has nowhere to go: a single passage, or an empty snapshot. */
export function describeDeadEnd(state: EncounterState): string | null {
    if (state.lastResult.kind === 'only-current') {
        return '这个空间目前只收录了一处划线。';
    }
    if (state.lastResult.kind === 'empty') {
        return '目前没有可展示的划线。';
    }
    return null;
}

/** Explains why "再看一处" cannot deliver another passage from this book. */
export function describeBookDeadEnd(state: EncounterState): string | null {
    if (state.lastResult.kind === 'exhausted-book') {
        return '这本书里收录的划线已经看完了。';
    }
    return null;
}
