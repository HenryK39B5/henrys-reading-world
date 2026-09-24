import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Snapshot } from '../src/domain/types.ts';

const snapshot = JSON.parse(readFileSync(join(process.cwd(), 'src/data/public-snapshot.json'), 'utf8')) as Snapshot;

test.describe('non-empty public release', () => {
    test('the public hall renders approved real content without a local badge', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await expect(page.getByTestId('source-toggle')).toBeVisible();
        await expect(page.getByText('仅本机 · 未公开审核')).toHaveCount(0);
        await expect(page.getByText('本机链接')).toHaveCount(0);
    });

    test('the public library and themes expose the approved collection', async ({ page }) => {
        await page.goto('/books');
        await expect(page.getByTestId('room-heading')).toHaveText('所有书');
        await expect(page.getByTestId('book-list').locator('li').first()).toBeVisible();
        await page.goto('/themes');
        await expect(page.getByTestId('room-heading')).toHaveText('主题书架');
        await expect(page.getByTestId('theme-list').locator('li').first()).toBeVisible();
    });

    test('the public site explains its navigation, model boundary and publication scope', async ({ page }) => {
        await page.goto('/about');
        await page.getByTestId('about-design-link').click();
        await expect(page).toHaveURL('/design');
        await expect(page.getByTestId('room-heading')).toHaveText('这个网站怎么运作');
        await expect(page.locator('[data-room="design"]')).toContainText('未标注的句子仍然参与整体地形');
        await expect(page.locator('[data-room="design"]')).toContainText('公开版的完整收录内容仍会被下载');
        await expect(page.getByText('仅本机 · 未公开审核')).toHaveCount(0);
    });

    test('a public book room has a real passage and no private mode marker', async ({ page }) => {
        const book = snapshot.books[0];
        expect(book).toBeDefined();
        if (book === undefined) return;
        await page.goto(`/books/${encodeURIComponent(book.id)}`);
        await expect(page.getByTestId('book-random-text')).toBeVisible();
        await expect(page.getByText('仅本机 · 未公开审核')).toHaveCount(0);
    });

    test('the public map renders the approved point field and semantic list', async ({ page }) => {
        await page.goto('/map');
        await expect(page.getByTestId('room-heading')).toHaveText('阅读世界地图');
        await expect(page.getByTestId('map-canvas')).toBeVisible();
        await expect(page.locator('#map-region-list')).toBeVisible();
        await expect(page.getByText('仅本机 · 未公开审核')).toHaveCount(0);
    });

    test('a public share dialog carries a stable approved highlight link', async ({ page }) => {
        const highlight = snapshot.highlights[0];
        expect(highlight).toBeDefined();
        if (highlight === undefined) return;
        await page.goto(`/?h=${encodeURIComponent(highlight.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(highlight.text);
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await expect(page.getByTestId('share-local-hint')).toHaveCount(0);
        await expect(page.getByTestId('share-card-text')).toHaveText(highlight.text);
        await page.getByTestId('share-close').click();
    });

    test('excluded and unknown content remain unavailable in public mode', async ({ page }) => {
        await page.goto('/books/b-013');
        await expect(page.getByTestId('book-missing')).toBeVisible();
        await page.goto('/?h=h-1761');
        await expect(page.getByTestId('link-unavailable')).toBeVisible();
        await expect(page.getByTestId('stage-passage')).toBeVisible();
    });
});
