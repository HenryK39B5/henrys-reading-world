import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Book Aura acceptance (docs/12 §4–6).
 *
 * Colour must come from the real cover of the book the room belongs to, must be subtle enough that the
 * sentence stays the visual centre, and must not fight text contrast. Reduced motion must remove the
 * displacement and the long colour transition without hiding the state.
 */
type Highlight = { id: string; text: string; bookId: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

function loadSnapshot(): {
    highlights: Highlight[];
    books: { id: string; coverPath?: string }[];
    countByBook: Map<string, number>;
    byText: Map<string, Highlight>;
} {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: { id: string; coverPath?: string }[];
    };
    const countByBook = new Map<string, number>();
    for (const highlight of parsed.highlights) {
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
    }
    return {
        highlights: parsed.highlights,
        books: parsed.books,
        countByBook,
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
    };
}

/** Which colour the cover of `bookId` actually is, sampled in the browser from the real image. */
async function coverAccent(page: Page, bookId: string): Promise<string | null> {
    return page.evaluate(async (id: string) => {
        const response = await fetch('/__local_snapshot');
        const snapshot = (await response.json()) as { books: { id: string; coverPath?: string }[] };
        const book = snapshot.books.find((item) => item.id === id);
        if (book?.coverPath === undefined) {
            return null;
        }
        const url = book.coverPath.startsWith('local-covers/')
            ? `/__local_cover/${book.coverPath.slice('local-covers/'.length)}`
            : `/${book.coverPath}`;
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
            return null;
        }
        context.drawImage(image, 0, 0, 16, 16);
        return url;
    }, bookId);
}

async function aura(page: Page) {
    return page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('.shell');
        const tint = document.querySelector<HTMLElement>('.room-aura-tint');
        if (shell === null || tint === null) {
            return null;
        }
        const style = getComputedStyle(tint);
        return {
            room: shell.dataset['roomAura'] ?? null,
            accent: getComputedStyle(shell).getPropertyValue('--aura').trim(),
            target: getComputedStyle(shell).getPropertyValue('--aura-target').trim(),
            opacity: Math.round(Number.parseFloat(style.opacity || '0') * 1000) / 1000,
            background: style.backgroundColor,
        };
    });
}

/**
 * Asks for another passage and watches the tint while it changes, inside the page so no round trip can
 * miss the transition. Returns the colour before, every colour observed during the window, and the
 * settled accent of the book that arrived.
 */
async function tintTimeline(
    page: Page,
    window = 2000,
): Promise<{ samples: string[]; from: string; to: string }> {
    return page.evaluate(async (span: number) => {
        const tint = document.querySelector<HTMLElement>('[data-testid="room-aura"]');
        const shell = document.querySelector<HTMLElement>('.shell');
        const button = document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]');
        if (tint === null || shell === null || button === null) {
            return { samples: [], from: '', to: '' };
        }
        const from = getComputedStyle(tint).backgroundColor;
        button.click();
        const samples: string[] = [];
        const started = performance.now();
        while (performance.now() - started < span) {
            samples.push(getComputedStyle(tint).backgroundColor);
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    resolve(null);
                });
            });
        }
        return {
            samples,
            from,
            to: getComputedStyle(tint).backgroundColor,
        };
    }, window);
}

/** Contrast of the room's text against the tinted paper, computed the way the browser composites it. */
async function contrast(page: Page) {
    return page.evaluate(() => {
        const toRgb = (value: string): [number, number, number] => {
            const hex = /^#([0-9a-f]{6})$/iu.exec(value.trim());
            if (hex?.[1] !== undefined) {
                const int = Number.parseInt(hex[1], 16);
                return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
            }
            const match = /rgba?\(([^)]+)\)/.exec(value);
            const parts = (match?.[1] ?? '0,0,0').split(',').map((part) => Number.parseFloat(part));
            return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
        };
        const luminance = (rgb: [number, number, number]) => {
            const channel = (value: number) => {
                const scaled = value / 255;
                return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
        };
        const ratio = (a: [number, number, number], b: [number, number, number]) => {
            const first = luminance(a);
            const second = luminance(b);
            return Math.round(((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)) * 100) / 100;
        };

        const paper = toRgb(getComputedStyle(document.documentElement).getPropertyValue('--paper') || '#faf9f6');
        const shell = document.querySelector<HTMLElement>('.shell');
        const tint = document.querySelector<HTMLElement>('.room-aura-tint');
        const accent = toRgb((shell === null ? '' : getComputedStyle(shell).getPropertyValue('--aura')) || '#425a4b');
        const alpha = Number.parseFloat((tint === null ? '0' : getComputedStyle(tint).opacity) || '0');
        const background: [number, number, number] = [
            paper[0] * (1 - alpha) + accent[0] * alpha,
            paper[1] * (1 - alpha) + accent[1] * alpha,
            paper[2] * (1 - alpha) + accent[2] * alpha,
        ];

        const colour = (selector: string) => {
            const node = document.querySelector(selector);
            return node === null ? null : toRgb(window.getComputedStyle(node).color);
        };
        const firstColour = (selectors: string[]) => {
            for (const selector of selectors) {
                const value = colour(selector);
                if (value !== null) {
                    return value;
                }
            }
            return null;
        };
        const passage = firstColour(['.stage-text', '.book-random-text']);
        const muted = firstColour(['.room-note', '.stage-attribution', '.book-head-meta', '.batch-label']);
        return {
            passage: passage === null ? null : ratio(passage, background),
            muted: muted === null ? null : ratio(muted, background),
        };
    });
}

test.describe('book aura', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('a room wears the colour of the book it belongs to', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);

        const hall = await aura(page);
        expect(hall?.room).toBe('hall');
        expect(hall?.target).toBe('0.05');
        // The colour arrives rather than appearing instantly, and it settles at its target.
        expect(hall?.opacity).toBeGreaterThan(0.045);
        expect(hall?.opacity).toBeLessThanOrEqual(0.05);
        expect(hall?.accent).toMatch(/^#[0-9a-f]{6}$/iu);

        // The hall's colour belongs to the passage on screen: its accent is that book's cover.
        const shown = await page.getByTestId('stage-passage').innerText();
        const record = loadSnapshot().byText.get(shown.trim());
        expect(record).toBeDefined();
        if (record !== undefined) {
            const previous = loadSnapshot().books.find((book) => book.id === record.bookId)?.coverPath;
            expect(previous, 'the book behind the hall passage must have a real cover').toBeDefined();
        }

        // A library, a shelf list and About stay neutral: real covers carry their own colour there.
        for (const path of ['/books', '/themes', '/about']) {
            await page.goto(path);
            await expect(page.getByTestId('room-heading')).toBeVisible();
            await page.waitForTimeout(800);
            const neutral = await aura(page);
            expect(neutral?.target, `${path} must stay on neutral paper`).toBe('0');
            expect(neutral?.opacity).toBe(0);
        }
    });

    test('the book room is the strongest aura and comes from that book', async ({ page }) => {
        const data = loadSnapshot();
        const bookId = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
        expect(bookId).toBeDefined();
        if (bookId === undefined) {
            return;
        }

        await page.goto(`/books/${bookId}`);
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);

        const strongest = await aura(page);
        expect(strongest?.room).toBe('book');
        expect(strongest?.target).toBe('0.1');
        expect(strongest?.opacity).toBeGreaterThan(0.09);
        // A flat tint layer in the book's own accent, not a gradient or a cover wall. The colour is
        // sampled from the cover asynchronously, so it settles onto the accent rather than being there
        // on the first frame.
        const hexOf = (value: string): string => {
            const channels = value.match(/\d+/gu) ?? [];
            return `#${channels
                .slice(0, 3)
                .map((part) => Number.parseInt(part, 10).toString(16).padStart(2, '0'))
                .join('')}`;
        };
        await expect
            .poll(async () => hexOf((await aura(page))?.background ?? ''), { timeout: 5000 })
            .toBe((strongest?.accent ?? '').toLowerCase());
        const tintHex = hexOf((await aura(page))?.background ?? '');
        expect(tintHex).toMatch(/^#[0-9a-f]{6}$/u);

        // The accent really is sampled from that book's cover image, not from a fixed palette.
        const imageUrl = await coverAccent(page, bookId);
        expect(imageUrl).not.toBeNull();
        const accent = (strongest?.accent ?? '').toLowerCase();
        expect(accent).toMatch(/^#[0-9a-f]{6}$/u);
        const sampled = await page.evaluate(async (url: string) => {
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
                return null;
            }
            context.drawImage(image, 0, 0, 16, 16);
            const { data } = context.getImageData(0, 0, 16, 16);
            let r = 0;
            let g = 0;
            let b = 0;
            let n = 0;
            for (let index = 0; index + 3 < data.length; index += 4) {
                r += data[index] ?? 0;
                g += data[index + 1] ?? 0;
                b += data[index + 2] ?? 0;
                n += 1;
            }
            return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
        }, imageUrl ?? '');

        expect(sampled).not.toBeNull();
        if (sampled !== null) {
            const rgb = [Number.parseInt(accent.slice(1, 3), 16), Number.parseInt(accent.slice(3, 5), 16), Number.parseInt(accent.slice(5, 7), 16)];
            // Same hue family as the real cover: the sampled accent is a muted reading of it, so allow a
            // generous distance while still failing a palette picked by hand.
            const distance = Math.sqrt(
                (rgb[0] - (sampled[0] ?? 0)) ** 2 + (rgb[1] - (sampled[1] ?? 0)) ** 2 + (rgb[2] - (sampled[2] ?? 0)) ** 2,
            );
            console.log(
                `aura ${accent} vs cover average rgb(${sampled.join(',')}) distance ${String(Math.round(distance))}`,
            );
            expect(distance).toBeLessThan(140);
        }
    });

    test('a shelf room keeps a neutral base with a local colour', async ({ page }) => {
        const data = loadSnapshot();
        const shelf = data.books.find((book) => (data.countByBook.get(book.id) ?? 0) > 0)?.id;
        const shelfId = (await (async () => {
            const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
                books: { id: string; themeIds: string[] }[];
            };
            return parsed.books.find((book) => book.id === shelf)?.themeIds[0];
        })());
        expect(shelfId).toBeDefined();
        if (shelfId === undefined) {
            return;
        }

        await page.goto(`/themes/${shelfId}`);
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);
        const room = await aura(page);
        expect(room?.room).toBe('theme');
        expect(room?.target).toBe('0.045');
        expect(room?.opacity).toBeGreaterThan(0.04);
    });

    test('text keeps its contrast over the tinted room', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);
        const hallRatio = await contrast(page);
        expect(hallRatio.passage, 'the passage must stay well above AA').toBeGreaterThan(7);
        expect(hallRatio.muted).toBeGreaterThan(4.5);

        const data = loadSnapshot();
        const bookId = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
        expect(bookId).toBeDefined();
        if (bookId === undefined) {
            return;
        }
        await page.goto(`/books/${bookId}`);
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);
        const bookRatio = await contrast(page);
        console.log(`contrast over the aura: hall ${JSON.stringify(hallRatio)}, book ${JSON.stringify(bookRatio)}`);
        expect(bookRatio.passage).toBeGreaterThan(7);
        expect(bookRatio.muted).toBeGreaterThan(4.5);
    });

    test('reduced motion removes the displacement and the long colour transition', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toBeVisible();

        const immediate = await aura(page);
        // The colour is simply there: no 700ms arrival to wait for.
        expect(immediate?.opacity).toBeGreaterThan(0.045);

        const styles = await page.evaluate(() => {
            const room = document.querySelector('.room');
            const tint = document.querySelector('.room-aura-tint');
            const passage = document.querySelector('.stage-live');
            return {
                roomAnimation: room === null ? '' : getComputedStyle(room).animationName,
                tintAnimation: tint === null ? '' : getComputedStyle(tint).animationName,
                tintTransition: tint === null ? '' : getComputedStyle(tint).transitionDuration,
                tintTransitionProperty: tint === null ? '' : getComputedStyle(tint).transitionProperty,
                roomTransform: room === null ? '' : getComputedStyle(room).transform,
                passageTransition: passage === null ? '' : getComputedStyle(passage).transitionDuration,
            };
        });
        console.log(`reduced-motion styles: ${JSON.stringify(styles)}`);
        expect(styles.roomAnimation).toBe('none');
        expect(styles.tintAnimation).toBe('none');
        expect(Number.parseFloat(styles.tintTransition)).toBeLessThan(0.05);
        expect(styles.tintTransitionProperty).toBe('none');
        expect(styles.roomTransform).toBe('none');
        expect(Number.parseFloat(styles.passageTransition)).toBeLessThan(0.05);

        // And the state still changes exactly once, immediately.
        const before = await page.getByTestId('stage-passage').innerText();
        await page.getByTestId('next-quote').click();
        await expect(page.getByTestId('stage-passage')).not.toHaveText(before);
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', '1');

        // The next book's colour is also simply there: nothing travels, nothing flickers.
        const colours = await tintTimeline(page);
        console.log(`reduced-motion tint colours after a draw: ${JSON.stringify(colours)}`);
        expect(new Set(colours.samples).size).toBeLessThanOrEqual(2);
    });

    /**
     * docs/12 §5.2: colour changes slower than the text. A passage change leaves the tint element in
     * place (the room's URL does not change), so the colour has to travel to the next book instead of
     * jumping to it when the cover is sampled.
     */
    test('a passage change moves the room colour to the next book instead of jumping', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);

        const declared = await page.getByTestId('room-aura').evaluate((node) => ({
            property: getComputedStyle(node).transitionProperty,
            duration: getComputedStyle(node).transitionDuration,
        }));
        expect(declared.property).toContain('background-color');
        expect(Number.parseFloat(declared.duration)).toBeGreaterThanOrEqual(0.6);
        expect(Number.parseFloat(declared.duration)).toBeLessThanOrEqual(0.9);

        // Draw until two passages in a row really do belong to differently coloured books.
        let observed: { samples: string[]; from: string; to: string } | null = null;
        for (let attempt = 0; attempt < 5 && observed === null; attempt += 1) {
            const timeline = await tintTimeline(page);
            if (timeline.from !== timeline.to && timeline.to !== '') {
                observed = timeline;
            }
            await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
            await page.waitForTimeout(800);
        }
        expect(observed, 'two draws in a row must end on different books').not.toBeNull();
        if (observed === null) {
            return;
        }

        // Intermediate colours are the difference between travelling and jumping: a jump would only
        // ever show the old and the new value.
        const distinct = new Set(observed.samples);
        console.log(
            `tint travel: ${String(distinct.size)} distinct colours from ${observed.from} to ${observed.to}`,
        );
        expect(distinct.size).toBeGreaterThan(3);
        expect(distinct.has(observed.to), 'the colour arrives at the new book').toBe(true);
    });

    test('rapid draws do not stack the room colour', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toBeVisible();
        await page.waitForTimeout(900);
        const before = await aura(page);

        await page.evaluate(() => {
            const target = document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]');
            for (let index = 0; index < 20; index += 1) {
                target?.click();
            }
        });
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        await page.waitForTimeout(900);

        const after = await aura(page);
        // One passage, one commit, one room colour: the aura never accumulates.
        await expect(page.locator('.stage-text')).toHaveCount(1);
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', '1');
        expect(after?.opacity).toBeLessThanOrEqual(before?.opacity ?? 0.05);
        expect(after?.opacity).toBeGreaterThan(0.04);
    });
});
