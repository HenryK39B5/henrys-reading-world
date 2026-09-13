import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot } from './support/snapshot.ts';

/**
 * The dialog must not move the page out from under the reader (docs/16 §6).
 *
 * This is a hardening pass with a specific history: on this machine one full parallel run left the hall
 * scrolled by 210px with the dialog open, while the same check passed 10/10 and 50/50 in isolation. A
 * probe on this Chromium then showed why — `overflow: hidden` on the viewport stops the visitor from
 * scrolling, but it never stopped a programmatic scroll, and a wheel already in flight can still be
 * applied by the compositor before the lock is committed under load.
 *
 * So these checks are about the visitor's place on the page: where the passage sits on screen, before,
 * during and after the dialog. Where the *document* thinks it is scrolled is an implementation detail —
 * the lock deliberately takes the document out of the scrolling business while it is open.
 */

/** The reader's place: the on-screen position of what they are looking at. */
type Place = { passageTop: number; passageLeft: number; headerTop: number };

/**
 * Waits until the page has stopped moving on its own.
 *
 * Rooms fade in from a small offset (docs/12 §5.1), so a rect read too early describes the entrance
 * animation rather than the layout — the first version of this file compared a mid-animation rect with a
 * settled one and reported a 10px "shift" that did not exist. `offsetTop` was identical throughout; only
 * the animated rect differed. Measuring the settled page is what makes the comparison mean anything.
 */
async function settle(page: Page): Promise<void> {
    for (let pass = 0; pass < 4; pass += 1) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve(undefined);
                    });
                });
            });
        });
        const running = await page.evaluate(async () => {
            const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
            await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
            return animations.length;
        });
        if (running === 0) {
            break;
        }
    }
}

/** The reader's place: the on-screen position of what they are looking at, once the page is still. */
async function readingPlace(page: Page): Promise<Place> {
    await settle(page);
    return page.evaluate(() => {
        const passage = document.querySelector('[data-testid="stage-passage"]');
        const header = document.querySelector('.site-header');
        const passageRect = passage?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        return {
            passageTop: Math.round(passageRect?.top ?? -1),
            passageLeft: Math.round(passageRect?.left ?? -1),
            headerTop: Math.round(headerRect?.top ?? -1),
        };
    });
}

/** Records every document scroll position, so a transient jump cannot hide behind a snap-back. */
async function recordDocumentScroll(page: Page): Promise<void> {
    await page.evaluate(() => {
        const recorder = window as unknown as { __pageScrolls?: number[] };
        recorder.__pageScrolls = [];
        window.addEventListener('scroll', () => {
            recorder.__pageScrolls?.push(window.scrollY);
        });
    });
}
async function recordedDocumentScroll(page: Page): Promise<number[]> {
    return page.evaluate(() => (window as unknown as { __pageScrolls?: number[] }).__pageScrolls ?? []);
}

/**
 * Opens the dialog without letting the test runner move the page first.
 *
 * Playwright scrolls a control into view before clicking it, which would shift the very position this
 * file exists to defend — one earlier attempt measured a 25px difference that was the runner's doing, not
 * the app's. A dispatched click is the same event React handles, with no runner interference.
 */
async function openDialog(page: Page): Promise<void> {
    await page.evaluate(() => {
        const trigger = document.querySelector('[data-testid="share-open"]') as HTMLElement | null;
        if (trigger === null) {
            return;
        }
        // A real click focuses the button first, and that is the element the dialog must give the focus
        // back to. `preventScroll` keeps the click itself from moving the page.
        trigger.focus({ preventScroll: true });
        trigger.click();
    });
    await expect(page.getByTestId('share-dialog')).toBeVisible();
}

async function closeDialog(page: Page): Promise<void> {
    await page.getByTestId('share-close').click();
    await expect(page.getByTestId('share-dialog')).toHaveCount(0);
}

/** (8, 8) is the backdrop, never the dialog: this is the reader trying to move the page behind it. */
async function wheelOverBackdrop(page: Page, delta = 600): Promise<void> {
    await page.mouse.move(8, 8);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(250);
}

/** The inline styles the app itself owns, so a lock can be told apart from a leftover. */
async function documentInlineStyles(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => ({
        rootOverflow: document.documentElement.style.overflow,
        rootOverscroll: document.documentElement.style.overscrollBehavior,
        rootPosition: document.documentElement.style.position,
        bodyOverflow: document.body.style.overflow,
        bodyOverscroll: document.body.style.overscrollBehavior,
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyLeft: document.body.style.left,
        bodyRight: document.body.style.right,
        bodyPadding: document.body.style.paddingRight,
    }));
}

/** Scrolls to a position the reader could realistically be at, and proves the page can move at all. */
async function scrollSomewhereReal(page: Page): Promise<number> {
    const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(maxScroll, 'the hall must be scrollable, or holding its place proves nothing').toBeGreaterThan(60);
    await page.evaluate((top: number) => {
        window.scrollTo(0, top);
    }, Math.min(120, maxScroll));
    const landed = await page.evaluate(() => window.scrollY);
    expect(landed).toBeGreaterThan(0);
    // Playwright would scroll the trigger into view before clicking it; it must already be on screen so
    // that the position being tested is the visitor's, not the runner's.
    await expect(page.getByTestId('share-open')).toBeVisible();
    return landed;
}

test.describe('the share dialog holds the reader place', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('keeps a scrolled page exactly where it was, through the wheel and through closing', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const before = await scrollSomewhereReal(page);
        const place = await readingPlace(page);
        // The header has been scrolled off the top of the window: this really is a scrolled page.
        expect(place.headerTop).toBeLessThan(0);

        await openDialog(page);
        // Opening the dialog is not a reason for the page to move, sideways or vertically.
        expect(await readingPlace(page)).toEqual(place);

        await recordDocumentScroll(page);
        await wheelOverBackdrop(page);
        // Not even momentarily: the recorder sees every position the document reached.
        expect(await recordedDocumentScroll(page)).toEqual([]);
        expect(await readingPlace(page)).toEqual(place);

        await closeDialog(page);
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });

    test('does not shift the layout when the viewport scrollbar goes away', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const place = await readingPlace(page);
        await openDialog(page);
        expect((await readingPlace(page)).passageLeft).toBe(place.passageLeft);
        await closeDialog(page);
        expect((await readingPlace(page)).passageLeft).toBe(place.passageLeft);
    });

    test('holds a page that was already at the top', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        expect(await page.evaluate(() => window.scrollY)).toBe(0);

        const place = await readingPlace(page);
        await openDialog(page);
        await recordDocumentScroll(page);
        await wheelOverBackdrop(page);

        expect(await recordedDocumentScroll(page)).toEqual([]);
        expect(await readingPlace(page)).toEqual(place);

        await closeDialog(page);
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('lets the dialog scroll inside itself at 200% without moving the page', async ({ page }) => {
        await page.setViewportSize({ width: 720, height: 450 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const place = await readingPlace(page);
        await openDialog(page);
        await recordDocumentScroll(page);

        // A long passage pushes the controls past the bottom of a 450px-high window: the dialog owns that
        // scrolling, and the page behind it stays put.
        const close = page.getByTestId('share-close');
        await close.scrollIntoViewIfNeeded();
        await expect(close).toBeInViewport();
        const innerScroll = await page
            .getByTestId('share-dialog')
            .evaluate((node) => node.scrollHeight - node.clientHeight);
        expect(innerScroll, 'this window must make the dialog itself scrollable').toBeGreaterThan(0);

        await wheelOverBackdrop(page);
        expect(await recordedDocumentScroll(page)).toEqual([]);
        expect(await readingPlace(page)).toEqual(place);

        await close.click();
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('five open and close cycles leave no lock and no residue behind', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const before = await scrollSomewhereReal(page);
        const place = await readingPlace(page);
        const untouched = await documentInlineStyles(page);

        for (let cycle = 0; cycle < 5; cycle += 1) {
            await openDialog(page);
            // The page is immovable for as long as the dialog is up, and back in the reader's place.
            expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
            await wheelOverBackdrop(page, 300);
            expect(await readingPlace(page)).toEqual(place);

            await closeDialog(page);
            // Nothing accumulates: no leftover hidden overflow, no growing negative offset, no padding.
            expect(await documentInlineStyles(page)).toEqual(untouched);
            expect(await readingPlace(page)).toEqual(place);
            expect(await page.evaluate(() => window.scrollY)).toBe(before);
        }
    });

    test('Escape and the button both give back the focus and the position', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const before = await scrollSomewhereReal(page);
        const place = await readingPlace(page);

        for (const closeWith of ['escape', 'button'] as const) {
            await openDialog(page);
            if (closeWith === 'escape') {
                await page.keyboard.press('Escape');
            } else {
                await page.getByTestId('share-close').click();
            }
            await expect(page.getByTestId('share-dialog')).toHaveCount(0);
            await expect(page.getByTestId('share-open')).toBeFocused();
            expect(await readingPlace(page)).toEqual(place);
            expect(await page.evaluate(() => window.scrollY)).toBe(before);
            expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
        }
    });

    test('a browser without showModal restores the page just the same', async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
                configurable: true,
                value: undefined,
            });
        });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const before = await scrollSomewhereReal(page);
        const place = await readingPlace(page);
        await openDialog(page);
        await expect(page.getByTestId('share-dialog')).toHaveAttribute('data-modal', 'false');
        await recordDocumentScroll(page);
        await wheelOverBackdrop(page);
        expect(await recordedDocumentScroll(page)).toEqual([]);

        await closeDialog(page);
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(before);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
        expect(await page.evaluate(() => document.body.style.position)).toBe('');
    });

    test('puts the page back even when something scrolls it programmatically', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const before = await scrollSomewhereReal(page);
        const place = await readingPlace(page);

        await openDialog(page);
        // The exact hole the probe found: a programmatic scroll used to move the page with the lock on.
        await page.evaluate(() => {
            window.scrollTo(0, 9999);
        });
        await page.waitForTimeout(250);

        // Nothing moved on screen, and the document's own offset was not left adrift either.
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);

        await closeDialog(page);
        expect(await readingPlace(page)).toEqual(place);
        expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });
});
