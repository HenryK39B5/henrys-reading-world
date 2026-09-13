import { useLayoutEffect } from 'react';
import { recalledScroll } from '../../app/router.ts';

/**
 * Puts the visitor back where they were in a room.
 *
 * The position itself is recorded by the router before the URL changes (a pushState navigation resets
 * Chromium's scroll position), so this hook only restores: immediately, and once more on the next task
 * because covers and long lists can still settle after the room has committed.
 */
export function useRoomMemory(key: string): void {
    useLayoutEffect(() => {
        const target = recalledScroll(key) ?? 0;
        window.scrollTo({ top: target, behavior: 'auto' });
        const settle = window.setTimeout(() => {
            window.scrollTo({ top: target, behavior: 'auto' });
        }, 0);
        return () => {
            window.clearTimeout(settle);
        };
    }, [key]);
}
