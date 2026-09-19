import { expect, test, type Page } from '@playwright/test';
import { hexToRgb } from '../src/domain/accent.ts';
import { sharePalette } from '../src/domain/sharePalette.ts';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

/**
 * The whole journey, by keyboard (docs/15 §8.1).
 *
 * Not a list of individually reachable widgets: one continuous session that goes 门厅 → 出处 → 再看一处 →
 * 查看这本书 → 单书筛选与批次 → 返回 → 主题书架 → 主题房间 → 分享 → Esc → 门厅, never touching the
 * mouse. Every Tab stop is checked for visible focus, and every activation is a real Enter or Space.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** What currently has focus, in a form a failure message can show. */
async function activeStop(page: Page): Promise<string> {
    return page.evaluate(() => {
        const active = document.activeElement;
        if (active === null) {
            return 'nothing';
        }
        return (
            active.getAttribute('data-testid') ??
            `${active.tagName.toLowerCase()}:${(active.textContent ?? '').trim().slice(0, 14)}`
        );
    });
}

/** The card's committed state: what it says, what book it belongs to, and how it is painted. */
async function cardState(
    page: Page,
): Promise<{ text: string; accent: string; background: string; muted: string }> {
    return page.getByTestId('share-card').evaluate((node) => {
        const meta = node.querySelector('.share-card-meta');
        return {
            text: (node.querySelector('[data-testid="share-card-text"]')?.textContent ?? '').trim(),
            accent: node.getAttribute('data-accent') ?? '',
            background: getComputedStyle(node).backgroundColor,
            muted: meta === null ? '' : getComputedStyle(meta).color,
        };
    });
}

/**
 * The card once it has stopped arriving.
 *
 * The surface is sampled from a real cover, so a dialog opened on a cold cache shows the default palette for a
 * moment and then travels to the book's own colour (docs/16 §5.3). This reads the card the visitor ends up
 * looking at, not the one on its way there.
 */
async function settledCard(
    page: Page,
): Promise<{ text: string; accent: string; background: string; muted: string }> {
    await expect
        .poll(
            async () => {
                const state = await cardState(page);
                return `${state.accent}|${state.background}`;
            },
            { message: 'the card must settle on its final cover palette', timeout: 8000 },
        )
        .toMatch(/^#[0-9a-f]{6}\|rgb\(/u);
    await page.waitForTimeout(700);
    await expect
        .poll(
            async () => {
                const state = await cardState(page);
                return state.background === cssOf(sharePalette(state.accent).background);
            },
            { message: 'the settled accent and painted surface must agree', timeout: 8000 },
        )
        .toBe(true);
    return cardState(page);
}

/** The `rgb()` string a browser reports for a hex colour. */
function cssOf(hex: string): string {
    const rgb = hexToRgb(hex);
    if (rgb === null) {
        throw new Error(`not a colour: ${hex}`);
    }
    return `rgb(${String(rgb.r)}, ${String(rgb.g)}, ${String(rgb.b)})`;
}

/**
 * Focus must be visible on every stop — a keyboard visitor who cannot see where they are has no journey.
 */
async function expectVisibleFocus(page: Page, where: string): Promise<void> {
    const visible = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) {
            return false;
        }
        const style = getComputedStyle(active);
        return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    });
    expect(visible, `focus must be visible on ${where}`).toBe(true);
}

async function tabUntil(page: Page, testId: string, budget = 60): Promise<void> {
    const seen: string[] = [];
    for (let press = 0; press < budget; press += 1) {
        await page.keyboard.press('Tab');
        const current = await activeStop(page);
        seen.push(current);
        if (current === testId) {
            await expectVisibleFocus(page, current);
            return;
        }
    }
    throw new Error(`Tab never reached ${testId}. Stops seen: ${seen.join(' -> ')}`);
}

async function shiftTab(page: Page): Promise<string> {
    await page.keyboard.press('Shift+Tab');
    const current = await activeStop(page);
    await expectVisibleFocus(page, current);
    return current;
}

test.describe('the full keyboard journey', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('reaches every part of the reading world without a mouse', async ({ page }) => {
        test.setTimeout(120_000);
        const data = loadSnapshot();
        const bookId = data.biggestBookId;
        const book = bookId === null ? undefined : data.bookById.get(bookId);
        test.skip(bookId === null || book === undefined, 'need a book with a long list');
        if (bookId === null || book === undefined) {
            return;
        }

        const entry = data.firstOfBook.get(bookId);
        expect(entry).toBeTruthy();
        if (entry === undefined) {
            return;
        }

        // ---- 门厅, opened on a real passage of the book we are about to walk into ----
        await page.goto(`/?h=${encodeURIComponent(entry.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(entry.text.trim());
        await page.locator('#room').focus();

        // ---- 出处展开 ----
        await tabUntil(page, 'source-toggle');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('source-panel')).toBeVisible();

        // ---- 再看一处: a transient move inside the same book, panel stays open ----
        await tabUntil(page, 'next-in-book');
        const before = await page.getByTestId('stage-passage').innerText();
        await page.keyboard.press('Enter');
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });
        await expect(page.getByTestId('stage-passage')).not.toHaveText(before);
        await expect(page.getByTestId('source-panel')).toBeVisible();
        // The visitor has moved on, so the address stops claiming to name a passage (docs/15 §4.1).
        expect(new URL(page.url()).search).toBe('');
        const afterTransient = (await page.getByTestId('stage-passage').innerText()).trim();

        // ---- 查看这本书 ----
        await tabUntil(page, 'open-book');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toContainText(book.title);
        expect(new URL(page.url()).pathname).toBe(`/books/${bookId}`);

        // ---- 单书的随机轮 ----
        // The book room walks one book in rounds (docs/17 §3): a passage, an honest progress line, and
        // another passage on request. There is no per-book year filter and no batched list to tab through.
        await expect(page.getByTestId('book-walk-progress')).toContainText('本轮已看 1 / ');
        await tabUntil(page, 'book-random');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('book-walk-progress')).toContainText('本轮已看 2 / ');
        expect(await page.locator('[data-testid^="book-year-"]').count()).toBe(0);
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('book-walk-progress')).toContainText('本轮已看 3 / ');

        // ---- 返回上一处 ----
        // The book was opened straight from the hall, so one step back is the hall itself. It goes through
        // the same `history.back()` the browser button uses, rather than a second, private notion of "back".
        await tabUntil(page, 'room-back');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        // The hall remembered the sentence that was there when the visitor left it (docs/12 §3) — which is
        // the one 再看一处 produced, not the linked opening they had already read past.
        await expect(page.getByTestId('stage-passage')).toHaveText(afterTransient);

        // Shift+Tab is the way back out of the room content into the header; it must work and be visible.
        expect(await shiftTab(page)).toContain('nav-');

        // ---- 主题书架 ----
        await tabUntil(page, 'exit-themes');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toContainText('主题书架');

        // ---- 主题房间 ----
        const themeId = data.themes[0]?.id;
        expect(themeId).toBeTruthy();
        if (themeId === undefined) {
            return;
        }
        await tabUntil(page, `theme-${themeId}`);
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toContainText('正在逛：');

        // ---- 分享 dialog, closed by Esc ----
        await tabUntil(page, 'share-open');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await expect(page.getByTestId('share-copy-text')).toBeFocused();

        // The preview holds a real passage on a card whose colour belongs to that passage's own book, and
        // both stay put while the visitor works the dialog by keyboard (docs/16 §4.2, §5).
        const locked = await settledCard(page);
        expect(locked.text.length).toBeGreaterThan(0);
        expect(locked.accent).toMatch(/^#[0-9a-f]{6}$/u);
        expect(locked.background).toBe(cssOf(sharePalette(locked.accent).background));

        await tabUntil(page, 'share-copy-link');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('share-status')).toHaveText(/已复制|自动复制失败，请手动复制/u);
        // A copy result is not a reason for the card to change its mind about which book it is.
        expect(await cardState(page)).toEqual(locked);

        // Shift+Tab walks back through the dialog's own controls, and never out into the page behind it.
        const back = await shiftTab(page);
        expect(['share-copy-text', 'share-copy-link', 'share-close']).toContain(back);
        const stillInside = await page.evaluate(() => {
            const dialog = document.querySelector('[data-testid="share-dialog"]');
            return dialog !== null && dialog.contains(document.activeElement);
        });
        expect(stillInside).toBe(true);

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
        await expect(page.getByTestId('share-open')).toBeFocused();

        // ---- 回门厅 ----
        await tabUntil(page, 'exit-hall');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe('room');
    });

    test('Space activates a control just as Enter does', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.locator('#room').focus();
        await tabUntil(page, 'next-quote');
        const before = await page.getByTestId('stage-passage').innerText();
        await page.keyboard.press('Space');
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });
        await expect(page.getByTestId('stage-passage')).not.toHaveText(before);
    });

    test('the source panel closes by keyboard and gives the focus back', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.locator('#room').focus();
        await tabUntil(page, 'source-toggle');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('source-panel')).toBeVisible();

        await tabUntil(page, 'close-source');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('source-panel')).not.toBeVisible();
        await expect(page.getByTestId('source-toggle')).toBeFocused();
        await expect(page.getByTestId('source-toggle')).toHaveAttribute('aria-expanded', 'false');
    });
});
