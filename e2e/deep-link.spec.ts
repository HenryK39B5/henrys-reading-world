import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_ACCENT } from '../src/domain/accent.ts';

/**
 * Deep links (`/?h=<stable highlight id>`, docs/15 §4.1, §6).
 *
 * A URL may name one real passage. What it must *not* do is change what a room is: the address is
 * content-level, so the hall stays the same hall for scroll, sessions, focus and the aura entry — and
 * once the visitor moves on, the address stops claiming to describe the screen.
 */
type Highlight = { id: string; text: string; bookId: string };
type Book = { id: string; title: string; coverPath?: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = {
    highlights: Highlight[];
    books: Book[];
    themes: { id: string }[];
    texts: Set<string>;
    firstOfBook: Map<string, Highlight>;
    coveredBookId: string | null;
};

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: Book[];
        themes: { id: string }[];
    };
    const withCover = parsed.books.find(
        (book) => book.coverPath !== undefined && parsed.highlights.some((item) => item.bookId === book.id),
    );
    const firstOfBook = new Map<string, Highlight>();
    for (const highlight of parsed.highlights) {
        if (!firstOfBook.has(highlight.bookId)) {
            firstOfBook.set(highlight.bookId, highlight);
        }
    }
    return {
        highlights: parsed.highlights,
        books: parsed.books,
        themes: parsed.themes,
        texts: new Set(parsed.highlights.map((item) => item.text.trim())),
        firstOfBook,
        coveredBookId: withCover?.id ?? null,
    };
}

/** The passage the stage is showing right now, read from the page rather than from the engine. */
async function stageText(page: Page): Promise<string> {
    return (await page.getByTestId('stage-passage').innerText()).trim();
}

/**
 * Waits until the room's aura has stopped arriving.
 *
 * The colour is sampled from the real cover asynchronously, so an immediate read would measure the
 * placeholder accent instead of the book's own colour. Two identical readings are not enough on their own
 * either: the placeholder is itself a stable value, so a loaded machine that took longer than one poll
 * interval to sample reported the placeholder as the answer. The colour is only accepted once it has been
 * stable across several readings *and* is no longer the placeholder.
 */
async function settledAura(page: Page): Promise<string> {
    let previous = '';
    let stable = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const current = await page
            .locator('.shell')
            .evaluate((element) => getComputedStyle(element).getPropertyValue('--aura').trim());
        stable = current !== '' && current === previous ? stable + 1 : 0;
        previous = current;
        if (stable >= 2 && current.toLowerCase() !== DEFAULT_ACCENT) {
            return current;
        }
        await page.waitForTimeout(100);
    }
    return previous;
}

/** Waits for the address to normalise, because a React effect drops the query after the room paints. */
async function expectSearch(page: Page, expected: string): Promise<void> {
    await expect.poll(() => new URL(page.url()).search).toBe(expected);
}

/** Follows a site-internal link the way a real `<a href>` would, so the router's own click path runs. */
async function clickInternalLink(page: Page, href: string): Promise<void> {
    await page.evaluate((target: string) => {
        const anchor = document.createElement('a');
        anchor.href = target;
        anchor.id = 'injected-link';
        anchor.textContent = 'link';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    }, href);
}

test.describe('a deep link opens one real passage', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('shows exactly the passage the address names, and survives a reload', async ({ page }) => {
        const data = loadSnapshot();
        const target = data.firstOfBook.get(data.coveredBookId ?? '') ?? data.highlights[0];
        if (target === undefined) {
            test.skip(true, 'no highlight in snapshot');
            return;
        }

        await page.goto(`/?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        expect(await stageText(page)).toBe(target.text.trim());
        // The address keeps naming it, so a reload, a bookmark or a new tab reopens the same passage.
        expect(new URL(page.url()).searchParams.get('h')).toBe(target.id);

        await page.reload();
        await expect(page.getByTestId('stage-passage')).toHaveText(target.text.trim());
        expect(new URL(page.url()).searchParams.get('h')).toBe(target.id);

        // The source panel belongs to the linked passage, so its book is the one that wrote it.
        await page.getByTestId('source-toggle').click();
        const book = data.books.find((item) => item.id === target.bookId);
        if (book !== undefined) {
            await expect(page.getByTestId('source-panel')).toContainText(book.title);
        }
        // Opening and closing the panel is not a move through the reading world: the link stays.
        await page.getByTestId('close-source').click();
        expect(new URL(page.url()).searchParams.get('h')).toBe(target.id);
    });

    test('tints the hall with the linked passage book, exactly as that book own room does', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.coveredBookId;
        const target = bookId === null ? undefined : data.firstOfBook.get(bookId);
        test.skip(target === undefined || bookId === null, '需要一本有真实封面的书');
        if (target === undefined || bookId === null) {
            return;
        }

        await page.goto(`/?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        const linkedAura = await settledAura(page);

        await page.goto(`/books/${encodeURIComponent(bookId)}`);
        await expect(page.getByTestId('room-heading')).toContainText('《');
        const roomAura = await settledAura(page);

        // Colour ownership is by book, so the linked passage must carry the colour of its own book.
        expect(linkedAura).not.toBe('');
        expect(linkedAura).toBe(roomAura);
    });

    test('is one hall, not a second hall: no re-entry, no scroll reset, no new aura', async ({ page }) => {
        const data = loadSnapshot();
        const target = data.highlights[0];
        if (target === undefined) {
            test.skip(true, 'no highlight in snapshot');
            return;
        }

        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.evaluate(() => {
            window.scrollTo({ top: 400, behavior: 'auto' });
        });
        await page.evaluate(() => {
            // A probe that only survives if the aura layer is *not* remounted by the link.
            document.querySelector('.room-aura')?.setAttribute('data-probe', 'kept');
            // Focusing and scrolling the room are part of arriving at it, so they are counted rather than
            // inspected: a room that was re-entered would do both.
            const counter = { focus: 0, scroll: 0 };
            document.getElementById('room')?.addEventListener('focus', () => {
                counter.focus += 1;
            });
            const original = window.scrollTo.bind(window);
            window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
                counter.scroll += 1;
                return original(...args);
            }) as typeof window.scrollTo;
            (window as unknown as { __arrival: typeof counter }).__arrival = counter;
        });

        await clickInternalLink(page, `/?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(target.text.trim());

        expect(await page.getAttribute('.room-aura', 'data-probe')).toBe('kept');
        expect(await page.evaluate(() => (window as unknown as { __arrival: { focus: number } }).__arrival.focus)).toBe(0);
        // A deep link points at another passage inside the room, so the reading position stays put.
        expect(await page.evaluate(() => (window as unknown as { __arrival: { scroll: number } }).__arrival.scroll)).toBe(0);
    });

    test('drops the address once the visitor moves on, without adding a history entry', async ({ page }) => {
        const data = loadSnapshot();
        const target = data.highlights[0];
        if (target === undefined) {
            test.skip(true, 'no highlight in snapshot');
            return;
        }

        await page.goto(`/?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(target.text.trim());
        const historyBefore = await page.evaluate(() => window.history.length);

        await page.getByTestId('next-quote').click();
        await expect(page.getByTestId('stage-passage')).not.toHaveText(target.text.trim());

        // Replace, not push: the back button still means "leave this room" rather than "undo my reading".
        await expectSearch(page, '');
        expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
        // And the room was never re-entered, so the control the visitor used keeps the focus.
        expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '')).toBe('next-quote');
    });

    test('keeps the linked passage through a book room and back', async ({ page }) => {
        const data = loadSnapshot();
        const target = data.highlights[0];
        if (target === undefined) {
            test.skip(true, 'no highlight in snapshot');
            return;
        }

        await page.goto(`/?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(target.text.trim());
        await page.evaluate(() => {
            window.scrollTo({ top: 300, behavior: 'auto' });
        });
        await clickInternalLink(page, '/themes');
        await expect(page.getByTestId('room-heading')).toContainText('主题书架');

        await page.goBack();
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        // Coming back restores the passage that was there, and the address still describes it.
        await expect(page.getByTestId('stage-passage')).toHaveText(target.text.trim());
        await expectSearch(page, `?h=${encodeURIComponent(target.id)}`);
    });
});

test.describe('a link the snapshot cannot show is stated plainly', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实划线');

    test('says the passage is unavailable and still opens on a real one', async ({ page }) => {
        const data = loadSnapshot();

        await page.goto('/?h=h-does-not-exist');
        await expect(page.getByTestId('link-unavailable')).toHaveText('这条划线暂不可用');
        // Not an empty room and not an unknown path: a normal, real opening draw behind the note.
        const shown = await stageText(page);
        expect(data.texts.has(shown)).toBe(true);
        expect(shown.length).toBeGreaterThan(0);

        // The first move clears the note and drops the address that no longer describes the screen.
        await page.getByTestId('next-quote').click();
        await expect(page.getByTestId('link-unavailable')).toHaveCount(0);
        await expectSearch(page, '');
    });

    test('does not leak a private passage through a link-shaped address', async ({ page }) => {
        // A withdrawn or never-public id must not become a back door into local content.
        await page.goto('/?h=h-0000');
        await expect(page.getByTestId('link-unavailable')).toHaveText('这条划线暂不可用');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
    });

    test('a link on another room keeps that room and never puts the sentence there', async ({ page }) => {
        const data = loadSnapshot();
        const target = data.highlights[0];
        const themeId = data.themes[0]?.id;
        test.skip(target === undefined || themeId === undefined, '需要真实划线和一个主题书架');
        if (target === undefined || themeId === undefined) {
            return;
        }

        await page.goto(`/themes?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('room-heading')).toContainText('主题书架');
        await expectSearch(page, '');

        await page.goto(`/themes/${encodeURIComponent(themeId)}?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('room-heading')).toContainText('正在逛：');
        await expectSearch(page, '');

        await page.goto(`/books?h=${encodeURIComponent(target.id)}&year=2024`);
        await expect(page.getByTestId('room-heading')).toContainText('所有书');
        // The room keeps the filter that belongs to it, and only the passage is dropped.
        await expectSearch(page, '?year=2024');

        await page.goto(`/books/${encodeURIComponent(target.bookId)}?h=${encodeURIComponent(target.id)}`);
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await expectSearch(page, '');
    });
});
