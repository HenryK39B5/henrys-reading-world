import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

/**
 * Zoom and reflow acceptance (docs/12 §6, docs/15 §8.1).
 *
 * Two different things are checked, and they are deliberately not the same test:
 *
 *   1. Reflow at 200%. Chromium's page zoom divides the layout viewport, so a 1440×900 window at 200% is
 *      a 720×450 CSS-pixel viewport — media queries and reflow behave exactly as they would at 200%.
 *      That is the check the layout must pass.
 *   2. Real magnification in this Chromium (`Emulation.setPageScaleFactor`), which magnifies without
 *      reflowing. Nothing may become unreachable when the visible region is half the size.
 *
 * Neither is a substitute for a real browser-zoom session on a real device; that stays unverified.
 */

/** Two clipboard channels are granted so a copy inside the dialog can be verified where it matters. */
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

type Room = { label: string; path: string };

function rooms(): Room[] {
    const data = loadSnapshot();
    const themeId = data.themes[0]?.id ?? '';
    const bookId = data.biggestBookId ?? data.books[0]?.id ?? '';
    return [
        { label: '门厅', path: '/' },
        { label: '主题书架', path: '/themes' },
        { label: '主题房间', path: `/themes/${encodeURIComponent(themeId)}` },
        { label: '所有书', path: '/books' },
        { label: '书籍房间', path: `/books/${encodeURIComponent(bookId)}` },
        { label: '关于', path: '/about' },
    ];
}

/** Real rendered measurements: the document, plus every control that left the viewport. */
async function layout(page: Page) {
    return page.evaluate(() => {
        const document_ = document.documentElement;
        const offenders: string[] = [];
        for (const element of document.querySelectorAll<HTMLElement>('a, button, input, textarea, textarea')) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                continue;
            }
            if (rect.left < -1 || rect.right > window.innerWidth + 1) {
                offenders.push(
                    `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? element.className}] ${String(
                        Math.round(rect.left),
                    )}..${String(Math.round(rect.right))} of ${String(window.innerWidth)}`,
                );
            }
        }
        return {
            documentOverflow: document_.scrollWidth - document_.clientWidth,
            controlsOutside: offenders,
            viewport: { width: window.innerWidth, height: window.innerHeight },
        };
    });
}

async function expectNoOverflow(page: Page, where: string): Promise<void> {
    const measured = await layout(page);
    expect(measured.documentOverflow, `${where}: the page must not scroll sideways`).toBeLessThanOrEqual(1);
    expect(measured.controlsOutside, `${where}: controls must stay inside the viewport`).toEqual([]);
}

test.describe('200% zoom equivalence', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('every room reflows at 720×450, which is 1440×900 at 200%', async ({ page }) => {
        for (const room of rooms()) {
            for (const size of [
                { width: 1440, height: 900 },
                { width: 720, height: 450 },
            ]) {
                await page.setViewportSize(size);
                await page.goto(room.path);
                await expect(page.locator('[data-room]')).toBeVisible();
                await expect(page.getByTestId('room-heading')).toBeVisible();
                await expectNoOverflow(page, `${room.label} @ ${String(size.width)}×${String(size.height)}`);
            }
        }
    });

    test('the reading centre stays whole and readable at 200%', async ({ page }) => {
        await page.setViewportSize({ width: 720, height: 450 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        // The sentence itself never scrolls sideways, and a long one is still complete.
        const passage = await page.getByTestId('stage-passage').evaluate((node) => ({
            overflow: node.scrollWidth - node.clientWidth,
            whiteSpace: getComputedStyle(node).whiteSpace,
            fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
        }));
        expect(passage.overflow).toBeLessThanOrEqual(1);
        expect(passage.whiteSpace).toBe('pre-wrap');
        expect(passage.fontSize).toBeGreaterThanOrEqual(20);
    });

    test('the share dialog is fully operable at 200%', async ({ page }) => {
        await page.setViewportSize({ width: 720, height: 450 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await expectNoOverflow(page, 'share dialog @ 200%');

        // The dialog owns its own scrolling, so a short window is not a dead end: everything in it is
        // reachable, and the page behind it does not move (docs/15 §7.4).
        const scrollBefore = await page.evaluate(() => window.scrollY);
        const close = page.getByTestId('share-close');
        await close.scrollIntoViewIfNeeded();
        await expect(close).toBeInViewport();
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

        const copyLink = page.getByTestId('share-copy-link');
        await copyLink.scrollIntoViewIfNeeded();
        await copyLink.click();
        await expect(page.getByTestId('share-status')).toHaveText('已复制');

        // And a keyboard visitor never needs the button at all.
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
        await expect(page.getByTestId('share-open')).toBeFocused();
    });
});

/**
 * Brings a control into the magnified view and reports whether it is then fully visible inside it.
 *
 * Under real magnification the visible region is smaller than the layout viewport, so "reachable" means
 * the browser can scroll it into that smaller region — not that it is on screen without scrolling.
 */
async function reachableWhenMagnified(page: Page, testId: string): Promise<boolean> {
    return page.evaluate((id: string) => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        if (element === null) {
            return false;
        }
        element.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = element.getBoundingClientRect();
        const view = window.visualViewport;
        if (view === null) {
            return false;
        }
        return (
            rect.top >= view.offsetTop - 1 &&
            rect.left >= view.offsetLeft - 1 &&
            rect.bottom <= view.offsetTop + view.height + 1 &&
            rect.right <= view.offsetLeft + view.width + 1
        );
    }, testId);
}

test.describe('real magnification in this Chromium', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('the page stays operable when the visible region is magnified 2×', async ({ page, context }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });

        const magnified = await page.evaluate(() => ({
            scale: window.visualViewport?.scale ?? 1,
            visibleWidth: window.visualViewport?.width ?? window.innerWidth,
            layoutWidth: window.innerWidth,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(magnified.scale).toBe(2);
        // Magnification does not reflow: the layout viewport is unchanged, the visible part is smaller,
        // and the page still does not scroll sideways.
        expect(magnified.layoutWidth).toBe(1440);
        expect(magnified.visibleWidth).toBeLessThan(magnified.layoutWidth);
        expect(magnified.documentOverflow).toBeLessThanOrEqual(1);

        for (const control of ['source-toggle', 'next-quote', 'share-open']) {
            expect(await reachableWhenMagnified(page, control), `${control} must stay reachable at 2×`).toBe(true);
        }

        // Operable by keyboard, which does not depend on where the magnified view happens to be.
        await page.getByTestId('next-quote').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });
        await expect(page.getByTestId('stage-passage')).not.toHaveText('');

        await page.getByTestId('share-open').focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        expect(await reachableWhenMagnified(page, 'share-close')).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
    });
});

test.describe('the responsive matrix', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('320, 360, 390, 768 and 1440 all keep every room inside the viewport', async ({ page }) => {
        for (const width of [320, 360, 390, 768, 1440]) {
            for (const room of rooms()) {
                await page.setViewportSize({ width, height: width < 500 ? 800 : 900 });
                await page.goto(room.path);
                await expect(page.locator('[data-room]')).toBeVisible();
                await expect(page.getByTestId('room-heading')).toBeVisible();
                await expectNoOverflow(page, `${room.label} @ ${String(width)}px`);
            }
        }
    });

    test('at 320px the dialog still opens, stays whole and can be closed', async ({ page }) => {
        const data = loadSnapshot();
        await page.setViewportSize({ width: 320, height: 800 });
        // The longest real passage is the hardest case for a narrow dialog.
        await page.goto(`/?h=${encodeURIComponent(data.longest.id)}`);
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();

        await expect(page.getByTestId('share-close')).toBeInViewport();
        await expectNoOverflow(page, 'share dialog @ 320px');
        const card = await page.getByTestId('share-card').evaluate((node) => ({
            vertical: node.scrollHeight - node.clientHeight,
            horizontal: node.scrollWidth - node.clientWidth,
            width: Math.round(node.getBoundingClientRect().width),
        }));
        expect({ vertical: card.vertical, horizontal: card.horizontal }).toEqual({ vertical: 0, horizontal: 0 });
        expect(card.width).toBeLessThanOrEqual(320);

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
    });
});

test.describe('reduced motion', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('the dialog appears without displacement or a long colour transition', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();

        const motion = await page.evaluate(() => {
            const dialog = document.querySelector('[data-testid="share-dialog"]');
            const aurora = document.querySelector('.room-aura-tint');
            const style = dialog === null ? null : getComputedStyle(dialog);
            return {
                dialogTransition: style?.transitionDuration ?? 'missing',
                dialogAnimation: style?.animationName ?? 'missing',
                tintAnimation: aurora === null ? 'missing' : getComputedStyle(aurora).animationName,
                tintTransition: aurora === null ? 'missing' : getComputedStyle(aurora).transitionProperty,
            };
        });
        expect(motion.dialogAnimation).toBe('none');
        expect(motion.tintAnimation).toBe('none');
        expect(motion.tintTransition).toBe('none');
    });
});
