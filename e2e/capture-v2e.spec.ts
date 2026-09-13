import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot, nonWhitespace } from './support/snapshot.ts';

/**
 * V2-E evidence: the dialog, the cards, 200% zoom, a refused clipboard and reduced motion.
 *
 * Output goes to .private/review/v2-e/ because these show real, not-yet-public passages.
 * Run with: npm run capture:v2e
 */
const OUT_DIR = join(process.cwd(), '.private/review/v2-e');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/**
 * A room animates in, so a screenshot taken too early shows an empty page.
 *
 * The wait is driven by the animations the page actually started rather than by a guessed duration, and
 * the capture then freezes any remaining CSS animation at its end state.
 */
async function shot(page: Page, name: string): Promise<void> {
    for (let pass = 0; pass < 4; pass += 1) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve(undefined);
                    });
                });
            });
        });
        const running = await page.evaluate(async () => {
            const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
            await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
            return animations.length;
        });
        if (running === 0) {
            break;
        }
    }
    await page.screenshot({
        path: join(OUT_DIR, `${name}.png`),
        fullPage: false,
        animations: 'disabled',
    });
}

async function openShare(page: Page, highlightId: string): Promise<void> {
    await page.goto(`/?h=${encodeURIComponent(highlightId)}`);
    await expect(page.getByTestId('stage-passage')).toBeVisible();
    await page.getByTestId('share-open').click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
}

test.describe('V2-E evidence', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能采集真实证据');

    test('dialog, cards, zoom, clipboard failure and reduced motion', async ({ page }) => {
        test.setTimeout(240_000);
        mkdirSync(OUT_DIR, { recursive: true });
        const data = loadSnapshot();
        const long299 = data.highlights.find((item) => nonWhitespace(item.text) === 299) ?? data.medium;

        // ---- 门厅 with the share control, at both widths ----
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await shot(page, 'hall-with-share-1440');

        // ---- 分享 dialog, desktop ----
        await openShare(page, data.medium.id);
        await shot(page, 'share-dialog-1440');

        // ---- 分享 dialog, phone ----
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await shot(page, 'share-dialog-390');

        // ---- the cards themselves: shortest, a medium one, the 299-character opening, the longest ----
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const [name, highlight] of [
            ['card-shortest', data.shortest],
            ['card-medium', data.medium],
            ['card-299', long299],
            ['card-longest', data.longest],
        ] as const) {
            await openShare(page, highlight.id);
            const card = await page.getByTestId('share-card').evaluate((node) => ({
                characters: node.textContent?.length ?? 0,
                extended: node.getAttribute('data-extended'),
                overflowY: node.scrollHeight - node.clientHeight,
                overflowX: node.scrollWidth - node.clientWidth,
            }));
            console.log(
                `${name}: ${String(nonWhitespace(highlight.text))} chars, extended=${String(card.extended)}, overflow=${String(card.overflowY)}/${String(card.overflowX)}`,
            );
            await shot(page, name);
        }

        // ---- 200% zoom equivalence, and the real magnified view ----
        await page.setViewportSize({ width: 720, height: 450 });
        await openShare(page, long299.id);
        await shot(page, 'zoom-200-dialog');
        await page.getByTestId('share-close').click();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await shot(page, 'zoom-200-hall');

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
        await shot(page, 'magnified-2x-hall');
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

        // ---- clipboard refused: the manual fallback ----
        const failure = await page.context().newPage();
        await failure.addInitScript(() => {
            const clipboard = navigator.clipboard;
            if (clipboard !== undefined) {
                clipboard.writeText = () => Promise.reject(new Error('denied'));
            }
        });
        await failure.setViewportSize({ width: 1440, height: 900 });
        await failure.goto('/');
        await expect(failure.getByTestId('stage-passage')).toBeVisible();
        await failure.getByTestId('share-open').click();
        await expect(failure.getByTestId('share-dialog')).toBeVisible();
        await failure.getByTestId('share-copy-text').click();
        await expect(failure.getByTestId('share-status')).toHaveText('自动复制失败，请手动复制');
        await shot(failure, 'clipboard-failure-1440');
        await failure.close();

        // ---- reduced motion: the room and its colour simply are there ----
        const calm = await page.context().newPage();
        await calm.emulateMedia({ reducedMotion: 'reduce' });
        await calm.setViewportSize({ width: 1440, height: 900 });
        await calm.goto('/');
        await expect(calm.getByTestId('stage-passage')).toBeVisible();
        await calm.getByTestId('share-open').click();
        await expect(calm.getByTestId('share-dialog')).toBeVisible();
        await shot(calm, 'reduced-motion-1440');
        await calm.close();

        // ---- the deep link itself: an unavailable id is stated, not hidden ----
        await page.goto('/?h=h-does-not-exist');
        await expect(page.getByTestId('link-unavailable')).toBeVisible();
        await shot(page, 'deep-link-unavailable-1440');
    });
});

test.afterAll(() => {
    console.log(`V2-E evidence written to ${OUT_DIR}`);
});
