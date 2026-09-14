import { useCallback, useEffect, useRef, useState } from 'react';
import { nextInWalk, restartWalk, startWalk, type BookWalkState } from '../../domain/bookWalk.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';

export type BookRoomController = {
    state: BookWalkState;
    /** Another real passage of this book while the round lasts; a finished round is left finished. */
    next: () => void;
    /** The visitor's own decision to start the book over from its first passage. */
    restart: () => void;
};

/**
 * The walk of the book room (docs/17 §3).
 *
 * One walk is kept per book for the life of the document, so stepping out to a shelf and back shows the
 * same passage and the same progress, while a fresh load begins a fresh round. Nothing is stored outside
 * this session — no localStorage, no account, no cross-device state (docs/17 §3.2).
 *
 * Two rules keep this correct under React's development double-render, and they are the reason the walk
 * is not simply kept in a ref:
 *
 *   1. the per-book cache is written **only from an effect**, i.e. only from a state React actually
 *      committed. A render that React discards must not be able to leave a walk behind that the
 *      committed render disagrees with — a real defect this hook had, which showed up as a two-passage
 *      book walking "2 / 2" while still showing its first passage;
 *   2. the event handlers advance the *committed state*, never the cache, so what the visitor sees and
 *      what the next draw builds on are always the same walk.
 */
export function useBookWalks(activeBookId: string, index: SnapshotIndex): BookRoomController {
    const passagesOf = useCallback((bookId: string) => index.highlightsByBook.get(bookId) ?? [], [index]);
    /** Committed walks of this session, by book. Written by the effect below, read when a book is entered. */
    const session = useRef(new Map<string, BookWalkState>());
    const [activeState, setActiveState] = useState<BookWalkState>(() =>
        startWalk(activeBookId, passagesOf(activeBookId), Math.random),
    );
    const [renderedBookId, setRenderedBookId] = useState(activeBookId);

    // Entering another book: re-use its walk when this session already has one, otherwise open a round.
    // Reading the cache is idempotent, so a discarded render cannot disagree with the committed one.
    if (renderedBookId !== activeBookId) {
        setRenderedBookId(activeBookId);
        const existing = session.current.get(activeBookId);
        setActiveState(existing ?? startWalk(activeBookId, passagesOf(activeBookId), Math.random));
    }

    useEffect(() => {
        session.current.set(activeBookId, activeState);
    }, [activeBookId, activeState]);

    /** `current` here is the committed walk, which is exactly what is on screen. */
    const step = useCallback(
        (walk: (state: BookWalkState) => BookWalkState) => {
            setActiveState((current) => walk(current));
        },
        [],
    );

    const next = useCallback(() => {
        step((current) => nextInWalk(current, passagesOf(activeBookId), Math.random));
    }, [activeBookId, passagesOf, step]);

    const restart = useCallback(() => {
        step((current) => restartWalk(current, passagesOf(activeBookId), Math.random));
    }, [activeBookId, passagesOf, step]);

    return { state: activeState, next, restart };
}
