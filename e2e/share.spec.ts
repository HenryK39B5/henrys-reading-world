import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Share dialog acceptance (docs/15 §4.3–4.4, §7).
 *
 * The properties that matter: what is copied is exactly the real passage and its real source; the passage
 * is locked when the dialog opens and nothing behind the dialog can rewrite it; the preview never crops a
 * long sentence; and local-only mode never pretends a link is publicly reachable.
 */
type Highlight = { id: string; text: string; bookId: string };
type Book = { id: string; title: string; author: string; themeIds: string[] };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = {
    highlights: Highlight[];
    bookById: Map<string, Book>;
    firstOfBook: Map<string, Highlight>;
    countByBook: Map<string, number>;
    lengths: { shortest: Highlight; longest: Highlight; medium: Highlight; shortestLength: number; longestLength: number };
};

function nonWhitespace(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { highlights: Highlight[]; books: Book[] };
    const firstOfBook = new Map<string, Highlight>();
    const countByBook = new Map<string, number>();
    for (const highlight of parsed.highlights) {
        if (!firstOfBook.has(highlight.bookId)) {
            firstOfBook.set(highlight.bookId, highlight);
        }
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
    }
    const byLength = [...parsed.highlights].sort((left, right) => nonWhitespace(left.text) - nonWhitespace(right.text));
    const shortest = byLength[0];
    const longest = byLength[byLength.length - 1];
    const medium = parsed.highlights.find((item) => {
        const length = nonWhitespace(item.text);
        return length >= 41 && length <= 120;
    });
    if (shortest === undefined || longest === undefined || medium === undefined) {
        throw new Error('snapshot does not cover the lengths this spec needs');
    }
    return {
        highlights: parsed.highlights,
        bookById: new Map(parsed.books.map((book) => [book.id, book])),
        firstOfBook,
        countByBook,
        lengths: {
            shortest,
            longest,
            medium,
            shortestLength: nonWhitespace(shortest.text),
            longestLength: nonWhitespace(longest.text),
        },
    };
}

/** The exact text `复制文字` must produce, built from the same real record the page shows. */
function expectedCopyText(highlight: Highlight, book: Book | undefined): string {
    return `${highlight.text}\n\n——《${book?.title ?? '出处缺失'}》${book?.author ?? '作者信息暂缺'}\n\n来自 Henry's Reading World`;
}

async function openDialogFrom(page: Page, triggerTestId: string): Promise<void> {
    await page.getByTestId(triggerTestId).click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
}

async function lockedId(page: Page): Promise<string> {
    return (await page.getByTestId('share-dialog').getAttribute('data-highlight-id')) ?? '';
}

async function readClipboard(page: Page): Promise<string> {
    // Windows normalises the clipboard's line endings, so compare text rather than `\n` versus `\r\n`.
    return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/gu, '\n');
}

/** Opens a specific real passage through its own address, then shares it. */
async function sharePassage(page: Page, highlightId: string): Promise<void> {
    await page.goto(`/?h=${encodeURIComponent(highlightId)}`);
    await expect(page.getByTestId('stage-passage')).toBeVisible();
    await openDialogFrom(page, 'share-open');
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('sharing the passage on screen', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('copies the real passage and its real source, verbatim', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const shown = (await page.getByTestId('stage-passage').innerText()).trim();
        const highlight = data.highlights.find((item) => item.text.trim() === shown);
        expect(highlight, 'the stage must be showing a real snapshot passage').toBeTruthy();
        if (highlight === undefined) {
            return;
        }

        await openDialogFrom(page, 'share-open');
        expect(await lockedId(page)).toBe(highlight.id);
        await expect(page.getByTestId('share-card-text')).toHaveText(highlight.text);

        await page.getByTestId('share-copy-text').click();
        await expect(page.getByTestId('share-status')).toHaveText('已复制');
        const copied = await readClipboard(page);
        expect(copied).toBe(expectedCopyText(highlight, data.bookById.get(highlight.bookId)));
        // The site name is its own paragraph, never appended to the author's line (docs/17 §7).
        expect(copied.endsWith("\n\n来自 Henry's Reading World")).toBe(true);
        expect(copied.split('\n').at(-2)).toBe('');

        // The link is the canonical hall link and nothing else: no room, no filter, no tracking.
        await page.getByTestId('share-copy-link').click();
        const copiedLink = await readClipboard(page);
        expect(copiedLink).toBe(`http://127.0.0.1:5173/?h=${encodeURIComponent(highlight.id)}`);
        expect([...new URL(copiedLink).searchParams.keys()]).toEqual(['h']);
        // local-only content must say so, on the card and next to the link.
        await expect(page.getByTestId('share-local-hint')).toContainText('仅在这台电脑的本机预览中有效');
        await expect(page.getByTestId('share-card')).toContainText('仅本机 · 未公开审核');
    });

    test('locks one passage and keeps it while the reading world moves on', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();

        const locked = await lockedId(page);
        const text = await page.getByTestId('share-card-text').innerText();
        const highlight = data.highlights.find((item) => item.id === locked);
        expect(highlight).toBeTruthy();
        if (highlight === undefined) {
            return;
        }

        // Anything that could have moved the stage on: a real click behind the modal, and a few keys.
        await page.evaluate(() => {
            const button = document.querySelector('[data-testid="next-quote"]');
            if (button instanceof HTMLElement) {
                button.click();
            }
        });
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);

        await expect(page.getByTestId('share-dialog')).toBeVisible();
        expect(await lockedId(page)).toBe(locked);
        await expect(page.getByTestId('share-card-text')).toHaveText(text);
        // And the copy still describes the locked passage, not whatever the stage may be doing.
        await page.getByTestId('share-copy-text').click();
        expect(await readClipboard(page)).toBe(expectedCopyText(highlight, data.bookById.get(highlight.bookId)));
    });

    test('re-locks the new passage the next time it is opened', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await openDialogFrom(page, 'share-open');
        const first = await lockedId(page);
        await page.getByTestId('share-close').click();
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);

        await page.getByTestId('next-quote').click();
        await expect(page.getByTestId('share-open')).toHaveAttribute('aria-disabled', 'false');
        await expect(page.getByTestId('stage-passage')).not.toHaveText('');
        await openDialogFrom(page, 'share-open');
        expect(await lockedId(page)).not.toBe(first);
    });

    test('offers sharing only where the passage is the visual centre', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('share-open')).toBeVisible();
        expect(await page.locator('[data-share-trigger]').count()).toBe(1);

        // A library screen and a passage list are places to look for something, not places to share from.
        await page.goto('/books');
        await expect(page.getByTestId('room-heading')).toContainText('所有书');
        expect(await page.locator('[data-share-trigger]').count()).toBe(0);

        await page.goto('/themes');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        expect(await page.locator('[data-share-trigger]').count()).toBe(0);

        await page.goto('/about');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        expect(await page.locator('[data-share-trigger]').count()).toBe(0);
    });

    test('shares the shelf room and the book room passage, each with its own id', async ({ page }) => {
        const data = loadSnapshot();
        const themeId = [...new Set([...data.bookById.values()].flatMap((book) => book.themeIds))][0];
        test.skip(themeId === undefined, 'need a shelf');
        if (themeId === undefined) {
            return;
        }

        await page.goto(`/themes/${encodeURIComponent(themeId)}`);
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const shelfText = (await page.getByTestId('stage-passage').innerText()).trim();
        await openDialogFrom(page, 'share-open');
        await expect(page.getByTestId('share-card-text')).toHaveText(shelfText);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);

        const bookId = data.highlights.find((item) => item.text.trim() === shelfText)?.bookId;
        test.skip(bookId === undefined, 'the shelf passage must belong to a real book');
        if (bookId === undefined) {
            return;
        }

        await page.goto(`/books/${encodeURIComponent(bookId)}`);
        await expect(page.getByTestId('book-random-text')).toBeVisible();
        const bookText = (await page.getByTestId('book-random-text').innerText()).trim();
        await openDialogFrom(page, 'book-share-open');
        await expect(page.getByTestId('share-card-text')).toHaveText(bookText);
        expect(await lockedId(page)).toBe(data.highlights.find((item) => item.text.trim() === bookText)?.id);
        // The list of every passage in the book stays a list.
        expect(await page.locator('[data-share-trigger]').count()).toBe(1);
    });
});

test.describe('copying honestly', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('falls back to selectable text when the clipboard refuses', async ({ page }) => {
        // A refused permission is a real outcome; the page must not claim success on the first attempt.
        await page.addInitScript(() => {
            let calls = 0;
            const clipboard = navigator.clipboard;
            if (clipboard !== undefined) {
                clipboard.writeText = () => {
                    calls += 1;
                    return calls === 1 ? Promise.reject(new Error('denied')) : Promise.resolve();
                };
            }
            (window as unknown as { __copyCalls: () => number }).__copyCalls = () => calls;
        });

        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const shown = (await page.getByTestId('stage-passage').innerText()).trim();
        await openDialogFrom(page, 'share-open');

        await page.getByTestId('share-copy-text').click();
        await expect(page.getByTestId('share-status')).toHaveText('自动复制失败，请手动复制');
        const manual = page.getByTestId('share-manual');
        await expect(manual).toBeVisible();
        const fallback = await manual.inputValue();
        expect(fallback.startsWith(shown)).toBe(true);
        // The manual fallback is the same text the clipboard would have carried: source line, blank line,
        // then the site's own provenance (docs/17 §7).
        const fallbackLines = fallback.split('\n');
        expect(fallbackLines.at(-1)).toBe("来自 Henry's Reading World");
        expect(fallbackLines.at(-2)).toBe('');
        expect(fallbackLines.find((line) => line.startsWith('——《'))).not.toContain("Henry's Reading World");
        expect(await page.evaluate(() => (window as unknown as { __copyCalls: () => number }).__copyCalls())).toBe(1);

        // Selecting the fallback text is the manual path, and a later success clears the failure.
        await manual.click();
        expect(await manual.evaluate((element) => (element as HTMLTextAreaElement).selectionEnd > 0)).toBe(true);

        await page.getByTestId('share-copy-link').click();
        await expect(page.getByTestId('share-status')).toHaveText('已复制');
        await expect(page.getByTestId('share-manual')).toHaveCount(0);
    });

    test('never calls the system share sheet from a local-only build', async ({ page }) => {
        await page.addInitScript(() => {
            (window as unknown as { __shareCalls: number }).__shareCalls = 0;
            Object.defineProperty(navigator, 'share', {
                configurable: true,
                value: () => {
                    (window as unknown as { __shareCalls: number }).__shareCalls += 1;
                    return Promise.resolve();
                },
            });
        });

        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await openDialogFrom(page, 'share-open');
        await page.getByTestId('share-copy-text').click();
        await page.getByTestId('share-copy-link').click();

        expect(await page.evaluate(() => (window as unknown as { __shareCalls: number }).__shareCalls)).toBe(0);
    });
});

test.describe('keyboard and the dialog', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('holds the focus, closes on Escape and gives it back', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await openDialogFrom(page, 'share-open');

        // The first real action holds the focus.
        await expect(page.getByTestId('share-copy-text')).toBeFocused();

        // Tab never leaves the dialog into the page behind it. Chromium may hand the focus to its own
        // chrome when the ring runs out, which is the browser's business — the page must never get it.
        for (let press = 0; press < 6; press += 1) {
            await page.keyboard.press('Tab');
            const leakedIntoPage = await page.evaluate(() => {
                const dialog = document.querySelector('[data-testid="share-dialog"]');
                const active = document.activeElement;
                if (active === null || active === document.body) {
                    return false;
                }
                return dialog === null || !dialog.contains(active);
            });
            expect(leakedIntoPage, 'focus must not reach the page behind the modal').toBe(false);
        }

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
        // Closing by keyboard puts the visitor back on the control they used.
        await expect(page.getByTestId('share-open')).toBeFocused();
    });

    test('closing with the button returns the focus too, and leaves nothing behind', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const bodyOverflow = () => page.evaluate(() => document.body.style.overflow);
        /** Where the page content sits on screen — the thing that would move if the page scrolled. */
        const headerTop = () =>
            page.evaluate(() =>
                Math.round(document.querySelector('.site-header')?.getBoundingClientRect().top ?? -1),
            );

        await openDialogFrom(page, 'share-open');
        expect(await bodyOverflow()).toBe('hidden');

        // The page behind the dialog must not scroll away underneath it. The header is outside every
        // animated room, so its position on screen describes the page and nothing else. The document's own
        // scroll offset is deliberately not the measure here: while the dialog owns the page that offset is
        // pinned, and the reader's place is carried by the page itself — `e2e/scroll-lock.spec.ts` is where
        // the place itself is held to account.
        const beforeWheel = await headerTop();
        await page.mouse.move(8, 8);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(250);
        expect(await headerTop()).toBe(beforeWheel);

        await page.getByTestId('share-close').click();
        await expect(page.getByTestId('share-dialog')).toHaveCount(0);
        await expect(page.getByTestId('share-open')).toBeFocused();
        // Nothing is left behind: no lock, no offset, no padding, no fallback textarea.
        expect(
            await page.evaluate(() => ({
                overflow: document.body.style.overflow,
                position: document.body.style.position,
                top: document.body.style.top,
                padding: document.body.style.paddingRight,
            })),
        ).toEqual({ overflow: '', position: '', top: '', padding: '' });
        await expect(page.getByTestId('share-manual')).toHaveCount(0);
    });
});

test.describe('the preview never crops a real passage', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('keeps the shortest, a medium, and the two longest real passages whole', async ({ page }) => {
        const data = loadSnapshot();
        const cases = [
            { name: 'shortest', highlight: data.lengths.shortest, extended: false },
            { name: 'medium', highlight: data.lengths.medium, extended: false },
            { name: '299-character opening', highlight: null, extended: true },
            { name: 'longest', highlight: data.lengths.longest, extended: true },
        ];

        // The 299-character passage is the one the fair engine can open on; find it in the real data.
        const long299 = data.highlights.find((item) => nonWhitespace(item.text) === 299);
        test.skip(long299 === undefined, 'the real 299-character passage is not in this snapshot');
        if (long299 === undefined) {
            return;
        }
        cases[2] = { ...cases[2], highlight: long299 };

        for (const item of cases) {
            const highlight = item.highlight;
            if (highlight === null) {
                continue;
            }
            await sharePassage(page, highlight.id);

            await expect(page.getByTestId('share-card-text')).toHaveText(highlight.text);
            // No clipping and no horizontal overflow, at both a desktop and a phone width.
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: 900 });
                await expect
                    .poll(async () =>
                        page.getByTestId('share-card').evaluate((element) => ({
                            vertical: element.scrollHeight - element.clientHeight,
                            horizontal: element.scrollWidth - element.clientWidth,
                        })),
                    )
                    .toEqual({ vertical: 0, horizontal: 0 });
            }

            const extended = await page.getByTestId('share-card').getAttribute('data-extended');
            expect(extended, `${item.name} (${String(nonWhitespace(highlight.text))} chars)`).toBe(
                item.extended ? 'true' : 'false',
            );
            if (item.extended) {
                await expect(page.getByTestId('share-card-extended')).toHaveText('长文预览已延长比例');
            } else {
                await expect(page.getByTestId('share-card-extended')).toHaveCount(0);
            }
            await page.setViewportSize({ width: 1280, height: 720 });
        }
    });
});
