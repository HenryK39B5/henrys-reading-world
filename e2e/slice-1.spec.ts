import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 1 browser acceptance: quote stage, three length bands, transition feel and motion
 * preferences. The spec reads the private local snapshot to know the real expected order; it skips
 * when that file is absent (for example in a public-only checkout). No passage text is printed.
 */
type Highlight = { id: string; text: string; bookId: string; openingCandidate: boolean; standaloneReadable: boolean };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-1');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

function loadSnapshot(): { highlights: Highlight[]; titles: Map<string, string> } {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: { id: string; title: string }[];
    };
    return {
        highlights: parsed.highlights,
        titles: new Map(parsed.books.map((book) => [book.id, book.title])),
    };
}

function order(highlights: Highlight[]): Highlight[] {
    const opening = highlights.find((item) => item.openingCandidate && item.standaloneReadable) ?? highlights[0];
    if (opening === undefined) {
        return [];
    }
    const index = highlights.indexOf(opening);
    return [...highlights.slice(index), ...highlights.slice(0, index)];
}

function bandOf(text: string): 'short' | 'medium' | 'long' {
    const length = [...text].filter((char) => !/\s/u.test(char)).length;
    if (length <= 40) {
        return 'short';
    }
    if (length <= 120) {
        return 'medium';
    }
    return 'long';
}

async function shownText(page: Page): Promise<string> {
    return (await page.getByTestId('stage-passage').innerText()).trim();
}

test.describe('quote stage', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('renders the first committed passage with source, navigation and one action', async ({ page }) => {
        const { highlights, titles } = loadSnapshot();
        const expected = order(highlights)[0];
        expect(expected).toBeDefined();
        if (expected === undefined) {
            return;
        }

        await page.goto('/');
        await expect(page.getByRole('heading', { name: "Henry's Reading World", level: 1 })).toBeVisible();
        await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible();
        await expect(page.locator('.stage')).toHaveAttribute('data-band', bandOf(expected.text));
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
        expect(await shownText(page)).toBe(expected.text.trim());
        await expect(page.locator('.stage-book')).toHaveText(`《${titles.get(expected.bookId) ?? ''}》`);
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
    });

    test('advances exactly one passage for twenty rapid clicks and keeps focus', async ({ page }) => {
        const { highlights } = loadSnapshot();
        const sequence = order(highlights);
        const first = sequence[0];
        const second = sequence[1];
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        if (first === undefined || second === undefined) {
            return;
        }

        await page.goto('/');
        const button = page.getByTestId('next-quote');
        await button.focus();
        // All twenty clicks land in a single task, so none of them can start a second transition.
        await page.evaluate(() => {
            const target = document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]');
            for (let index = 0; index < 20; index += 1) {
                target?.click();
            }
        });

        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(button).toBeFocused();
        await expect(page.locator('.stage-text')).toHaveCount(1);
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });

        expect(await shownText(page)).toBe(second.text.trim());
        await expect(button).toHaveAttribute('aria-disabled', 'false');
        // The passage that was skipped by the guard must not appear later as a duplicate.
        expect(await shownText(page)).not.toBe(first.text.trim());
    });

    test('advances with keyboard activation', async ({ page }) => {
        const { highlights } = loadSnapshot();
        const sequence = order(highlights);
        const second = sequence[1];
        if (second === undefined) {
            return;
        }

        await page.goto('/');
        const button = page.getByTestId('next-quote');
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        expect(await shownText(page)).toBe(second.text.trim());
    });

    test('switches instantly when the visitor prefers reduced motion', async ({ page }) => {
        const { highlights } = loadSnapshot();
        const second = order(highlights)[1];
        if (second === undefined) {
            return;
        }

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        const started = Date.now();
        await page.getByTestId('next-quote').click();
        await expect(page.locator('.stage-text')).toHaveText(second.text.trim());
        expect(Date.now() - started).toBeLessThan(900);
        // Reduced motion never parks in the exiting phase.
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
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
        const { highlights } = loadSnapshot();
        const sequence = order(highlights);
        await page.goto('/');

        const seen = new Set<string>();
        for (let step = 0; step < sequence.length + 4 && seen.size < 3; step += 1) {
            const band = (await page.locator('.stage').getAttribute('data-band')) ?? '';
            if (band !== '' && !seen.has(band)) {
                seen.add(band);
                const text = await page.locator('.stage-text').innerText();
                const metrics = await page.locator('.stage-text').evaluate((element) => {
                    const style = window.getComputedStyle(element);
                    return {
                        fontSize: Number.parseFloat(style.fontSize),
                        lineHeight: style.lineHeight,
                        whiteSpace: style.whiteSpace,
                        overflow: style.overflow,
                        scrollWidth: element.scrollWidth,
                        clientWidth: element.clientWidth,
                    };
                });

                // The original passage is rendered in full, never clipped or truncated.
                expect(metrics.overflow).not.toBe('hidden');
                expect(metrics.whiteSpace).toBe('pre-wrap');
                expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
                expect(metrics.fontSize).toBeGreaterThanOrEqual(band === 'long' ? 19.5 : 23.5);
                expect(text.trim().length).toBeGreaterThan(0);

                const overflow = await page.evaluate(
                    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
                );
                expect(overflow).toBeLessThanOrEqual(1);

                await page.screenshot({ path: join(REVIEW_DIR, `band-${band}-1440.png`), fullPage: true });
            }
            await page.getByTestId('next-quote').click();
            await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        }

        expect([...seen].sort()).toEqual(['long', 'medium', 'short']);
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

        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await expect(page.locator('.stage-text')).toBeVisible();
        await page.screenshot({ path: join(REVIEW_DIR, 'mobile-390.png'), fullPage: true });
    });
});
