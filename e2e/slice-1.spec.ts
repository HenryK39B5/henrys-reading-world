import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 1 browser acceptance: quote stage, three length bands, transition feel and motion
 * preferences.
 *
 * The spec reads the private local snapshot to check what is on screen against the real data, and
 * skips when that file is absent (public-only checkout). It never asserts a fixed passage order:
 * which passage appears is the curation engine's business (Slice 2).
 */
type Highlight = { id: string; text: string; bookId: string; openingCandidate: boolean; standaloneReadable: boolean };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-1');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = { highlights: Highlight[]; byText: Map<string, Highlight>; titles: Map<string, string> };

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: { id: string; title: string }[];
    };
    return {
        highlights: parsed.highlights,
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        titles: new Map(parsed.books.map((book) => [book.id, book.title])),
    };
}

function nonWhitespaceLength(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

function bandOf(text: string): 'short' | 'medium' | 'long' {
    const length = nonWhitespaceLength(text);
    return length <= 40 ? 'short' : length <= 120 ? 'medium' : 'long';
}

async function shownText(page: Page): Promise<string> {
    return (await page.getByTestId('stage-passage').innerText()).trim();
}

async function commitCount(page: Page): Promise<number> {
    const raw = await page.locator('.stage').getAttribute('data-commit-count');
    return Number(raw ?? '0');
}

async function waitIdle(page: Page): Promise<void> {
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
}

test.describe('quote stage', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('renders a real passage with its source, navigation and one action', async ({ page }) => {
        const { byText, titles } = loadSnapshot();

        await page.goto('/');
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
        await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible();
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');

        const text = await shownText(page);
        const record = byText.get(text);
        expect(record, 'the displayed passage must exist in the real snapshot').toBeDefined();
        if (record === undefined) {
            return;
        }

        // Typography band is derived from the real text, not from a fixed position in the list.
        await expect(page.locator('.stage')).toHaveAttribute('data-band', bandOf(record.text));
        await expect(page.locator('.stage-book')).toHaveText(`《${titles.get(record.bookId) ?? ''}》`);
        await expect(page.getByTestId('next-quote')).toBeVisible();
        await expect(page.getByTestId('next-quote')).toHaveAccessibleName(/再来一句/);
        // Exactly one passage is in the DOM: no stacked or duplicated text during transitions.
        await expect(page.locator('.stage-text')).toHaveCount(1);
    });

    test('does not advance on its own', async ({ page }) => {
        await page.goto('/');
        const before = await shownText(page);
        await page.waitForTimeout(1600);
        expect(await shownText(page)).toBe(before);
        expect(await commitCount(page)).toBe(0);
    });

    test('commits exactly one passage for twenty rapid clicks and keeps focus', async ({ page }) => {
        await page.goto('/');
        const button = page.getByTestId('next-quote');
        const before = await shownText(page);
        await button.focus();

        // All twenty clicks land in a single task, so none of them may start a second transition.
        await page.evaluate(() => {
            const target = document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]');
            for (let index = 0; index < 20; index += 1) {
                target?.click();
            }
        });

        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(button).toBeFocused();
        await expect(page.locator('.stage-text')).toHaveCount(1);
        await waitIdle(page);

        expect(await commitCount(page)).toBe(1);
        expect(await shownText(page)).not.toBe(before);
        await expect(button).toHaveAttribute('aria-disabled', 'false');
    });

    test('advances with keyboard activation', async ({ page }) => {
        await page.goto('/');
        const before = await shownText(page);
        const button = page.getByTestId('next-quote');
        await button.focus();
        await page.keyboard.press('Enter');
        await waitIdle(page);
        expect(await commitCount(page)).toBe(1);
        expect(await shownText(page)).not.toBe(before);
    });

    test('switches instantly when the visitor prefers reduced motion', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        const before = await shownText(page);
        const started = Date.now();
        await page.getByTestId('next-quote').click();
        await expect(page.getByTestId('stage-passage')).not.toHaveText(before);
        expect(Date.now() - started).toBeLessThan(900);
        // Reduced motion never parks in the exiting phase.
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
        expect(await commitCount(page)).toBe(1);
    });

    test('announces the change through a single polite live region', async ({ page }) => {
        await page.goto('/');
        const live = page.locator('.stage-live');
        await expect(live).toHaveAttribute('aria-live', 'polite');
        await expect(live).toHaveAttribute('aria-atomic', 'true');
        await expect(page.locator('[aria-live]')).toHaveCount(1);
    });
});

test.describe('length bands in a real browser', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('keeps every band readable and complete, and captures evidence', async ({ page }) => {
        const { byText } = loadSnapshot();
        // Reduced motion makes the walk through passages instant; typography is unaffected.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');

        const measured = new Map<string, number>();
        for (let step = 0; step < 220 && measured.size < 3; step += 1) {
            const band = (await page.locator('.stage').getAttribute('data-band')) ?? '';
            if (band !== '' && !measured.has(band)) {
                const text = await page.locator('.stage-text').innerText();
                const record = byText.get(text.trim());
                expect(record, 'displayed passage must be real data').toBeDefined();

                const metrics = await page.locator('.stage-text').evaluate((element) => {
                    const style = window.getComputedStyle(element);
                    return {
                        fontSize: Number.parseFloat(style.fontSize),
                        whiteSpace: style.whiteSpace,
                        overflow: style.overflow,
                        scrollWidth: element.scrollWidth,
                        clientWidth: element.clientWidth,
                    };
                });

                // The original passage is rendered in full: never clipped, truncated or ellipsised.
                expect(metrics.overflow).not.toBe('hidden');
                expect(metrics.whiteSpace).toBe('pre-wrap');
                expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
                expect(metrics.fontSize).toBeGreaterThanOrEqual(band === 'long' ? 19.5 : 23.5);

                const overflow = await page.evaluate(
                    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
                );
                expect(overflow).toBeLessThanOrEqual(1);

                measured.set(band, metrics.fontSize);
                await page.screenshot({ path: join(REVIEW_DIR, `band-${band}-1440.png`), fullPage: true });
            }
            await page.getByTestId('next-quote').click();
            await waitIdle(page);
        }

        expect([...measured.keys()].sort()).toEqual(['long', 'medium', 'short']);
    });

    test('stays usable at 320px and captures mobile evidence', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 760 });
        await page.goto('/');
        await expect(page.locator('.stage-text')).toBeVisible();

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);

        const buttonBox = await page.getByTestId('next-quote').boundingBox();
        expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

        // Every interactive target, not just the main control, meets the project's 44px touch target.
        const smallestTarget = await page.evaluate(() => {
            const targets = [...document.querySelectorAll('button, a[href]')].filter((node) => {
                const rect = node.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            return Math.round(
                targets.reduce((smallest, node) => Math.min(smallest, node.getBoundingClientRect().height), 999),
            );
        });
        expect(smallestTarget).toBeGreaterThanOrEqual(44);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await expect(page.locator('.stage-text')).toBeVisible();
        await page.screenshot({ path: join(REVIEW_DIR, 'mobile-390.png'), fullPage: true });
    });
});
