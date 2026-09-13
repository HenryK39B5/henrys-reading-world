import { expect, test, type Page } from '@playwright/test';
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

        // A year of this book that holds more passages than one batch, so the batch control really exists.
        const perYear = new Map<number, number>();
        for (const highlight of data.highlights) {
            if (highlight.bookId === bookId && highlight.year !== undefined) {
                perYear.set(highlight.year, (perYear.get(highlight.year) ?? 0) + 1);
            }
        }
        const busiestYear = [...perYear.entries()].sort((left, right) => right[1] - left[1])[0];
        test.skip(busiestYear === undefined || busiestYear[1] <= 10, 'need a year holding more than one batch');
        if (busiestYear === undefined) {
            return;
        }
        const [year] = busiestYear;

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

        // ---- 单书的年份筛选 ----
        await tabUntil(page, `book-year-${String(year)}`);
        await page.keyboard.press('Enter');
        await expect(page.getByTestId(`book-year-${String(year)}`)).toHaveAttribute('aria-current', 'true');

        // ---- 单书的批次 ----
        await tabUntil(page, 'book-more');
        const labelBefore = await page.getByTestId('book-batch-label').innerText();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('book-batch-label')).not.toHaveText(labelBefore);

        // ---- 返回上一处 ----
        // A filter is its own history entry (docs/02 §6), so the first step back is the same book without
        // the filter and the second is the hall. Both go through the same `history.back()` the browser
        // button uses, rather than a second, private notion of "back".
        await tabUntil(page, 'room-back');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).toContainText(book.title);
        await expect(page.getByTestId('book-year-all')).toHaveAttribute('aria-current', 'true');
        expect(new URL(page.url()).search).toBe('');

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

        await tabUntil(page, 'share-copy-link');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('share-status')).toHaveText(/已复制|自动复制失败，请手动复制/u);

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
