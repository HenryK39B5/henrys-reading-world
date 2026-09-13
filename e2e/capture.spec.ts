import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Review capture: screenshots plus the measurements that can be judged without seeing the page.
 *
 * Output goes to .private/review/rooms-batch/ because the rooms show real, not-yet-public passages.
 * Run with: npm run capture:review
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const OUT_DIR = join(process.cwd(), '.private/review/rooms-batch');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type Highlight = { id: string; text: string; bookId: string };

function loadHighlights(): Highlight[] {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { highlights: Highlight[] };
    return parsed.highlights;
}

function nonWhitespaceLength(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

/** WCAG relative luminance ratio between two `rgb()` colours. */
async function contrastRatios(page: Page) {
    return page.evaluate(() => {
        const parse = (value: string): [number, number, number] => {
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
        const ratio = (foreground: [number, number, number], background: [number, number, number]) => {
            const first = luminance(foreground);
            const second = luminance(background);
            const lighter = Math.max(first, second);
            const darker = Math.min(first, second);
            return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
        };

        /** The room's real background: the page's paper with the aura layer composited over it. */
        const paper = parse(getComputedStyle(document.documentElement).getPropertyValue('--paper') || '#faf9f6');
        const shell = document.querySelector<HTMLElement>('.shell');
        const tint = document.querySelector<HTMLElement>('.room-aura-tint');
        const accent = parse(
            (shell === null ? '' : getComputedStyle(shell).getPropertyValue('--aura')) || '#425a4b',
        );
        const strength = Number.parseFloat((tint === null ? '0' : getComputedStyle(tint).opacity) || '0');
        const background: [number, number, number] = [
            paper[0] * (1 - strength) + accent[0] * strength,
            paper[1] * (1 - strength) + accent[1] * strength,
            paper[2] * (1 - strength) + accent[2] * strength,
        ];

        const body = window.getComputedStyle(document.body);
        const passage = document.querySelector('.stage-text');
        const attribution = document.querySelector('.stage-attribution');
        const heading = document.querySelector('.room-heading');
        const note = document.querySelector('.room-note');
        const link = document.querySelector('.room-exit');
        const colour = (node: Element | null, fallback: string) =>
            node === null ? null : parse(window.getComputedStyle(node).color || fallback);

        return {
            room: shell?.dataset['roomAura'] ?? null,
            auraPercent: Math.round(strength * 1000) / 10,            bodyOnPaper: ratio(parse(body.color), background),
            passageOnPaper: ratio(colour(passage, body.color) ?? parse(body.color), background),
            attributionOnPaper: ratio(colour(attribution, body.color) ?? parse(body.color), background),
            headingOnPaper: ratio(colour(heading, body.color) ?? parse(body.color), background),
            noteOnPaper: ratio(colour(note, body.color) ?? parse(body.color), background),
            exitOnPaper: ratio(colour(link, body.color) ?? parse(body.color), background),
        };
    });
}

/** The room's aura: which room, which real cover colour, and how strong it resolved. */
async function auraInfo(page: Page) {
    return page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('.shell');
        const tint = document.querySelector<HTMLElement>('.room-aura-tint');
        if (shell === null || tint === null) {
            return null;
        }
        return {
            room: shell.dataset['roomAura'] ?? null,
            accent: getComputedStyle(shell).getPropertyValue('--aura').trim(),
            target: getComputedStyle(shell).getPropertyValue('--aura-target').trim(),
            opacity: Math.round(Number.parseFloat(getComputedStyle(tint).opacity || '0') * 1000) / 1000,
        };
    });
}

/** Lines, font size and effective characters per line for the passage on screen. */
async function passageMetrics(page: Page, selector = '.stage-text') {
    return page.locator(selector).first().evaluate((element) => {
        const style = window.getComputedStyle(element);
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        return {
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: style.lineHeight,
            width: Math.round(element.getBoundingClientRect().width),
            lines: rects.length,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
        };
    });
}

async function overflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function smallestTarget(page: Page): Promise<number> {
    return page.evaluate(() => {
        const targets = [...document.querySelectorAll('button, a[href]')].filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        return Math.round(
            targets.reduce((smallest, node) => Math.min(smallest, node.getBoundingClientRect().height), 999),
        );
    });
}

async function density(page: Page) {
    return page.evaluate(() => ({
        passageNodes: document.querySelectorAll('.passage-text').length,
        bookRows: document.querySelectorAll('.book-item').length,
        shelfRows: document.querySelectorAll('.shelf-item').length,
        images: document.querySelectorAll('img').length,
        totalElements: document.querySelectorAll('*').length,
        text: document.body.innerText.length,
    }));
}

async function advance(page: Page): Promise<void> {
    await page.getByTestId('next-quote').click();
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
}

async function roomReady(page: Page): Promise<void> {
    await expect(page.getByTestId('room-heading')).toBeVisible();
    await page.waitForTimeout(250);
}

test.describe('review capture', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('walks every room and prints measurable facts', async ({ page }) => {
        // A deliberate, thorough review walk: every room, four viewports, motion preferences, and the
        // rare-opening walk that draws through a whole shelf to reach a book with nothing shorter.
        test.setTimeout(600_000);
        mkdirSync(OUT_DIR, { recursive: true });
        const highlights = loadHighlights();

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await roomReady(page);

        // --- hall: length bands -----------------------------------------------------
        await page.screenshot({ path: join(OUT_DIR, 'hall-1440.png'), fullPage: true });
        const bands = new Set<string>();
        for (let step = 0; step < 260 && bands.size < 3; step += 1) {
            const band = (await page.locator('.stage').getAttribute('data-band')) ?? '';
            if (band !== '' && !bands.has(band)) {
                bands.add(band);
                const text = (await page.getByTestId('stage-passage').innerText()).trim();
                const metrics = await passageMetrics(page);
                const charsPerLine = Math.round(nonWhitespaceLength(text) / Math.max(1, metrics.lines));
                console.log(
                    `band ${band}: font ${String(metrics.fontSize)}px / line-height ${metrics.lineHeight} / width ${String(metrics.width)}px / lines ${String(metrics.lines)} / ~${String(charsPerLine)} chars per line`,
                );
                await page.screenshot({ path: join(OUT_DIR, `band-${band}-1440.png`) });
            }
            await advance(page);
        }
        console.log(`bands captured: ${[...bands].sort().join(', ')}`);
        console.log(`hall aura: ${JSON.stringify(await auraInfo(page))}`);
        console.log(`hall density: ${JSON.stringify(await density(page))}`);
        console.log(`hall contrast against the tinted room: ${JSON.stringify(await contrastRatios(page))}`);

        // --- the other rooms --------------------------------------------------------
        await page.goto('/themes');
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'themes-1440.png'), fullPage: true });
        console.log(`themes density: ${JSON.stringify(await density(page))}`);

        await page.getByTestId('theme-list').locator('a.shelf-link').first().click();
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'theme-room-1440.png'), fullPage: true });
        console.log(`theme room heading: ${await page.getByTestId('room-heading').innerText()}`);
        console.log(`theme room note: ${await page.getByTestId('theme-note').innerText()}`);
        console.log(`theme room aura: ${JSON.stringify(await auraInfo(page))}`);
        console.log(`theme room contrast: ${JSON.stringify(await contrastRatios(page))}`);
        await page.getByTestId('source-toggle').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT_DIR, 'theme-room-source-1440.png'), fullPage: true });
        await page.getByTestId('close-source').click();
        // The same room at phone width: a shelf room is a reading surface, not a desktop-only page.
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: join(OUT_DIR, 'theme-room-390.png'), fullPage: true });
        console.log(
            `theme room at 390: overflow ${String(await overflow(page))}px / stage font ${String((await passageMetrics(page)).fontSize)}px`,
        );
        await page.setViewportSize({ width: 1440, height: 900 });

        /**
         * The rare long opening, in the stage itself (docs/12 §7).
         *
         * A book that holds nothing in the preferred 20–120 character band still opens with its own
         * line. The fair engine covers a whole shelf before it repeats a book, so drawing inside the
         * shelf that book is filed on reaches it deterministically — no need to fake a deep link that
         * only V2-E will add.
         */
        const starved = await page.evaluate(async () => {
            const response = await fetch('/__local_snapshot');
            const snapshot = (await response.json()) as {
                books: { id: string; themeIds: string[] }[];
                highlights: { id: string; bookId: string; text: string }[];
            };
            const length = (text: string) => [...text].filter((char) => !/\s/u.test(char)).length;
            const grouped = new Map<string, { id: string; bookId: string; text: string }[]>();
            for (const highlight of snapshot.highlights) {
                const list = grouped.get(highlight.bookId);
                if (list === undefined) {
                    grouped.set(highlight.bookId, [highlight]);
                } else {
                    list.push(highlight);
                }
            }
            const booksWithPassages = new Set(grouped.keys());
            const entries: { bookId: string; shelfId: string; shelfSize: number; length: number; text: string }[] = [];
            for (const [bookId, items] of grouped) {
                if (items.some((item) => length(item.text) >= 20 && length(item.text) <= 120)) {
                    continue;
                }
                const longest = [...items].sort((left, right) => length(right.text) - length(left.text))[0];
                if (longest === undefined) {
                    continue;
                }
                const shelves = (snapshot.books.find((book) => book.id === bookId)?.themeIds ?? [])
                    .map((themeId) => ({
                        themeId,
                        size: snapshot.books.filter((book) => book.themeIds.includes(themeId) && booksWithPassages.has(book.id))
                            .length,
                    }))
                    .filter((entry) => entry.size > 0)
                    .sort((left, right) => left.size - right.size);
                const shelf = shelves[0];
                if (shelf === undefined) {
                    continue;
                }
                entries.push({
                    bookId,
                    shelfId: shelf.themeId,
                    shelfSize: shelf.size,
                    length: length(longest.text),
                    text: longest.text,
                });
            }
            return entries.sort((left, right) => right.length - left.length);
        });
        console.log(
            `books outside the preferred band: ${starved
                .map((entry) => `${entry.bookId} ${String(entry.length)} chars on ${entry.shelfId}`)
                .join(', ')}`,
        );

        const worst = starved[0];
        if (worst !== undefined) {
            await page.goto(`/themes/${worst.shelfId}`);
            await roomReady(page);
            let draws = 0;
            for (let step = 0; step <= worst.shelfSize + 2; step += 1) {
                const shown = (await page.getByTestId('stage-passage').innerText()).trim();
                if (shown === worst.text.trim()) {
                    break;
                }
                draws += 1;
                await page.getByTestId('next-quote').click();
                await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
            }
            const shown = (await page.getByTestId('stage-passage').innerText()).trim();
            expect(shown, `${worst.bookId} must open within one cycle of ${worst.shelfId}`).toBe(worst.text.trim());
            await page.waitForTimeout(800);
            const metrics = await passageMetrics(page);
            console.log(
                `longest possible opening in the stage: ${String(worst.length)} chars after ${String(draws)} draws on ${worst.shelfId}, ${String(metrics.lines)} lines, font ${String(metrics.fontSize)}px, band ${String(
                    await page.locator('.stage').getAttribute('data-band'),
                )}`,
            );
            console.log(`long opening stage aura: ${JSON.stringify(await auraInfo(page))}`);
            console.log(`long opening contrast: ${JSON.stringify(await contrastRatios(page))}`);
            await page.screenshot({ path: join(OUT_DIR, 'opening-longest-1440.png'), fullPage: true });
            await page.setViewportSize({ width: 390, height: 844 });
            const narrow = await passageMetrics(page);
            console.log(
                `long opening at 390: ${String(narrow.lines)} lines, font ${String(narrow.fontSize)}px, overflow ${String(await overflow(page))}px`,
            );
            await page.screenshot({ path: join(OUT_DIR, 'opening-longest-390.png'), fullPage: true });
            await page.setViewportSize({ width: 1440, height: 900 });

            // The shortest opening of the library, for the other end of the same rule.
            const shortest = starved[starved.length - 1];
            if (shortest !== undefined && shortest.bookId !== worst.bookId) {
                await page.goto(`/themes/${shortest.shelfId}`);
                await roomReady(page);
                for (let step = 0; step <= shortest.shelfSize + 2; step += 1) {
                    if ((await page.getByTestId('stage-passage').innerText()).trim() === shortest.text.trim()) {
                        break;
                    }
                    await page.getByTestId('next-quote').click();
                    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
                }
                await page.waitForTimeout(800);
                console.log(
                    `shortest possible opening in the stage: ${String(shortest.length)} chars, band ${String(
                        await page.locator('.stage').getAttribute('data-band'),
                    )}`,
                );
                await page.screenshot({ path: join(OUT_DIR, 'opening-shortest-1440.png'), fullPage: true });
            }
        }

        await page.goto('/books');
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'books-1440.png'), fullPage: true });
        console.log(`books aura: ${JSON.stringify(await auraInfo(page))}`);
        console.log(`books density: ${JSON.stringify(await density(page))}`);
        console.log(`books batch label: ${await page.getByTestId('books-batch-label').innerText()}`);

        await page.getByTestId('book-list').locator('a.book-link').first().click();
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'book-room-1440.png'), fullPage: true });
        console.log(`book room heading: ${await page.getByTestId('room-heading').innerText()}`);
        console.log(`book room aura: ${JSON.stringify(await auraInfo(page))}`);
        console.log(`book room batch label: ${await page.getByTestId('book-batch-label').innerText()}`);
        console.log(`book room density: ${JSON.stringify(await density(page))}`);
        console.log(`book room contrast: ${JSON.stringify(await contrastRatios(page))}`);

        /**
         * Six books with visibly different cover colours, so the aura can be reviewed for real rather
         * than assumed from one screenshot.
         */
        const colourSample = await page.evaluate(async () => {
            const response = await fetch('/__local_snapshot');
            const snapshot = (await response.json()) as {
                books: { id: string; title: string; coverPath?: string }[];
                highlights: { bookId: string }[];
            };
            const counts = new Map<string, number>();
            for (const highlight of snapshot.highlights) {
                counts.set(highlight.bookId, (counts.get(highlight.bookId) ?? 0) + 1);
            }
            const sample = async (book: { id: string; coverPath?: string }) => {
                if (book.coverPath === undefined) {
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
                canvas.width = 8;
                canvas.height = 8;
                const context = canvas.getContext('2d');
                if (context === null) {
                    return null;
                }
                context.drawImage(image, 0, 0, 8, 8);
                const { data } = context.getImageData(0, 0, 8, 8);
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
                return { bookId: book.id, average: [Math.round(r / n), Math.round(g / n), Math.round(b / n)] };
            };
            const ranked = snapshot.books
                .filter((book) => (counts.get(book.id) ?? 0) > 0 && book.coverPath !== undefined)
                .slice(0, 40);
            const measured = [];
            for (const book of ranked) {
                const result = await sample(book);
                if (result !== null) {
                    measured.push(result);
                }
            }
            return measured;
        });
        if (colourSample.length > 0) {
            const distinct = colourSample
                .filter((entry) => entry !== null)
                .filter((entry, index, all) =>
                    all.findIndex(
                        (other) =>
                            Math.abs((other.average[0] ?? 0) - (entry.average[0] ?? 0)) < 30 &&
                            Math.abs((other.average[1] ?? 0) - (entry.average[1] ?? 0)) < 30 &&
                            Math.abs((other.average[2] ?? 0) - (entry.average[2] ?? 0)) < 30,
                    ) === index,
                )
                .slice(0, 6);
            for (const [index, entry] of distinct.entries()) {
                await page.goto(`/books/${entry.bookId}`);
                await roomReady(page);
                await page.waitForTimeout(800);
                const info = await auraInfo(page);
                console.log(
                    `cover sample ${String(index + 1)}: ${entry.bookId} cover rgb(${entry.average.join(',')}) -> aura ${String(info?.accent ?? '')}`,
                );
                await page.screenshot({ path: join(OUT_DIR, `book-room-colour-${String(index + 1)}-1440.png`), fullPage: true });
            }
            console.log(`cover colour samples: ${String(distinct.length)}`);
        }

        await page.goto('/about');
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'about-1440.png'), fullPage: true });
        console.log(`about aura: ${JSON.stringify(await auraInfo(page))}`);

        // --- full-library reading (V2-D): the whole library and the largest book, in batches ---
        await page.goto('/books');
        await roomReady(page);
        let guard = 0;
        while ((await page.getByTestId('books-more').count()) > 0 && guard < 20) {
            await page.getByTestId('books-more').click();
            guard += 1;
        }
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(130);
        console.log(`books expanded: ${await page.getByTestId('books-batch-label').innerText()}`);
        console.log(`books expanded density: ${JSON.stringify(await density(page))}`);
        await page.screenshot({ path: join(OUT_DIR, 'books-expanded-1440.png'), fullPage: true });

        const largest = await page.evaluate(async () => {
            const response = await fetch('/__local_snapshot');
            const snapshot = (await response.json()) as { highlights: { bookId: string }[] };
            const counts = new Map<string, number>();
            for (const highlight of snapshot.highlights) {
                counts.set(highlight.bookId, (counts.get(highlight.bookId) ?? 0) + 1);
            }
            return [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
        });
        if (largest !== null) {
            const [bookId, count] = largest;
            await page.goto(`/books/${bookId}`);
            await roomReady(page);
            console.log(`largest book first batch: ${await page.getByTestId('book-batch-label').innerText()}`);
            const started = Date.now();
            guard = 0;
            while ((await page.getByTestId('book-more').count()) > 0 && guard < 40) {
                await page.getByTestId('book-more').click();
                guard += 1;
            }
            await expect(page.getByTestId('book-passages').locator('.passage-item')).toHaveCount(count);
            console.log(
                `largest book walked to its last passage: ${await page.getByTestId('book-batch-label').innerText()} in ${String(Date.now() - started)}ms`,
            );
            console.log(`largest book expanded density: ${JSON.stringify(await density(page))}`);
            await page.screenshot({ path: join(OUT_DIR, 'book-room-longest-expanded-1440.png'), fullPage: true });
        }

        /**
         * Edge cases of the same room: a book with no cover art, and the two extreme real passage
         * lengths (the longest line in the library, and the shortest book that still opens the world).
         */
        const edges = await page.evaluate(async () => {
            const response = await fetch('/__local_snapshot');
            const snapshot = (await response.json()) as {
                books: { id: string; coverPath?: string }[];
                highlights: { id: string; bookId: string; text: string }[];
            };
            const length = (text: string) => [...text].filter((char) => !/\s/u.test(char)).length;
            const counts = new Map<string, number>();
            for (const highlight of snapshot.highlights) {
                counts.set(highlight.bookId, (counts.get(highlight.bookId) ?? 0) + 1);
            }
            const longest = [...snapshot.highlights].sort((left, right) => length(right.text) - length(left.text))[0];
            const starved = snapshot.books
                .filter((book) => book.coverPath === undefined && (counts.get(book.id) ?? 0) > 0)
                .map((book) => ({ id: book.id, count: counts.get(book.id) ?? 0 }))
                .sort((left, right) => right.count - left.count)[0];
            return { longest: longest ?? null, withoutCover: starved ?? null, longestLength: longest === null ? 0 : length(longest.text) };
        });

        if (edges.withoutCover !== null) {
            await page.goto(`/books/${edges.withoutCover.id}`);
            await roomReady(page);
            await page.waitForTimeout(700);
            console.log(`book without a cover: ${edges.withoutCover.id}, aura ${JSON.stringify(await auraInfo(page))}`);
            await page.screenshot({ path: join(OUT_DIR, 'book-room-no-cover-1440.png'), fullPage: true });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.screenshot({ path: join(OUT_DIR, 'book-room-no-cover-390.png'), fullPage: true });
            await page.setViewportSize({ width: 1440, height: 900 });
        }

        if (edges.longest !== null) {
            await page.goto(`/books/${edges.longest.bookId}`);
            await roomReady(page);
            await page.waitForTimeout(700);
            const metrics = await passageMetrics(page, '.book-random-text');
            console.log(
                `longest real passage on screen: ${String(edges.longestLength)} characters, ${String(metrics.lines)} lines, font ${String(metrics.fontSize)}px`,
            );
            await page.screenshot({ path: join(OUT_DIR, 'book-room-longest-passage-1440.png'), fullPage: true });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.screenshot({ path: join(OUT_DIR, 'book-room-longest-passage-390.png'), fullPage: true });
            await page.setViewportSize({ width: 1440, height: 900 });
        }

        // --- return journey: does a room come back the way it was left? -------------
        await page.goto('/themes');
        await roomReady(page);
        const themeId = ((await page.getByTestId('theme-list').locator('a.shelf-link').first().getAttribute('data-testid')) ?? '').replace('theme-', '');
        await page.getByTestId(`theme-${themeId}`).click();
        await roomReady(page);
        await advance(page);
        await advance(page);
        await advance(page);
        const shelfSentence = (await page.getByTestId('stage-passage').innerText()).trim();
        await page.getByTestId('open-book').count();
        await page.getByTestId('source-toggle').click();
        await page.getByTestId('open-book').click();
        await roomReady(page);
        await page.goBack();
        await roomReady(page);
        const returned = (await page.getByTestId('stage-passage').innerText()).trim();
        console.log(`theme room restored: ${String(returned === shelfSentence)}`);

        // --- measured behaviour on the hall ----------------------------------------
        await page.goto('/');
        await roomReady(page);
        const transitions: number[] = [];
        for (let index = 0; index < 5; index += 1) {
            const before = await page.getByTestId('stage-passage').innerText();
            const started = await page.evaluate(() => performance.now());
            await page.getByTestId('next-quote').click();
            await page.waitForFunction(
                (previous) => document.querySelector('[data-testid="stage-passage"]')?.textContent?.trim() !== previous.trim(),
                before,
                { timeout: 3000 },
            );
            transitions.push(Math.round((await page.evaluate(() => performance.now())) - started));
            await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        }
        console.log(`commit latency over 5 clicks (ms): ${transitions.join(', ')}`);

        const rapidStart = await page.locator('.stage').getAttribute('data-commit-count');
        await page.evaluate(() => {
            const target = document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]');
            for (let index = 0; index < 20; index += 1) {
                target?.click();
            }
        });
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        console.log(
            `20 rapid clicks moved the commit counter from ${String(rapidStart)} to ${String(await page.locator('.stage').getAttribute('data-commit-count'))}`,
        );

        const structure = await page.evaluate(() => ({
            liveRegions: document.querySelectorAll('[aria-live]').length,
            headings: [...document.querySelectorAll('h1, h2, h3')].map((node) => `${node.tagName}:${node.textContent?.trim().slice(0, 16) ?? ''}`),
            landmarks: document.querySelectorAll('header, main, nav, section').length,
            navCurrent: document.querySelector('[aria-current="page"]')?.textContent?.trim() ?? null,
            stageTextNodes: document.querySelectorAll('.stage-text').length,
            totalElements: document.querySelectorAll('*').length,
        }));
        console.log(`hall structure: ${JSON.stringify(structure, null, 1)}`);

        // --- responsive probe -------------------------------------------------------
        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('/');
            await roomReady(page);
            console.log(
                `viewport ${String(width)}px hall: overflow ${String(await overflow(page))}px / smallest target ${String(await smallestTarget(page))}px / stage font ${String((await passageMetrics(page)).fontSize)}px`,
            );
            await page.goto('/books');
            await roomReady(page);
            console.log(
                `viewport ${String(width)}px books: overflow ${String(await overflow(page))}px / smallest target ${String(await smallestTarget(page))}px`,
            );
            await page.goto('/books/b-013');
            await roomReady(page);
            console.log(
                `viewport ${String(width)}px longest book room: overflow ${String(await overflow(page))}px / passage font ${String((await passageMetrics(page, '.book-random-text')).fontSize)}px`,
            );
            if (width === 390) {
                await page.screenshot({ path: join(OUT_DIR, 'book-room-longest-390.png'), fullPage: true });
                await page.goto('/');
                await roomReady(page);
                await page.screenshot({ path: join(OUT_DIR, 'hall-390.png'), fullPage: true });
                await page.goto('/themes');
                await roomReady(page);
                await page.screenshot({ path: join(OUT_DIR, 'themes-390.png'), fullPage: true });
                await page.goto('/books');
                await roomReady(page);
                await page.screenshot({ path: join(OUT_DIR, 'books-390.png'), fullPage: true });
            }
        }

        // --- reduced motion --------------------------------------------------------
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await roomReady(page);
        const reducedMotion = await page.evaluate(() => ({
            roomAnimation: window.getComputedStyle(document.querySelector('.room') as Element).animationDuration,
            auraAnimation: window.getComputedStyle(document.querySelector('.room-aura-tint') as Element).animationDuration,
            auraOpacity: window.getComputedStyle(document.querySelector('.room-aura-tint') as Element).opacity,
            roomTransform: window.getComputedStyle(document.querySelector('.room') as Element).transform,
        }));
        console.log(`reduced motion styles: ${JSON.stringify(reducedMotion)}`);
        const beforeText = await page.getByTestId('stage-passage').innerText();
        const motionStart = Date.now();
        await page.getByTestId('next-quote').click();
        await page.waitForFunction(
            (previous) => document.querySelector('[data-testid="stage-passage"]')?.textContent?.trim() !== previous.trim(),
            beforeText,
            { timeout: 2000 },
        );
        console.log(`reduced motion commit: ${String(Date.now() - motionStart)}ms, phases skipped`);
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
        console.log(`reduced motion aura: ${JSON.stringify(await auraInfo(page))}`);

        console.log(`highlights in snapshot: ${String(highlights.length)}`);
        console.log(`screenshots written to ${OUT_DIR}`);
    });
});
