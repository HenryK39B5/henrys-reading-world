import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

/**
 * Release-A evidence on the product side (docs/18 §6.3).
 *
 * The book room's walk and the copied text's provenance are the two visitor-visible changes of Release-A,
 * so they are captured from the real `dev:local` server with real data. Output goes to
 * `.private/review/release-a/`, the directory the batch's own record points at.
 */
const OUT_DIR = join(process.cwd(), '.private/review/release-a');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Waits until the page has stopped moving on its own before anything is photographed. */
async function settle(page: Page): Promise<void> {
    for (let pass = 0; pass < 6; pass += 1) {
        const running = await page.evaluate(async () => {
            const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
            await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
            return animations.length;
        });
        if (running === 0) {
            break;
        }
    }
}

async function shot(page: Page, name: string): Promise<void> {
    await settle(page);
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false, animations: 'disabled' });
}

test.describe('Release-A evidence', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能采集真实证据');

    test('the book walk, its end, its restart, and the copied text', async ({ page }) => {
        test.setTimeout(180_000);
        mkdirSync(OUT_DIR, { recursive: true });
        const data = loadSnapshot();
        const biggest = data.biggestBookId ?? data.books[0]?.id;
        expect(biggest).toBeTruthy();
        if (biggest === undefined || biggest === null) {
            return;
        }

        // ---- a large book: one passage at a time, with the round's own progress ----
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`/books/${encodeURIComponent(biggest)}`);
        await expect(page.getByTestId('book-walk-progress')).toBeVisible();
        console.log(`book walk 1440: ${await page.getByTestId('book-walk-progress').innerText()}`);
        await shot(page, 'book-walk-1440');

        await page.setViewportSize({ width: 390, height: 844 });
        await shot(page, 'book-walk-390');
        await page.setViewportSize({ width: 1440, height: 900 });

        // ---- a whole round of a small real book: the end state, then an explicit new round ----
        const smallest = [...data.countByBook.entries()]
            .filter(([, count]) => count >= 2)
            .sort((left, right) => left[1] - right[1])[0];
        expect(smallest).toBeDefined();
        if (smallest === undefined) {
            return;
        }
        const [smallId, smallCount] = smallest;
        await page.goto(`/books/${encodeURIComponent(smallId)}`);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(smallCount)}`);
        for (let step = 1; step < smallCount; step += 1) {
            await page.getByTestId('book-random').click();
            await expect(page.getByTestId('book-walk-progress')).toHaveText(
                `本轮已看 ${String(step + 1)} / ${String(smallCount)}`,
            );
        }
        await expect(page.getByTestId('book-walk-complete')).toBeVisible();
        console.log(`book walk complete: ${await page.getByTestId('book-walk-complete').innerText()}`);
        await shot(page, 'book-walk-complete');

        await page.getByTestId('book-restart').click();
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(smallCount)}`);
        await expect(page.getByTestId('book-walk-complete')).toHaveCount(0);
        console.log('book walk restarted: a new round begins at 1');
        await shot(page, 'book-walk-restarted');

        // ---- the copied text's provenance, shown through the manual fallback ----
        // The fallback textarea carries exactly what `复制文字` writes, so it is the honest place to see
        // the two-paragraph format without pasting a real passage into a log.
        const clipboard = await page.context().newPage();
        await clipboard.addInitScript(() => {
            const api = navigator.clipboard;
            if (api !== undefined) {
                api.writeText = () => Promise.reject(new Error('denied'));
            }
        });
        await clipboard.setViewportSize({ width: 1440, height: 900 });
        await clipboard.goto('/');
        await expect(clipboard.getByTestId('stage-passage')).toBeVisible();
        await clipboard.getByTestId('share-open').click();
        await expect(clipboard.getByTestId('share-dialog')).toBeVisible();
        await clipboard.getByTestId('share-copy-text').click();
        await expect(clipboard.getByTestId('share-status')).toHaveText('自动复制失败，请手动复制');
        const fallback = await clipboard.getByTestId('share-manual').inputValue();
        const lines = fallback.split('\n');
        expect(lines.at(-1)).toBe("来自 Henry's Reading World");
        expect(lines.at(-2)).toBe('');
        console.log(`copied text: ${String(lines.length)} lines, provenance on its own paragraph`);
        // Scroll the fallback box to its end so the provenance line is inside the frame.
        await clipboard.getByTestId('share-manual').evaluate((node) => {
            node.scrollTop = node.scrollHeight;
        });
        await shot(clipboard, 'clipboard-provenance');
        await clipboard.close();
    });
});

test.afterAll(() => {
    console.log(`Release-A evidence written to ${OUT_DIR}`);
});
