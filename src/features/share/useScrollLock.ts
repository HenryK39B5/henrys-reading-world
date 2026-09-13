import { useLayoutEffect } from 'react';

/**
 * Inline styles the dialog takes over while it owns the page. Everything written here is restored from
 * the snapshot on close, and nothing outside this list is touched.
 */
const ROOT_PROPERTIES = ['overflow', 'overscroll-behavior'] as const;
const BODY_PROPERTIES = [
    'overflow',
    'overscroll-behavior',
    'position',
    'top',
    'left',
    'right',
    'padding-right',
] as const;

type InlineStyle = [property: string, value: string];

type ScrollSnapshot = {
    scrollX: number;
    scrollY: number;
    root: InlineStyle[];
    body: InlineStyle[];
};

/**
 * How much width the viewport scrollbar takes, if it takes any.
 *
 * Exposed as a function of its two inputs so the arithmetic is testable without a browser, and clamped
 * because a browser that reports nothing (`0`) or an overlay scrollbar must not produce a negative or
 * invented padding.
 */
export function scrollbarGutter(innerWidth: number, clientWidth: number): number {
    return Math.max(0, Math.round(innerWidth - clientWidth));
}

function readInline(element: HTMLElement, properties: readonly string[]): InlineStyle[] {
    return properties.map((property) => [property, element.style.getPropertyValue(property)]);
}

function writeInline(element: HTMLElement, entries: InlineStyle[]): void {
    for (const [property, value] of entries) {
        element.style.removeProperty(property);
        // An empty original means "the stylesheet decides", so it comes back by removing the property.
        if (value !== '') {
            element.style.setProperty(property, value);
        }
    }
}

function takeSnapshot(): ScrollSnapshot {
    return {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        root: readInline(document.documentElement, ROOT_PROPERTIES),
        body: readInline(document.body, BODY_PROPERTIES),
    };
}

function lock(snapshot: ScrollSnapshot): void {
    const root = document.documentElement;
    const { body } = document;
    // Measured before anything is hidden: once the viewport scrollbar is gone the two widths are equal
    // and the reading would always be zero, which is exactly the bug this ordering avoids.
    const gutter = scrollbarGutter(window.innerWidth, root.clientWidth);

    for (const element of [root, body]) {
        element.style.setProperty('overflow', 'hidden');
        element.style.setProperty('overscroll-behavior', 'none');
    }

    /**
     * The body leaves the flow, which is what actually makes the page immovable: the document is left
     * with no scrollable overflow at all, so a wheel the compositor had already accepted cannot move it.
     *
     * The negative `top` is the part that keeps the reader's place. Locking the root alone is not enough
     * and is in fact worse than doing nothing: with `overflow: hidden` on the viewport, Chromium clamps
     * the scroll offset to zero, so the page silently jumps to its top while the dialog is open. Pinning
     * the body at the negative of the saved offset keeps every line exactly where it was.
     */
    body.style.setProperty('position', 'fixed');
    body.style.setProperty('top', `-${String(snapshot.scrollY)}px`);
    body.style.setProperty('left', '0');
    body.style.setProperty('right', '0');
    // The viewport scrollbar is gone now, so without this every centred line would move sideways. The
    // measuring pass on this machine reports no gutter at all, and then nothing is written.
    if (gutter > 0) {
        body.style.setProperty('padding-right', `${String(gutter)}px`);
    }
}

function unlock(snapshot: ScrollSnapshot): void {
    writeInline(document.documentElement, snapshot.root);
    writeInline(document.body, snapshot.body);
    /**
     * Putting the body back into the flow does not by itself make the page scrollable again: until the
     * browser recomputes layout, the document is still the one with nothing to scroll, so a restore here
     * is silently clamped to zero and the reader's offset is lost. Reading a layout value forces the
     * recomputation.
     *
     * This is not theoretical: in development React mounts every effect twice, so the lock is taken,
     * released and taken again inside a single task. Without the forced read the second lock snapshots
     * the clamped zero and pins the page to its top.
     */
    void document.documentElement.scrollHeight;
    // Out of flow, the document had nothing to scroll, so the offset is put back explicitly rather than
    // expected to have survived. This runs in the layout cleanup, before the browser paints the dialog's
    // removal, so the visitor never sees the page at its top.
    if (window.scrollX !== snapshot.scrollX || window.scrollY !== snapshot.scrollY) {
        window.scrollTo(snapshot.scrollX, snapshot.scrollY);
    }
}

/**
 * Holds the page still while the share dialog owns it (docs/16 §6).
 *
 * The history behind this hook: one full parallel run left the hall scrolled by 210px with the dialog
 * open, while the same check passed 10/10 and 50/50 in isolation. A probe on this Chromium showed why —
 * `overflow: hidden` on the viewport stops the visitor from scrolling, but it never stopped a
 * programmatic scroll, and a wheel already in flight can still be applied by the compositor before the
 * lock is committed under CPU contention. So the page is not merely asked to stay still: it is left with
 * nothing to scroll, and the visitor's exact position is restored when the dialog closes.
 */
export function useScrollLock(): void {
    useLayoutEffect(() => {
        const snapshot = takeSnapshot();
        lock(snapshot);
        return () => {
            unlock(snapshot);
        };
    }, []);
}
