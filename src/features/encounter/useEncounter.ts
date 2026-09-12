import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
    createInitialState,
    encounterReducer,
    isBusy,
    type EncounterEvent,
    type EncounterState,
    type TransitionDurations,
} from '../../domain/encounter.ts';
import type { Selector } from '../../domain/selection.ts';
import { selectInitialOpening, selectSequential } from '../../domain/sequence.ts';
import type { Highlight } from '../../domain/types.ts';

export const EXIT_MS = 160;
export const ENTER_MS = 280;

export type EncounterController = {
    state: EncounterState;
    busy: boolean;
    next: () => void;
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
export function useEncounter(highlights: Highlight[], nowYear: number, selector: Selector = selectSequential): EncounterController {
    const reducedMotion = useReducedMotion();
    const durations = useMemo<TransitionDurations>(
        () => (reducedMotion ? { exit: 0, enter: 0 } : { exit: EXIT_MS, enter: ENTER_MS }),
        [reducedMotion],
    );

    const [state, dispatch] = useReducer(
        (current: EncounterState, event: EncounterEvent) => encounterReducer(current, event, { highlights, durations, selector, rng: Math.random, nowYear }),
        undefined,
        () => createInitialState(highlights, selectInitialOpening(highlights)),
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
        dispatch({ type: 'NEXT_GLOBAL' });
    }, []);

    const open = useCallback((id: string) => {
        dispatch({ type: 'OPEN_HIGHLIGHT', id });
    }, []);

    return { state, busy: isBusy(state), next, open };
}
