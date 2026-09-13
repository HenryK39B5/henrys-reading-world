import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createInitialState,
    encounterReducer,
    isBusy,
    settleSession,
    type EncounterContext,
    type EncounterEvent,
    type EncounterState,
    type TransitionDurations,
} from '../../domain/encounter.ts';
import { selectNext } from '../../domain/discovery.ts';
import type { Selector, StageScope } from '../../domain/selection.ts';
import type { Book, Highlight } from '../../domain/types.ts';
import { useReducedMotion } from './useReducedMotion.ts';

export const EXIT_MS = 160;
export const ENTER_MS = 280;

export type StageSessionOptions = {
    highlights: Highlight[];
    books: Book[];
    /** The drawing range of one room key; a hall and a shelf room never share a cycle. */
    scopeFor: (key: string) => StageScope;
    /**
     * The passage a room must open with when the URL asked for one (`/?h=<id>`, docs/15 §4.1).
     *
     * It is only consulted when a session is *created*: a room that already exists keeps the sentence it
     * was showing, and a later deep link goes through `openDeepLink` instead.
     */
    seedFor?: (key: string) => string | null;
    selector?: Selector;
};

export type StageSessionController = {
    state: EncounterState;
    busy: boolean;
    next: () => void;
    nextInBook: () => void;
    openSource: () => void;
    closeSource: () => void;
    /** Shows the passage a deep link names, without counting it as a move the visitor made. */
    openDeepLink: (id: string) => void;
};

/**
 * One passage session per room.
 *
 * docs/12 §3 requires that coming back to a room restores the sentence that was there. Each room key
 * therefore keeps its own `EncounterState` — its own current passage, its own scope cycle, its own
 * history — and leaving a room settles any transition that was in flight so a stale timer can never
 * commit a draw into a room the visitor has already left.
 *
 * The store lives in a ref because it is session bookkeeping, not rendered state; only the active
 * room's snapshot is React state, so nothing re-renders from another room's updates. The rendered
 * session is mirrored back into the store by an effect rather than by the lazy initial state, because
 * React runs a lazy initializer twice in development and the two runs would disagree about the passage.
 */
export function useStageSessions(
    sessionKey: string,
    /** The room on screen. It settles the stage even when the session key itself does not change. */
    roomKey: string,
    options: StageSessionOptions,
): StageSessionController {
    const reducedMotion = useReducedMotion();
    const durations = useMemo<TransitionDurations>(
        () => (reducedMotion ? { exit: 0, enter: 0 } : { exit: EXIT_MS, enter: ENTER_MS }),
        [reducedMotion],
    );
    const selector = options.selector ?? selectNext;
    const { books, highlights, scopeFor, seedFor } = options;

    const context = useMemo<EncounterContext>(
        () => ({ books, highlights, durations, selector, rng: Math.random }),
        [books, highlights, durations, selector],
    );

    const sessions = useRef(new Map<string, EncounterState>());
    const [activeState, setActiveState] = useState<EncounterState>(() =>
        createInitialState(context, seedFor?.(sessionKey) ?? null, scopeFor(sessionKey)),
    );
    const [renderedKey, setRenderedKey] = useState(sessionKey);
    const renderedRoom = useRef(roomKey);

    // The session on screen is the session of its room; everything else in the map is a room waiting.
    useEffect(() => {
        sessions.current.set(renderedKey, activeState);
    }, [renderedKey, activeState]);

    /** The session of a room, created on first visit and reused on every return. */
    const sessionFor = useCallback(
        (key: string): EncounterState => {
            const existing = sessions.current.get(key);
            if (existing !== undefined) {
                return existing;
            }
            const created = createInitialState(context, seedFor?.(key) ?? null, scopeFor(key));
            sessions.current.set(key, created);
            return created;
        },
        [context, scopeFor, seedFor],
    );

    if (renderedKey !== sessionKey) {
        // Adjusting during render keeps a room switch atomic: the arriving room never paints the
        // previous room's sentence, not even for a frame.
        sessions.current.set(renderedKey, settleSession(sessions.current.get(renderedKey) ?? activeState));
        setRenderedKey(sessionKey);
        setActiveState(sessionFor(sessionKey));
    }

    if (renderedRoom.current !== roomKey) {
        // Leaving a room abandons whatever it was in the middle of: a fade-out that was still running must
        // not commit its draw later, and the room must not be left looking busy for the next visit.
        renderedRoom.current = roomKey;
        const current = sessions.current.get(sessionKey) ?? activeState;
        const settled = settleSession(current);
        if (settled !== current) {
            sessions.current.set(sessionKey, settled);
            setActiveState(settled);
        }
    }

    const dispatch = useCallback(
        (event: EncounterEvent) => {
            const current = sessions.current.get(sessionKey);
            if (current === undefined) {
                return;
            }
            const next = encounterReducer(current, event, context);
            if (next === current) {
                return;
            }
            sessions.current.set(sessionKey, next);
            setActiveState(next);
        },
        [sessionKey, context],
    );

    useEffect(() => {
        if (activeState.phase === 'idle') {
            return;
        }
        const event: EncounterEvent =
            activeState.phase === 'exiting' ? { type: 'COMMIT_QUOTE' } : { type: 'TRANSITION_END' };
        const delay = activeState.phase === 'exiting' ? durations.exit : durations.enter;
        const timer = window.setTimeout(() => {
            dispatch(event);
        }, delay);
        return () => {
            window.clearTimeout(timer);
        };
    }, [activeState, dispatch, durations.exit, durations.enter]);

    return {
        state: activeState,
        busy: isBusy(activeState),
        next: useCallback(() => {
            dispatch({ type: 'NEXT_STAGE' });
        }, [dispatch]),
        nextInBook: useCallback(() => {
            dispatch({ type: 'NEXT_IN_BOOK' });
        }, [dispatch]),
        openSource: useCallback(() => {
            dispatch({ type: 'OPEN_SOURCE' });
        }, [dispatch]),
        closeSource: useCallback(() => {
            dispatch({ type: 'CLOSE_SOURCE' });
        }, [dispatch]),
        openDeepLink: useCallback(
            (id: string) => {
                dispatch({ type: 'OPEN_DEEP_LINK', id });
            },
            [dispatch],
        ),
    };
}
