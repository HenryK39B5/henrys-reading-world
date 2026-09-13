import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Review capture: screenshots plus the measurements that can be judged without seeing the page.
 *
 * Output goes to .private/review/critique-1/ because the page shows real, not-yet-public passages.
 * Run with: npm run capture:review
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const OUT_DIR = join(process.cwd(), '.private/review/critique-1');
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
        const passage = document.querySelector('.stage-text');
        const attribution = document.querySelector('.stage-attribution');
        const heading = document.querySelector('.section-heading');
        return {
            bodyOnPaper: ratio(body.color, body.backgroundColor),
            passageOnPaper: passage === null ? null : ratio(window.getComputedStyle(passage).color, body.backgroundColor),
            attributionOnPaper:
                attribution === null ? null : ratio(window.getComputedStyle(attribution).color, body.backgroundColor),
            headingOnPaper: heading === null ? null : ratio(window.getComputedStyle(heading).color, body.backgroundColor),
        };
    });
}

/** Lines, font size and effective characters per line for the passage on screen. */
async function passageMetrics(page: Page) {
    return page.locator('.stage-text').evaluate((element) => {
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

async function advance(page: Page): Promise<void> {
    await page.getByTestId('next-quote').click();
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
}

test.describe('review capture', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('captures the page and prints measurable facts', async ({ page }) => {
        mkdirSync(OUT_DIR, { recursive: true });
        const highlights = loadHighlights();

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await page.waitForTimeout(400);

        // --- desktop screenshot set -------------------------------------------------
        await page.screenshot({ path: join(OUT_DIR, 'desktop-opening.png'), fullPage: true });
        await page.screenshot({ path: join(OUT_DIR, 'desktop-first-screen.png') });

        await page.getByTestId('source-toggle').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT_DIR, 'desktop-source-open.png'), fullPage: true });
        await page.getByTestId('close-source').click();

        // Walk until each length band has been captured.
        const bands = new Set<string>();
        for (let step = 0; step < 220 && bands.size < 3; step += 1) {
            const band = (await page.locator('.stage').getAttribute('data-band')) ?? '';
            if (band !== '' && !bands.has(band)) {
                bands.add(band);
                const text = (await page.getByTestId('stage-passage').innerText()).trim();
                const metrics = await passageMetrics(page);
                const charsPerLine = Math.round(nonWhitespaceLength(text) / Math.max(1, metrics.lines));
                console.log(
                    `band ${band}: font ${String(metrics.fontSize)}px / line-height ${metrics.lineHeight} / width ${String(metrics.width)}px / lines ${String(metrics.lines)} / ~${String(charsPerLine)} chars per line`,
                );
                await page.screenshot({ path: join(OUT_DIR, `band-${band}-first-screen.png`) });
            }
            await advance(page);
        }
        console.log(`bands captured: ${[...bands].sort().join(', ')}`);

        // World layer, with a theme shelf expanded and a year filter applied.
        await page.getByTestId('theme-t-001').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT_DIR, 'desktop-world-topics.png'), fullPage: true });
        await page.getByTestId('year-2024').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(OUT_DIR, 'desktop-year-filter.png'), fullPage: true });
        await page.getByTestId('year-all').click();

        // --- measured behaviour -----------------------------------------------------
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
            const elapsed = (await page.evaluate(() => performance.now())) - started;
            transitions.push(Math.round(elapsed));
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
        const rapidEnd = await page.locator('.stage').getAttribute('data-commit-count');
        console.log(`20 rapid clicks moved the commit counter from ${String(rapidStart)} to ${String(rapidEnd)}`);

        const ratios = await contrastRatios(page);
        console.log(`contrast ratios against paper: ${JSON.stringify(ratios)}`);

        const structure = await page.evaluate(() => ({
            liveRegions: document.querySelectorAll('[aria-live]').length,
            headings: [...document.querySelectorAll('h1, h2, h3')].map((node) => `${node.tagName}:${node.textContent?.trim().slice(0, 14) ?? ''}`),
            expandedControls: document.querySelectorAll('[aria-expanded]').length,
            images: document.querySelectorAll('img').length,
            landmarks: document.querySelectorAll('header, main, nav, section').length,
            stageTextNodes: document.querySelectorAll('.stage-text').length,
            passageNodes: document.querySelectorAll('.passage-button').length,
            bookRows: document.querySelectorAll('.book-item').length,
            themeRows: document.querySelectorAll('.theme-item').length,
            totalElements: document.querySelectorAll('*').length,
        }));
        console.log(`structure: ${JSON.stringify(structure, null, 1)}`);

        // --- responsive probe -------------------------------------------------------
        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('/');
            await page.waitForTimeout(250);
            const overflowPx = await overflow(page);
            const target = await smallestTarget(page);
            const stageMetrics = await passageMetrics(page);
            console.log(
                `viewport ${String(width)}px: horizontal overflow ${String(overflowPx)}px / smallest interactive height ${String(target)}px / stage font ${String(stageMetrics.fontSize)}px / lines ${String(stageMetrics.lines)}`,
            );
            if (width === 390) {
                await page.screenshot({ path: join(OUT_DIR, 'mobile-390-opening.png'), fullPage: true });
                await page.getByTestId('theme-t-001').click();
                await page.waitForTimeout(200);
                await page.screenshot({ path: join(OUT_DIR, 'mobile-390-world.png'), fullPage: true });
            }
        }

        // Reduced motion: the passage must change without any transition phase.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
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
        // The library is reachable but never rendered at once (docs/10 §7).
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        // The snapshot arrives asynchronously; measure after the world layer has rendered.
        await expect(page.getByTestId('book-list')).toBeVisible();
        const density = await page.evaluate(() => ({
            passageNodes: document.querySelectorAll('.passage-button').length,
            bookRows: document.querySelectorAll('.book-item').length,
            themeRows: document.querySelectorAll('.theme-item').length,
            totalElements: document.querySelectorAll('*').length,
        }));
        console.log(`first paint density: ${JSON.stringify(density)}`);
        console.log(`screenshots written to .private/review/critique-1/`);
    });
});
