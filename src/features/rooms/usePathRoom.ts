import { useCallback, useEffect, useRef, useState } from 'react';
import {
    branchPathWalk,
    nextInPathWalk,
    restartPathWalk,
    startPathWalk,
    type PathRhythm,
    type PathWalkState,
} from '../../domain/pathWalk.ts';
import type { Highlight } from '../../domain/types.ts';

export type PathRoomController = {
    state: PathWalkState;
    next: () => void;
    restart: () => void;
    setRhythm: (rhythm: PathRhythm) => void;
    /** Prepare another path around the intersection before its URL is pushed. */
    branch: (nextTagId: string) => void;
};

/**
 * One finite walk per Topic Tag for the life of the document.
 *
 * The cache is committed from effects, while event handlers always advance rendered state. Branching is
 * the one deliberate exception: it stores the new tag session before navigation, so the arriving room
 * paints the same intersection passage on its first frame and browser Back can restore the old path.
 */
export function usePathWalks(activeTagId: string, highlights: readonly Highlight[]): PathRoomController {
    const sessions = useRef(new Map<string, PathWalkState>());
    const passages = useCallback(() => highlights, [highlights]);
    const [activeState, setActiveState] = useState<PathWalkState>(() =>
        startPathWalk(activeTagId, highlights, 'semantic', Math.random),
    );
    const [renderedTagId, setRenderedTagId] = useState(activeTagId);

    if (renderedTagId !== activeTagId) {
        setRenderedTagId(activeTagId);
        const existing = sessions.current.get(activeTagId);
        setActiveState(existing ?? startPathWalk(activeTagId, highlights, 'semantic', Math.random));
    }

    useEffect(() => {
        sessions.current.set(renderedTagId, activeState);
    }, [activeState, renderedTagId]);

    const next = useCallback(() => {
        setActiveState((current) => nextInPathWalk(current, passages(), Math.random));
    }, [passages]);

    const restart = useCallback(() => {
        setActiveState((current) => restartPathWalk(current, passages(), Math.random));
    }, [passages]);

    const setRhythm = useCallback((rhythm: PathRhythm) => {
        setActiveState((current) => (current.rhythm === rhythm ? current : { ...current, rhythm }));
    }, []);

    const branch = useCallback(
        (nextTagId: string) => {
            const next = branchPathWalk(activeState, nextTagId, passages(), activeState.rhythm, Math.random);
            sessions.current.set(nextTagId, next);
        },
        [activeState, passages],
    );

    return { state: activeState, next, restart, setRhythm, branch };
}
