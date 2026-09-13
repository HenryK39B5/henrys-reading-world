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
        const ratio = (foreground: string, background: string) => {
            const first = luminance(parse(foreground));
            const second = luminance(parse(background));
            const lighter = Math.max(first, second);
            const darker = Math.min(first, second);
            return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
        };
        const body = window.getComputedStyle(document.body);
        const background = body.backgroundColor;
        const passage = document.querySelector('.stage-text');
        const attribution = document.querySelector('.stage-attribution');
        const heading = document.querySelector('.room-heading');
        const note = document.querySelector('.room-note');
        const link = document.querySelector('.room-exit');
        return {
            bodyOnPaper: ratio(body.color, background),
            passageOnPaper: passage === null ? null : ratio(window.getComputedStyle(passage).color, background),
            attributionOnPaper:
                attribution === null ? null : ratio(window.getComputedStyle(attribution).color, background),
            headingOnPaper: heading === null ? null : ratio(window.getComputedStyle(heading).color, background),
            noteOnPaper: note === null ? null : ratio(window.getComputedStyle(note).color, background),
            exitOnPaper: link === null ? null : ratio(window.getComputedStyle(link).color, background),
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
        // A deliberate, thorough review walk: every room, four viewports, motion preferences.
        test.setTimeout(240_000);
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
        console.log(`hall density: ${JSON.stringify(await density(page))}`);
        console.log(`hall contrast: ${JSON.stringify(await contrastRatios(page))}`);

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
        await page.getByTestId('source-toggle').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT_DIR, 'theme-room-source-1440.png'), fullPage: true });
        await page.getByTestId('close-source').click();

        await page.goto('/books');
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'books-1440.png'), fullPage: true });
        console.log(`books density: ${JSON.stringify(await density(page))}`);
        console.log(`books batch label: ${await page.getByTestId('books-batch-label').innerText()}`);

        await page.getByTestId('book-list').locator('a.book-link').first().click();
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'book-room-1440.png'), fullPage: true });
        console.log(`book room heading: ${await page.getByTestId('room-heading').innerText()}`);
        console.log(`book room batch label: ${await page.getByTestId('book-batch-label').innerText()}`);
        console.log(`book room density: ${JSON.stringify(await density(page))}`);
        console.log(`book room contrast: ${JSON.stringify(await contrastRatios(page))}`);

        await page.goto('/about');
        await roomReady(page);
        await page.screenshot({ path: join(OUT_DIR, 'about-1440.png'), fullPage: true });

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

        console.log(`highlights in snapshot: ${String(highlights.length)}`);
        console.log(`screenshots written to ${OUT_DIR}`);
    });
});
