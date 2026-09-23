import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('7I local failure and route stability', () => {
    test.skip(!hasSnapshot, 'the stability matrix needs the real local snapshot');

    test('a local snapshot failure keeps navigation and explains the state', async ({ page }) => {
        await page.route('**/__local_snapshot', async (route) => {
            await route.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' });
        });
        await page.goto('/map');
        await expect(page.getByRole('heading', { name: '数据无法加载' })).toBeVisible();
        await expect(page.getByText('本地快照不可用')).toBeVisible();
        await expect(page.getByTestId('nav-hall')).toBeVisible();
        await expect(page.getByTestId('nav-map')).toBeVisible();
        await page.getByTestId('nav-books').click();
        await expect(page.getByTestId('nav-books')).toHaveAttribute('aria-current', 'page');
        await expect(page.getByRole('heading', { name: '数据无法加载' })).toBeVisible();
    });

    test('unknown routes stay escapable and canonical query noise is dropped', async ({ page }) => {
        await page.goto('/not-a-real-room/unknown-segment');
        await expect(page.getByTestId('room-heading')).toHaveText('这里没有房间');
        await expect(page.getByTestId('exit-hall')).toBeVisible();
        await page.goto('/books/b-013?year=1998&theme=t-001');
        await expect(page.getByTestId('book-random-text')).toBeVisible();
        await expect.poll(() => new URL(page.url()).search).toBe('');
        await page.goto('/map?tag=tag-does-not-exist&book=b-does-not-exist&h=h-does-not-exist');
        await expect(page.getByText('地址中的某个地图选择不在当前收录范围')).toBeVisible();
        await expect(page.getByTestId('map-canvas')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });

    test('share links use the stable real highlight id and preserve full text', async ({ page }) => {
        const data = loadSnapshot();
        const highlight = data.highlights.find((item) => item.id === 'h-013');
        expect(highlight).toBeDefined();
        if (highlight === undefined) return;
        await page.goto(`/?h=${encodeURIComponent(highlight.id)}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(highlight.text);
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-card-text')).toHaveText(highlight.text);
        await page.getByTestId('share-copy-link').click();
        await expect(page.getByTestId('share-status')).toHaveText(/已复制|自动复制失败/u);
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toContain(`h=${highlight.id}`);
        await page.getByTestId('share-close').click();
        await expect(page.getByTestId('share-open')).toBeFocused();
    });
});
