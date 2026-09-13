/**
 * Encounter session state machine (docs/02 §5, docs/05 §4, docs/10 §5).
 *
 * Pure and synchronous: the reducer never schedules timers itself and never reads the clock, so
 * committing, ignoring rapid clicks and cancelling an in-flight transition are all testable without a
 * browser. The React layer only wires timer events into it.
 *
 * v2 shape:
 *
 *   - `stageScope` is persistent (`随便看看` or `正在逛：<主题>`); every stage draw uses it;
 *   - a transient in-book move never changes it and never spends its cycle, so `再看一处` stays a local
 *     action that cannot hide a book from the range the visitor is actually browsing;
 *   - cycles are kept per scope key plus one visit cycle per book, so no scope consumes another's;
 *   - `SET_STAGE_SCOPE` switches the range and commits a passage of that range in one step.
 */
import { lengthBand } from './length.ts';
import {
    ALL_SCOPE,
    EMPTY_CYCLE,
    bookCycleKey,
    scopeKeyOf,
    sameScope,
    withPassage,
    type CycleKey,
    type CycleState,
    type SelectedPassage,
    type SelectionInput,
    type SelectionResult,
    type SelectionScope,
    type Selector,
    type StageScope,
} from './selection.ts';
import type { Book, Highlight } from './types.ts';

export type Phase = 'idle' | 'exiting' | 'entering';

/** 0 durations are used when the visitor asks for reduced motion. */
export type TransitionDurations = {
    exit: number;
    enter: number;
};

/** Which action started the transition in flight; a book move keeps the source panel open. */
export type PendingKind = 'stage' | 'book';

export type EncounterState = {
    phase: Phase;
    currentId: string | null;
    /** Chosen target of the transition in flight. */
    pending: SelectedPassage | null;
    pendingKind: PendingKind | null;
    /** Whether the source panel is expanded for the current passage. */
    sourceOpen: boolean;
    /** Outcome of the most recent request, so the UI can explain "only one passage" etc. */
    lastResult: SelectionResult;
    /** Exposure order for the session; repeats only after a cycle reset. */
    historyIds: string[];
    /** Persistent browsing range of the stage (docs/10 §5). */
    stageScope: StageScope;
    /** One cycle per scope key (`all`, `theme:<id>`), plus one visit cycle per book. */
    cycles: Record<CycleKey, CycleState>;
    /** Total committed changes, including direct opens; used to assert no double commits. */
    commitCount: number;
};

export type EncounterEvent =
    /** Another passage of the persistent stage scope. */
    | { type: 'NEXT_STAGE' }
    /** Another passage from the book currently on screen; never crosses into another book. */
    | { type: 'NEXT_IN_BOOK' }
    /** Enter a shelf or return to 随便看看; switches the range and commits inside it atomically. */
    | { type: 'SET_STAGE_SCOPE'; scope: StageScope }
    | { type: 'COMMIT_QUOTE' }
    | { type: 'TRANSITION_END' }
    | { type: 'OPEN_SOURCE' }
    | { type: 'CLOSE_SOURCE' }
    /** A passage the visitor deliberately picked (e.g. from a list); it counts as a move they made. */
    | { type: 'OPEN_HIGHLIGHT'; id: string }
    /**
     * A passage a deep link asked for (`/?h=<id>`).
     *
     * It is deliberately a separate event from `OPEN_HIGHLIGHT`: following a URL is not a move the
     * visitor made inside this session, so it must not advance `commitCount` (docs/15 §6.1).
     */
    | { type: 'OPEN_DEEP_LINK'; id: string };

export type EncounterContext = {
    books: Book[];
    highlights: Highlight[];
    durations: TransitionDurations;
    selector: Selector;
    rng: () => number;
};

/** How many passages back the engine treats as "just seen" when it has to repeat one. */
const RECENT_WINDOW = 3;

function findById(highlights: Highlight[], id: string | null): Highlight | null {
    return id === null ? null : (highlights.find((item) => item.id === id) ?? null);
}

function selectionInput(state: EncounterState, context: EncounterContext, scope: SelectionScope): SelectionInput {
    const current = findById(context.highlights, state.currentId);
    return {
        books: context.books,
        highlights: context.highlights,
        currentId: state.currentId,
        currentBookId: current?.bookId ?? null,
        scope,
        cycle: state.cycles[scopeKeyOf(scope)] ?? EMPTY_CYCLE,
        currentBand: current === null ? null : lengthBand(current.text),
        recentIds: state.historyIds.slice(-RECENT_WINDOW).filter((id) => id !== state.currentId),
        rng: context.rng,
    };
}

/**
 * Exposure bookkeeping for one shown passage: the cycle of the range the draw belongs to, plus the
 * visit cycle of the book it belongs to. Arriving at another book starts a fresh visit, so "再看一处"
 * always answers "another passage of this book that I have not seen since I got here".
 *
 * Only draws of the persistent range pass `stage: true`. A transient in-book move is a local action, so
 * it must leave `all` / `theme:<id>` alone: otherwise a few "再看一处" clicks would silently consume the
 * cycle of the range the visitor is browsing and hide the book from its own stage.
 */
function withExposure(
    state: EncounterState,
    context: EncounterContext,
    passage: { id: string; bookId: string },
    options: { stage: boolean; stageScope: StageScope; cycleReset: boolean; bookCycleReset: boolean },
): Record<CycleKey, CycleState> {
    const next = { ...state.cycles };
    if (options.stage) {
        const stageKey = scopeKeyOf(options.stageScope);
        next[stageKey] = withPassage(next[stageKey] ?? EMPTY_CYCLE, passage, {
            cycleReset: options.cycleReset,
            bookCycleReset: options.bookCycleReset,
        });
    }

    const previousBookId = findById(context.highlights, state.currentId)?.bookId ?? null;
    const visitKey = bookCycleKey(passage.bookId);
    const visit = previousBookId === passage.bookId ? (next[visitKey] ?? EMPTY_CYCLE) : EMPTY_CYCLE;
    next[visitKey] = withPassage(visit, passage, { cycleReset: false, bookCycleReset: false });
    return next;
}

type ShowOptions = {
    phase: Phase;
    sourceOpen: boolean;
    /** A visitor action counts; the opening draw and a deep link do not. */
    count: boolean;
    /** Whether this passage belongs to the persistent range or only to a transient in-book move. */
    stage: boolean;
    cycleReset: boolean;
    bookCycleReset: boolean;
    stageScope?: StageScope;
};

function showPassage(
    state: EncounterState,
    context: EncounterContext,
    choice: SelectedPassage,
    options: ShowOptions,
): EncounterState {
    const stageScope = options.stageScope ?? state.stageScope;
    return {
        ...state,
        phase: options.phase,
        currentId: choice.id,
        pending: null,
        pendingKind: null,
        sourceOpen: options.sourceOpen,
        lastResult: choice,
        historyIds: [...state.historyIds, choice.id],
        stageScope,
        cycles: withExposure(state, context, choice, {
            stage: options.stage,
            stageScope,
            cycleReset: options.cycleReset,
            bookCycleReset: options.bookCycleReset,
        }),
        commitCount: options.count ? state.commitCount + 1 : state.commitCount,
    };
}

type CommitOptions = {
    sourceOpen: boolean;
    /** Defaults to a range draw; a transient in-book move passes false. */
    stage?: boolean;
    /** Set when the commit also changes the range (`SET_STAGE_SCOPE`). */
    stageScope?: StageScope;
};

function commit(
    state: EncounterState,
    choice: SelectedPassage,
    context: EncounterContext,
    options: CommitOptions,
): EncounterState {
    const show: ShowOptions = {
        phase: context.durations.enter === 0 ? 'idle' : 'entering',
        sourceOpen: options.sourceOpen,
        count: true,
        stage: options.stage ?? true,
        cycleReset: choice.cycleReset === true,
        bookCycleReset: choice.bookCycleReset === true,
    };
    return options.stageScope === undefined
        ? showPassage(state, context, choice, show)
        : showPassage(state, context, choice, { ...show, stageScope: options.stageScope });
}

/**
 * Shows one passage the caller already identified by id.
 *
 * A direct open cancels any transition in flight and leaves the stage range untouched. It is recorded in
 * the range's cycle on purpose, so the passage that was deliberately opened is not drawn straight back at
 * the next `再来一句`. `count` is the only difference between "the visitor picked this" and "the URL
 * asked for this": the former is a move they made, the latter is not.
 */
function openPassage(
    state: EncounterState,
    context: EncounterContext,
    id: string,
    options: { count: boolean },
): EncounterState {
    const target = findById(context.highlights, id);
    if (target === null) {
        return state;
    }
    if (target.id === state.currentId && state.phase === 'idle') {
        return state;
    }
    return showPassage(
        state,
        context,
        {
            kind: 'selected',
            id: target.id,
            bookId: target.bookId,
            reason: 'fallback',
            scopeKey: scopeKeyOf(state.stageScope),
        },
        {
            phase: 'idle',
            sourceOpen: false,
            count: options.count,
            stage: true,
            cycleReset: false,
            bookCycleReset: false,
        },
    );
}

/**
 * Opens a session. With no chosen passage the first screen is the engine's own fair draw inside
 * `scope`; a deep link is already a decision, so it is shown as it is instead of being replaced.
 *
 * A room passes its own scope (`正在逛：<主题>`), so the shelf's first sentence and every following draw
 * come from that shelf's own cycle.
 */
export function createInitialState(
    context: EncounterContext,
    initialId: string | null = null,
    scope: StageScope = ALL_SCOPE,
): EncounterState {
    const base: EncounterState = {
        phase: 'idle',
        currentId: null,
        pending: null,
        pendingKind: null,
        sourceOpen: false,
        lastResult: { kind: 'empty' },
        historyIds: [],
        stageScope: scope,
        cycles: {},
        commitCount: 0,
    };

    if (initialId !== null) {
        const known = findById(context.highlights, initialId);
        if (known === null) {
            return base;
        }
        return showPassage(
            base,
            context,
            { kind: 'selected', id: known.id, bookId: known.bookId, reason: 'fallback', scopeKey: scopeKeyOf(scope) },
            { phase: 'idle', sourceOpen: false, count: false, stage: true, cycleReset: false, bookCycleReset: false },
        );
    }

    const result = context.selector(selectionInput(base, context, scope));
    if (result.kind !== 'selected') {
        return { ...base, lastResult: result };
    }
    return showPassage(base, context, result, {
        phase: 'idle',
        sourceOpen: false,
        count: false,
        stage: true,
        cycleReset: result.cycleReset === true,
        bookCycleReset: result.bookCycleReset === true,
    });
}

/**
 * Drops a transition that belongs to a room the visitor has left.
 *
 * Each room keeps its own session, so a fade-in that was in flight must not be resumed later by a stale
 * timer: leaving normalises the session to `idle` and discards the pending draw.
 */
export function settleSession(state: EncounterState): EncounterState {
    return state.phase === 'idle' && state.pending === null
        ? state
        : { ...state, phase: 'idle', pending: null, pendingKind: null };
}

export function encounterReducer(state: EncounterState, event: EncounterEvent, context: EncounterContext): EncounterState {
    switch (event.type) {
        case 'NEXT_STAGE': {
            // Only one transition may be in flight; every other click is ignored rather than queued.
            if (state.phase !== 'idle') {
                return state;
            }
            const result = context.selector(selectionInput(state, context, state.stageScope));
            // The source panel belongs to the passage that is leaving; close it with the request so the
            // outgoing view never shows a stale source.
            if (result.kind !== 'selected') {
                return { ...state, lastResult: result };
            }
            if (context.durations.exit === 0) {
                return commit(state, result, context, { sourceOpen: false });
            }
            return { ...state, phase: 'exiting', pending: result, pendingKind: 'stage', sourceOpen: false };
        }

        case 'NEXT_IN_BOOK': {
            if (state.phase !== 'idle' || state.currentId === null) {
                return state;
            }
            const current = findById(context.highlights, state.currentId);
            if (current === null) {
                return state;
            }
            const result = context.selector(selectionInput(state, context, { kind: 'book', bookId: current.bookId }));
            if (result.kind !== 'selected') {
                // Exhausted book and empty book are reported to the visitor instead of silently moving on.
                return { ...state, lastResult: result };
            }
            if (context.durations.exit === 0) {
                // A transient move: it remembers the visit, never the persistent range.
                return commit(state, result, context, { sourceOpen: true, stage: false });
            }
            return { ...state, phase: 'exiting', pending: result, pendingKind: 'book', sourceOpen: true };
        }

        case 'SET_STAGE_SCOPE': {
            // Atomic: the range and a passage inside it commit together, so the label can never
            // disagree with the sentence on screen (docs/11 §4.1). A draw that is leaving must finish
            // first, but a shelf can still be entered while the previous passage is fading in.
            if (state.phase === 'exiting' || sameScope(state.stageScope, event.scope)) {
                return state;
            }
            const result = context.selector(selectionInput(state, context, event.scope));
            if (result.kind === 'selected') {
                return commit(state, result, context, { sourceOpen: false, stageScope: event.scope });
            }
            if (result.kind === 'only-current') {
                // The shelf's single passage is already on screen: change the range, draw nothing new.
                return {
                    ...state,
                    stageScope: event.scope,
                    pending: null,
                    pendingKind: null,
                    sourceOpen: false,
                    lastResult: result,
                };
            }
            // Nothing to draw there. Keeping the old range beats leaving a label that lies about it.
            return { ...state, lastResult: result };
        }

        case 'COMMIT_QUOTE': {
            if (state.phase !== 'exiting' || state.pending === null) {
                return state;
            }
            const isBookMove = state.pendingKind === 'book';
            return commit(state, state.pending, context, { sourceOpen: isBookMove, stage: !isBookMove });
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

        case 'OPEN_HIGHLIGHT':
            return openPassage(state, context, event.id, { count: true });

        case 'OPEN_DEEP_LINK':
            return openPassage(state, context, event.id, { count: false });

        default: {
            return state;
        }
    }
}

export function isBusy(state: EncounterState): boolean {
    return state.phase !== 'idle';
}

/**
 * Passages of the book on screen that the visitor has not seen since arriving at it.
 *
 * The source panel uses this to explain itself instead of offering a dead "再看一处" control.
 */
export function unseenInBookCount(state: EncounterState, highlights: Highlight[]): number {
    const current = findById(highlights, state.currentId);
    if (current === null) {
        return 0;
    }
    const visit = state.cycles[bookCycleKey(current.bookId)] ?? EMPTY_CYCLE;
    return highlights.filter(
        (highlight) =>
            highlight.bookId === current.bookId && highlight.id !== current.id && !visit.highlightIds.includes(highlight.id),
    ).length;
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
