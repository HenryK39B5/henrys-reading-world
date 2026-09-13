import { describe, expect, it } from 'vitest';
import { scrollbarGutter } from './useScrollLock.ts';

/**
 * The one piece of the scroll lock that can be checked without a browser (docs/16 §6).
 *
 * The rest of the hook is about the document itself, and its behaviour is covered in the browser by
 * `e2e/scroll-lock.spec.ts`. What is worth pinning here is the arithmetic: a browser with classic
 * scrollbars takes real width away from the page, and a browser with overlay scrollbars (or none at all)
 * must not be given an invented padding.
 */
describe('the scrollbar gutter', () => {
    it('reports the width a classic scrollbar takes', () => {
        expect(scrollbarGutter(1440, 1425)).toBe(15);
        expect(scrollbarGutter(390, 390)).toBe(0);
    });

    it('never reports a negative gutter', () => {
        // A zoomed or fractional layout can report a client width larger than the window; compensating for
        // that would push the whole page sideways.
        expect(scrollbarGutter(1000, 1001)).toBe(0);
        expect(scrollbarGutter(0, 0)).toBe(0);
    });

    it('rounds a fractional measurement instead of writing a fractional padding', () => {
        expect(scrollbarGutter(1440, 1424.6)).toBe(15);
        expect(scrollbarGutter(1440, 1425.4)).toBe(15);
    });
});
