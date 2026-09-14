import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { initialPublicationPolicy, setBookDecision, toggleCover, toggleHighlightExclusion } from '../../src/domain/publication.ts';
import type { Snapshot } from '../../src/domain/types.ts';

/**
 * Release-A evidence on the reviewer side (docs/18 §6.3).
 *
 * The policy it writes goes to the capture's own directory, so the shots can show a *mixed* review —
 * some books published, one excluded, one with a single passage held back, one with its cover closed —
 * without touching the file a person is working in.
 */
const OUT_DIR = join(process.cwd(), '.private/review/release-a');
const POLICY_DIR = join(process.cwd(), '.private/review/release-a/capture-policy');
const POLICY_PATH = join(POLICY_DIR, 'publication-policy.json');

async function settle(page: Page): Promise<void> {
    await page.waitForTimeout(250);
}

async function shot(page: Page, name: string): Promise<void> {
    await settle(page);
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false, animations: 'disabled' });
}

test.afterAll(() => {
    rmSync(POLICY_DIR, { recursive: true, force: true });
});

test.describe('Release-A reviewer evidence', () => {
    test('overview, an opened book, an excluded passage and a mixed review', async ({ page }) => {
        test.setTimeout(180_000);
        mkdirSync(OUT_DIR, { recursive: true });
        mkdirSync(POLICY_DIR, { recursive: true });
        const snapshot = JSON.parse(
            readFileSync(join(process.cwd(), '.private/local-snapshot.json'), 'utf8'),
        ) as Snapshot;

        const published = snapshot.books.slice(0, 4);
        const excluded = snapshot.books[5];
        expect(published.length).toBe(4);
        expect(excluded).toBeDefined();
        if (excluded === undefined) {
            return;
        }
        let policy = initialPublicationPolicy(snapshot);
        for (const book of published) {
            policy = setBookDecision(policy, book.id, 'publish');
        }
        policy = setBookDecision(policy, excluded.id, 'exclude');
        // One book with its cover closed, and one passage held back from a published book.
        const first = published[0];
        expect(first).toBeDefined();
        if (first === undefined) {
            return;
        }
        policy = toggleCover(policy, first.id);
        const heldBack = snapshot.highlights.find((highlight) => highlight.bookId === first.id);
        expect(heldBack).toBeDefined();
        if (heldBack === undefined) {
            return;
        }
        policy = toggleHighlightExclusion(policy, first.id, heldBack.id);
        writeFileSync(POLICY_PATH, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');

        // ---- the overview at desk width ----
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/publication-review.html');
        await expect(page.getByTestId('review')).toBeVisible();
        console.log(`review summary: ${await page.getByTestId('review-summary').innerText()}`);
        await shot(page, 'review-overview-1440');

        // ---- the filters, which are how a half-finished review is used ----------------
        await page.getByTestId('filter-publish').click();
        await expect(page.getByTestId('review-row-count')).toContainText(`显示 ${String(published.length)} 本`);
        console.log(`published filter: ${await page.getByTestId('review-row-count').innerText()}`);
        await shot(page, 'review-progress-mixed');
        const stillToDo = snapshot.books.length - published.length - 1;
        await page.getByTestId('filter-unreviewed').click();
        await expect(page.getByTestId('review-row-count')).toContainText(`显示 ${String(stillToDo)} 本`);
        console.log(`unreviewed filter: ${await page.getByTestId('review-row-count').innerText()}`);
        await page.getByTestId('filter-all').click();

        // ---- one book opened, with its real passages and the held-back one marked ----
        await page.getByTestId('review-search').fill(first.title);
        await page.getByTestId(`expand-${first.id}`).click();
        await expect(page.getByTestId(`passages-${first.id}`)).toBeVisible();
        await expect(page.getByTestId(`exclude-${heldBack.id}`)).toBeChecked();
        console.log(`opened book ${first.id}: ${String(snapshot.highlights.filter((item) => item.bookId === first.id).length)} real passages`);
        await shot(page, 'review-book-open-1440');

        // ---- the exclusion itself: the row is marked, not hidden away ----------------
        const row = page.getByTestId(`passages-${first.id}`).locator(`li:has([data-testid="exclude-${heldBack.id}"])`);
        await expect(row).toHaveAttribute('data-excluded', 'true');
        console.log(`excluded passage ${heldBack.id}: marked in place, not hidden`);
        // An element shot: the whole-screen view of this row is already `review-book-open-1440`.
        await settle(page);
        await row.screenshot({ path: join(OUT_DIR, 'review-highlight-excluded.png'), animations: 'disabled' });

        // ---- and the same screen at phone width ----
        await page.setViewportSize({ width: 390, height: 900 });
        await page.getByTestId('review-search').fill('');
        await expect(page.getByTestId('review')).toBeVisible();
        await shot(page, 'review-overview-390');
    });
});

test.afterAll(() => {
    console.log(`Release-A reviewer evidence written to ${OUT_DIR}`);
});
