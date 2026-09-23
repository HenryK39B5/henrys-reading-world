import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

/**
 * Failure and error states (docs/05 §9, docs/15 §8.1).
 *
 * Every one of these is a real state the product must survive without a blank page, an invented result or
 * a broken image. A missing cover is the interesting one: the snapshot not having a cover was already
 * handled, but a cover *file* that does not arrive used to leave a broken image behind.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function expectNoOverflow(page: Page, where: string): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${where}: the page must not scroll sideways`).toBeLessThanOrEqual(1);
}

test.describe('unreachable addresses stay honest and escapable', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('an unknown path is not silently turned into a room', async ({ page }) => {
        await page.goto('/nope');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await expect(page.getByTestId('stage-passage')).toHaveCount(0);
        // Real ways out, so nobody is stuck on a dead end.
        await expect(page.getByTestId('exit-hall')).toBeVisible();
        await expect(page.getByTestId('unknown-note')).toBeVisible();
        await expectNoOverflow(page, 'unknown path');

        await page.getByTestId('exit-hall').click();
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
    });

    test('an id that is not in the collection says so instead of pretending', async ({ page }) => {
        await page.goto('/themes/t-does-not-exist');
        await expect(page.getByTestId('theme-missing')).toBeVisible();
        await expect(page.getByTestId('stage-passage')).toHaveCount(0);
        await page.getByTestId('exit-themes').click();
        await expect(page.getByTestId('room-heading')).toContainText('主题书架');

        await page.goto('/books/b-does-not-exist');
        await expect(page.getByTestId('book-missing')).toBeVisible();
        await expect(page.getByTestId('book-random-area')).toHaveCount(0);
        await expect(page.getByTestId('book-walk-progress')).toHaveCount(0);
        await page.getByTestId('exit-books').click();
        await expect(page.getByTestId('room-heading')).toContainText('所有书');
    });

    test('a book room ignores a filter left over from the library', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.biggestBookId ?? data.books[0]?.id;
        test.skip(bookId === undefined, 'need a book');
        if (bookId === undefined) {
            return;
        }

        // A stale `?year=` link is normalised instead of producing an empty room: the round covers the
        // whole book, so "this book showed nothing in that year" is no longer a state the room can be in
        // (docs/17 §3.3). The address is rewritten after the room paints, so the check waits for it.
        await page.goto(`/books/${encodeURIComponent(bookId)}?year=1998`);
        await expect(page.getByTestId('book-random-text')).toBeVisible();
        await expect
            .poll(() => new URL(page.url()).search, {
                message: 'the library filter must be dropped from the book room address',
            })
            .toBe('');
        await expect(page.getByTestId('book-walk-progress')).toContainText('本轮已看 1 / ');
        await expect(page.getByTestId('book-list-empty')).toHaveCount(0);
        await expect(page.getByTestId('book-year-all')).toHaveCount(0);
    });
});

test.describe('a cover that does not arrive has an honest missing-cover label', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('no broken image anywhere, and the room keeps the default colour', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.coveredBookId ?? data.biggestBookId ?? data.books[0]?.id;
        const book = bookId === undefined ? undefined : data.bookById.get(bookId);
        test.skip(book === undefined, 'need a book with a cover in the snapshot');
        if (book === undefined || bookId === undefined) {
            return;
        }

        // Every cover request fails, which is what a missing file in .private/covers looks like.
        await page.route('**/__local_cover/**', (route) => route.abort());

        await page.goto(`/books/${encodeURIComponent(bookId)}`);
        await expect(page.getByTestId('room-heading')).toContainText(book.title);
        // The full real title remains in the heading; the cover slot does not squeeze it into a thumbnail.
        await expect(page.locator('.book-head-cover .book-cover-fallback')).toHaveText('无封面');
        // No image element remains after a failed load.
        await expect(page.locator('.book-head-cover img')).toHaveCount(0);

        // The default accent is a real colour, so the room is never tinted with a guess.
        const aura = await page
            .locator('.shell')
            .evaluate((element) => getComputedStyle(element).getPropertyValue('--aura').trim());
        expect(aura).toBe('#425a4b');
        await expectNoOverflow(page, 'book room without covers');

        // The library list falls back the same way.
        await page.goto('/books');
        await expect(page.getByTestId('book-list')).toBeVisible();
        await expect(page.locator('.book-cover img')).toHaveCount(0);
        expect(await page.locator('.book-cover-fallback').count()).toBeGreaterThan(0);

        // And so does the source panel on the stage.
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('source-toggle').click();
        await expect(page.locator('.cover-frame img')).toHaveCount(0);
        await expect(page.locator('.cover-placeholder-title')).toBeVisible();
    });
});

test.describe('a browser without showModal still gets a usable dialog', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('the dialog opens, copies and closes without the modal API', async ({ page }) => {
        await page.addInitScript(() => {
            // An old or restricted browser: `showModal` is simply not there.
            Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
                configurable: true,
                value: undefined,
            });
        });

        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        const dialog = page.getByTestId('share-dialog');
        await expect(dialog).toBeVisible();
        // The page is honest about which mode it got, and the dialog is still the real one.
        await expect(dialog).toHaveAttribute('data-modal', 'false');
        await expect(page.getByTestId('share-card-text')).toHaveText(
            (await page.getByTestId('stage-passage').innerText()).trim(),
        );

        await page.getByTestId('share-copy-link').click();
        await expect(page.getByTestId('share-status')).toHaveText('已复制');
        await expectNoOverflow(page, 'non-modal share dialog');

        // Esc is not available for a non-modal dialog, so the visible control has to work.
        await page.getByTestId('share-close').click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByTestId('share-open')).toBeFocused();
    });
});
