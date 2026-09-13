import { useCallback, useRef, useState } from 'react';
import { expandCount, visibleCount } from '../../domain/reading.ts';

export type BatchStore = {
    /** How many items of a collection the visitor has asked for; never more than exists. */
    loadedFor: (key: string, total: number) => number;
    /** Remembers one more batch. The key carries the filters, so changing a filter starts a fresh batch. */
    expand: (key: string, total: number, step: number) => void;
};

/**
 * Remembered "show more" counters.
 *
 * The counter belongs to a collection key (a book and its filter), so returning to a room shows the same
 * amount of content the visitor had asked for, while a different filter naturally starts again at its
 * first batch.
 */
export function useBatches(initial: number): BatchStore {
    const store = useRef(new Map<string, number>());
    const [, setVersion] = useState(0);

    const loadedFor = useCallback(
        (key: string, total: number): number => visibleCount(store.current.get(key) ?? initial, total),
        [initial],
    );

    const expand = useCallback(
        (key: string, total: number, step: number): void => {
            const current = visibleCount(store.current.get(key) ?? initial, total);
            store.current.set(key, expandCount(current, total, step));
            setVersion((version) => version + 1);
        },
        [initial],
    );

    return { loadedFor, expand };
}
