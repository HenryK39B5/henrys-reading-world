import { useCallback, useRef, useState } from 'react';
import { selectRandomFromBook } from '../../domain/discovery.ts';
import { advanceCycle, type CycleState } from '../../domain/selection.ts';
import type { Book, Highlight } from '../../domain/types.ts';

export type BookRoomState = {
    currentId: string | null;
    /** Passages this visit has already shown; used so 随机看一处 does not loop on one line. */
    seen: string[];
    cycle: CycleState;
    /** Nothing new to draw: the book holds a single passage and it is already on screen. */
    exhausted: boolean;
};

export type BookRoomController = {
    state: BookRoomState;
    /** Another real passage of this book, or the same one when the book holds nothing else. */
    random: () => void;
};

const RECENT_WINDOW = 3;

function draw(
    bookId: string,
    current: BookRoomState,
    books: Book[],
    highlights: Highlight[],
): BookRoomState {
    const result = selectRandomFromBook({
        books,
        highlights,
        bookId,
        currentId: current.currentId,
        recentIds: current.seen.slice(-RECENT_WINDOW).filter((id) => id !== current.currentId),
        cycle: current.cycle,
        rng: Math.random,
    });
    if (result.kind !== 'selected') {
        return { ...current, exhausted: result.kind !== 'empty' };
    }
    return {
        currentId: result.id,
        seen: [...current.seen, result.id],
        cycle: advanceCycle(current.cycle, result),
        exhausted: false,
    };
}

/**
 * The random passage of a book room.
 *
 * It is independent of the rooms around it: opening a book never consumes the hall's or a shelf's cycle,
 * and coming back to the same book shows the same passage again until the visitor asks for another one.
 * A book with one passage reports itself instead of pretending there is more.
 */
export function useBookRooms(activeBookId: string, books: Book[], highlights: Highlight[]): BookRoomController {
    const sessions = useRef(new Map<string, BookRoomState>());
    const [activeState, setActiveState] = useState<BookRoomState>(() => {
        const created = draw(
            activeBookId,
            { currentId: null, seen: [], cycle: { bookIds: [], highlightIds: [] }, exhausted: false },
            books,
            highlights,
        );
        sessions.current.set(activeBookId, created);
        return created;
    });
    const [renderedBookId, setRenderedBookId] = useState(activeBookId);

    if (renderedBookId !== activeBookId) {
        setRenderedBookId(activeBookId);
        const existing = sessions.current.get(activeBookId);
        if (existing !== undefined) {
            setActiveState(existing);
        } else {
            const created = draw(
                activeBookId,
                { currentId: null, seen: [], cycle: { bookIds: [], highlightIds: [] }, exhausted: false },
                books,
                highlights,
            );
            sessions.current.set(activeBookId, created);
            setActiveState(created);
        }
    }

    const random = useCallback(() => {
        const current = sessions.current.get(activeBookId);
        if (current === undefined) {
            return;
        }
        const next = draw(activeBookId, current, books, highlights);
        sessions.current.set(activeBookId, next);
        setActiveState(next);
    }, [activeBookId, books, highlights]);

    return { state: activeState, random };
}
