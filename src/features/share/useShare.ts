import { useCallback, useEffect, useReducer, useRef } from 'react';
import { CLOSED_SHARE, shareReducer, type ShareState } from '../../domain/share.ts';

export type ShareController = {
    state: ShareState;
    /** Locks one passage and opens the dialog; the next `open` locks a new one. */
    open: (highlightId: string) => void;
    close: () => void;
    reportCopy: (ok: boolean) => void;
};

/**
 * Share state, deliberately outside every room session (docs/15 §7.1).
 *
 * It holds a passage id and the outcome of the last copy attempt — nothing else. Rooms, batches and the
 * discovery cycles are therefore untouched by opening a dialog, and whatever the stage does next cannot
 * rewrite the passage that is already locked.
 *
 * Focus is the one browser concern kept here: the control that opened the dialog is remembered, and the
 * focus returns to it once the dialog is really gone.
 */
export function useShare(): ShareController {
    const [state, dispatch] = useReducer(shareReducer, CLOSED_SHARE);
    const trigger = useRef<HTMLElement | null>(null);

    const open = useCallback((highlightId: string) => {
        const active = typeof document === 'undefined' ? null : document.activeElement;
        trigger.current = active instanceof HTMLElement ? active : null;
        dispatch({ type: 'OPEN_SHARE', highlightId });
    }, []);

    const close = useCallback(() => {
        dispatch({ type: 'CLOSE_SHARE' });
    }, []);

    const reportCopy = useCallback((ok: boolean) => {
        dispatch({ type: 'COPY_RESULT', ok });
    }, []);

    // Restoring focus has to wait until the dialog is unmounted: while it is modal, the page behind it
    // cannot take focus at all.
    useEffect(() => {
        if (state.highlightId !== null || trigger.current === null) {
            return;
        }
        const element = trigger.current;
        trigger.current = null;
        // `preventScroll` keeps the page exactly where the reader left it: the trigger was on screen when
        // they used it, and returning the focus must not be a reason for the page to jump (docs/16 §6).
        element.focus({ preventScroll: true });
    }, [state.highlightId]);

    return { state, open, close, reportCopy };
}
