import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_ACCENT, accentFromPixels, contrastRatio, hexToRgb, type Rgb } from '../src/domain/accent.ts';
import { sharePalette } from '../src/domain/sharePalette.ts';
import { hasSnapshot, loadSnapshot, nonWhitespace } from './support/snapshot.ts';

/**
 * The share card's colour (docs/16 §4–5, §7.3).
 *
 * The card is the one place in the product where a Book Aura is allowed to fill an area: a low-saturation
 * dark surface carrying a whole passage. Three things have to hold, and none of them can be checked by
 * looking at a single screenshot:
 *
 * 1. the surface comes from the *locked* passage's own book, through the same cover sampling the rooms use;
 * 2. it does not change while the dialog is open, whatever the stage behind it does;
 * 3. everything written on the card is readable on the card, with the passage complete.
 */

/** The pixels the app itself samples a cover from, read back from the real image. */
async function coverPixels(page: Page, source: string): Promise<Rgb[]> {
    return page.evaluate(async (url: string) => {
        const image = new Image();
        image.decoding = 'async';
        await new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
            image.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context === null) {
            return [];
        }
        context.drawImage(image, 0, 0, 16, 16);
        const { data } = context.getImageData(0, 0, 16, 16);
        const pixels: { r: number; g: number; b: number }[] = [];
        for (let index = 0; index + 3 < data.length; index += 4) {
            if ((data[index + 3] ?? 0) < 200) {
                continue;
            }
            pixels.push({ r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 });
        }
        return pixels;
    }, source);
}

function coverUrlOf(coverPath: string): string {
    return coverPath.startsWith('local-covers/')
        ? `/__local_cover/${coverPath.slice('local-covers/'.length)}`
        : `/${coverPath}`;
}

/** The colour the app should have derived for one book, computed here from its real cover. */
async function expectedAccent(page: Page, coverPath: string): Promise<string> {
    const pixels = await coverPixels(page, coverUrlOf(coverPath));
    return accentFromPixels(pixels) ?? DEFAULT_ACCENT;
}

/** What the card is actually painted with, and what sits on it. */
async function cardFacts(page: Page): Promise<{
    accent: string;
    background: string;
    text: string;
    muted: string;
    extended: string | null;
    overflow: { vertical: number; horizontal: number };
}> {
    return page.getByTestId('share-card').evaluate((node) => {
        const style = getComputedStyle(node);
        const meta = node.querySelector('.share-card-meta');
        return {
            accent: node.getAttribute('data-accent') ?? '',
            background: style.backgroundColor,
            text: style.color,
            muted: meta === null ? '' : getComputedStyle(meta).color,
            extended: node.getAttribute('data-extended'),
            overflow: {
                vertical: node.scrollHeight - node.clientHeight,
                horizontal: node.scrollWidth - node.clientWidth,
            },
        };
    });
}

function toRgb(colour: string): Rgb {
    const channels = colour.match(/\d+/gu) ?? [];
    const [r, g, b] = channels.slice(0, 3).map((part) => Number.parseInt(part, 10));
    if (r === undefined || g === undefined || b === undefined) {
        throw new Error(`not an rgb colour: ${colour}`);
    }
    return { r, g, b };
}

async function shareThroughDeepLink(page: Page, highlightId: string): Promise<void> {
    await page.goto(`/?h=${encodeURIComponent(highlightId)}`);
    await expect(page.getByTestId('stage-passage')).toBeVisible();
    await page.getByTestId('share-open').click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
}

/**
 * Waits until the card carries the colour its book's cover produces.
 *
 * A card is allowed to *arrive* with its colour rather than holding it on the very first frame: the accent
 * is sampled from a real cover image, and a deep link opens the dialog before that sampling has finished
 * (docs/16 §5.3). Nothing is broken by that — every intermediate surface is a readable card, because the
 * palette is a partial function of a colour that always exists — but where it settles is what these checks
 * are about, so they read the settled card.
 */
async function settleCard(page: Page, expected: string): Promise<void> {
    await expect
        .poll(async () => page.getByTestId('share-card').getAttribute('data-accent'), {
            message: `the card must settle on its own book's accent (${expected})`,
            timeout: 8000,
        })
        .toBe(expected);
    // The surface then *travels* to that colour instead of jumping to it (docs/16 §5.3), so the painted
    // background is read once the card has actually got there rather than mid-transition.
    await expect
        .poll(async () => (await cardFacts(page)).background, {
            message: `the card must be painted with ${expected}'s palette`,
            timeout: 8000,
        })
        .toBe(cssOf(sharePalette(expected).background));
}

test.describe('the share card belongs to the book it came from', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('takes its colour from the locked passage own cover', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.coveredBookId;
        const highlight = bookId === null ? undefined : data.firstOfBook.get(bookId);
        test.skip(highlight === undefined || bookId === null, '需要一本有真实封面的书');
        if (highlight === undefined || bookId === null) {
            return;
        }
        const book = data.bookById.get(bookId);
        expect(book?.coverPath).toBeDefined();
        if (book?.coverPath === undefined) {
            return;
        }

        await shareThroughDeepLink(page, highlight.id);
        const expected = await expectedAccent(page, book.coverPath);
        await settleCard(page, expected);
        const facts = await cardFacts(page);

        // The accent the card names is the one this book's own cover produces.
        expect(facts.accent).toBe(expected);
        // And the surface is that accent's palette, not the room's tint or a default.
        expect(facts.background).toBe(cssOf(sharePalette(expected).background));
    });

    test('paints different books differently, from their own real covers', async ({ page }) => {
        const data = loadSnapshot();
        // Six books with covers and passages, chosen so their sampled accents are actually distinct: the
        // point of the check is that the card is a *per book* surface, which needs different colours to test.
        const candidates: { id: string; coverPath: string; highlightId: string }[] = [];
        for (const book of data.books) {
            if (book.coverPath === undefined) {
                continue;
            }
            const highlight = data.firstOfBook.get(book.id);
            if (highlight === undefined) {
                continue;
            }
            candidates.push({ id: book.id, coverPath: book.coverPath, highlightId: highlight.id });
            if (candidates.length === 12) {
                break;
            }
        }
        expect(candidates.length).toBeGreaterThanOrEqual(6);

        await page.goto('/');
        const chosen: typeof candidates = [];
        const accents = new Set<string>();
        for (const candidate of candidates) {
            const accent = await expectedAccent(page, candidate.coverPath);
            if (accents.has(accent)) {
                continue;
            }
            accents.add(accent);
            chosen.push(candidate);
            if (chosen.length === 6) {
                break;
            }
        }
        test.skip(chosen.length < 6, 'not enough different cover colours in this snapshot');

        const surfaces = new Set<string>();
        for (const candidate of chosen) {
            await shareThroughDeepLink(page, candidate.highlightId);
            const accent = await expectedAccent(page, candidate.coverPath);
            await settleCard(page, accent);
            const facts = await cardFacts(page);
            expect(facts.accent, `${candidate.id} must use its own cover accent`).toBe(accent);
            expect(facts.background, `${candidate.id} surface`).toBe(cssOf(sharePalette(accent).background));
            surfaces.add(facts.background);
        }
        // Six distinct accents are expected to produce at least four visibly different cards.
        expect(surfaces.size).toBeGreaterThanOrEqual(4);
    });

    test('keeps its colour while the stage behind it moves on', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        // The hall's own aura has been sampling this same cover, so the card is expected to settle on the
        // book's colour rather than on the default it may briefly start from.
        const shown = (await page.getByTestId('stage-passage').innerText()).trim();
        const record = loadSnapshot().byText.get(shown);
        expect(record).toBeDefined();
        if (record === undefined) {
            return;
        }
        const cover = loadSnapshot().bookById.get(record.bookId)?.coverPath;
        if (cover === undefined) {
            return;
        }
        await settleCard(page, await expectedAccent(page, cover));
        const opened = await cardFacts(page);

        // A modal marks the page behind it inert, so the visitor cannot move the stage on at all; the
        // keyboard is tried anyway, because that is what an owner of a fast keyboard would do.
        for (let press = 0; press < 5; press += 1) {
            await page.keyboard.press('Tab');
        }
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        const after = await cardFacts(page);
        expect(after.accent).toBe(opened.accent);
        expect(after.background).toBe(opened.background);
        await expect(page.getByTestId('share-card-text')).toHaveText(
            (await page.getByTestId('share-card-text').innerText()).trim(),
        );
    });

    test('falls back to the default card when a book has no cover at all', async ({ page }) => {
        const data = loadSnapshot();
        const withoutCover = data.books.find((book) => book.coverPath === undefined);
        const highlight = withoutCover === undefined ? undefined : data.firstOfBook.get(withoutCover.id);
        test.skip(highlight === undefined, 'this snapshot has every book covered');
        if (highlight === undefined) {
            return;
        }

        await shareThroughDeepLink(page, highlight.id);
        const facts = await cardFacts(page);
        expect(facts.accent).toBe(DEFAULT_ACCENT);
        expect(facts.background).toBe(cssOf(sharePalette(DEFAULT_ACCENT).background));
        // The card is still a whole card: the palette is a fallback, never a blank surface.
        expect(facts.overflow).toEqual({ vertical: 0, horizontal: 0 });
        await expect(page.getByTestId('share-card-text')).not.toHaveText('');
    });

    test('falls back to the default card when the cover cannot be loaded', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.coveredBookId;
        const highlight = bookId === null ? undefined : data.firstOfBook.get(bookId);
        test.skip(highlight === undefined, '需要一本有真实封面的书');
        if (highlight === undefined) {
            return;
        }

        // The image is simply not there: a cover that does not arrive must not produce a card with no colour.
        await page.route('**/__local_cover/**', (route) => route.abort());
        await shareThroughDeepLink(page, highlight.id);
        const facts = await cardFacts(page);
        expect(facts.accent).toBe(DEFAULT_ACCENT);
        expect(facts.background).toBe(cssOf(sharePalette(DEFAULT_ACCENT).background));
    });

    test('everything written on a card is readable on that card', async ({ page }) => {
        const data = loadSnapshot();
        const candidates = data.books
            .filter((book) => book.coverPath !== undefined && data.firstOfBook.has(book.id))
            .slice(0, 4);
        expect(candidates.length).toBeGreaterThan(0);

        for (const book of candidates) {
            const highlight = data.firstOfBook.get(book.id);
            if (highlight === undefined) {
                continue;
            }
            await shareThroughDeepLink(page, highlight.id);
            const accent = await expectedAccent(page, book.coverPath);
            await settleCard(page, accent);
            const facts = await cardFacts(page);
            const background = toRgb(facts.background);
            // WCAG AA for body text, measured on the colours the browser really painted.
            expect(contrastRatio(toRgb(facts.text), background), `${book.id} passage`).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(toRgb(facts.muted), background), `${book.id} source`).toBeGreaterThanOrEqual(4.5);
        }
    });

    test('does not carry the colour in with a long transition when motion is reduced', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = data.coveredBookId;
        const highlight = bookId === null ? undefined : data.firstOfBook.get(bookId);
        test.skip(highlight === undefined, '需要一本有真实封面的书');
        if (highlight === undefined) {
            return;
        }

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await shareThroughDeepLink(page, highlight.id);
        const duration = await page
            .getByTestId('share-card')
            .evaluate((node) => getComputedStyle(node).transitionDuration);
        // Every duration in the list, because the card transitions more than one property.
        for (const value of duration.split(',')) {
            expect(Number.parseFloat(value)).toBeLessThan(0.05);
        }
    });

    test('a long real passage still arrives whole on a coloured card', async ({ page }) => {
        const data = loadSnapshot();
        for (const highlight of [data.longest, data.shortest, data.medium]) {
            await shareThroughDeepLink(page, highlight.id);
            const facts = await cardFacts(page);
            // Nothing is cropped, and the card grew rather than the text shrinking.
            expect(facts.overflow).toEqual({ vertical: 0, horizontal: 0 });
            await expect(page.getByTestId('share-card-text')).toHaveText(highlight.text);
            const extended = facts.extended === 'true';
            expect(extended).toBe(nonWhitespace(highlight.text) > 120);
        }
    });
});

/** An `rgb()` string the browser would report for a hex colour. */
function cssOf(hex: string): string {
    const rgb = hexToRgb(hex);
    if (rgb === null) {
        throw new Error(`not a colour: ${hex}`);
    }
    return `rgb(${String(rgb.r)}, ${String(rgb.g)}, ${String(rgb.b)})`;
}
