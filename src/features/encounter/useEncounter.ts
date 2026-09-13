import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
    createInitialState,
    encounterReducer,
    isBusy,
    type EncounterEvent,
    type EncounterState,
    type TransitionDurations,
} from '../../domain/encounter.ts';
import { selectNext } from '../../domain/discovery.ts';
import type { Selector, StageScope } from '../../domain/selection.ts';
import type { Book, Highlight } from '../../domain/types.ts';

export const EXIT_MS = 160;
export const ENTER_MS = 280;

export type EncounterController = {
    state: EncounterState;
    busy: boolean;
    next: () => void;
    /** Another passage from the book on screen; never leaves that book or changes the stage range. */
    nextInBook: () => void;
    /** Enter a shelf or return to 随便看看 (docs/10 §5.2); unused by the world layer until V2-C1. */
    setStageScope: (scope: StageScope) => void;
    openSource: () => void;
    closeSource: () => void;
    open: (id: string) => void;
};

/** Tracks the visitor's motion preference and keeps up with changes while the page is open. */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = (matches: boolean) => {
            setReduced(matches);
        };
        const onChange = (event: MediaQueryListEvent) => {
            update(event.matches);
        };
        update(query.matches);
        query.addEventListener('change', onChange);
        return () => {
            query.removeEventListener('change', onChange);
        };
    }, []);

    return reduced;
}

/**
 * Wires the pure encounter machine to real time.
 *
 * The reducer decides *what* happens; this hook only schedules the commit/end events, clears them
 * on unmount and drops duplicate dispatches during StrictMode's double invocation.
 */
export function useEncounter(
    highlights: Highlight[],
    books: Book[] = [],
    selector: Selector = selectNext,
): EncounterController {
    const reducedMotion = useReducedMotion();
    const durations = useMemo<TransitionDurations>(
        () => (reducedMotion ? { exit: 0, enter: 0 } : { exit: EXIT_MS, enter: ENTER_MS }),
        [reducedMotion],
    );

    const [state, dispatch] = useReducer(
        (current: EncounterState, event: EncounterEvent) =>
            encounterReducer(current, event, { books, highlights, durations, selector, rng: Math.random }),
        undefined,
        () => createInitialState({ books, highlights, durations, selector, rng: Math.random }),
    );

    useEffect(() => {
        if (state.phase === 'idle') {
            return;
        }
        const event: EncounterEvent = state.phase === 'exiting' ? { type: 'COMMIT_QUOTE' } : { type: 'TRANSITION_END' };
        const delay = state.phase === 'exiting' ? durations.exit : durations.enter;
        const timer = window.setTimeout(() => {
            dispatch(event);
        }, delay);
        return () => {
            window.clearTimeout(timer);
        };
    }, [state.phase, state.pending, durations.exit, durations.enter]);

    const next = useCallback(() => {
        dispatch({ type: 'NEXT_STAGE' });
    }, []);

    const nextInBook = useCallback(() => {
        dispatch({ type: 'NEXT_IN_BOOK' });
    }, []);

    const setStageScope = useCallback((scope: StageScope) => {
        dispatch({ type: 'SET_STAGE_SCOPE', scope });
    }, []);

    const openSource = useCallback(() => {
        dispatch({ type: 'OPEN_SOURCE' });
    }, []);

    const closeSource = useCallback(() => {
        dispatch({ type: 'CLOSE_SOURCE' });
    }, []);

    const open = useCallback((id: string) => {
        dispatch({ type: 'OPEN_HIGHLIGHT', id });
    }, []);

    return { state, busy: isBusy(state), next, nextInBook, setStageScope, openSource, closeSource, open };
}
