import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
const folder = process.env.SITE_FINISH_EVIDENCE ?? '.private/review/site-finish/after';
mkdirSync(folder, { recursive: true });
const roomPath = (name: string, scope: unknown) => scope === 'public' ? `/henrys-reading-world/${name}/` : `/${name}`;

for (const width of [1440, 390, 320, 720]) test(`three readable introduction pages at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const [room, title, nav] of [['about', '关于', '关于本站'], ['design', '这个网站怎么运作', '阅读方式'], ['design/technical', '技术实现', '实现细节']]) {
        const response = await page.goto(roomPath(room!, info.project.metadata.scope));
        expect(response?.status()).toBe(200);
        await expect(page.getByTestId('room-heading')).toHaveText(title!);
        await expect(page.getByRole('navigation', { name: '网站介绍', exact: true }).getByRole('link', { name: nav! })).toHaveAttribute('aria-current', 'page');
        await expect(page.getByTestId('nav-about')).toHaveAttribute('aria-current', 'page');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        if (room !== 'about') {
            const styles = await page.locator('.design-section p').first().evaluate(el => ({ size: parseFloat(getComputedStyle(el).fontSize), line: parseFloat(getComputedStyle(el).lineHeight) }));
            expect(styles.size).toBeGreaterThanOrEqual(16); expect(styles.line / styles.size).toBeGreaterThanOrEqual(1.8);
        }
        if (width !== 720) await page.screenshot({ path: `${folder}/${info.project.name}-${room!.replaceAll('/', '-')}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
});

test('scope, live features and map explanation agree, and secondary navigation works by keyboard', async ({ page }, info) => {
    const local = info.project.metadata.scope === 'local';
    await page.goto(roomPath('about', info.project.metadata.scope));
    await expect(page.getByTestId('about-map-note')).toContainText(local ? '你现在看到的是本机阅读范围' : '你现在看到的是单独审核过的公开内容');
    const nav = page.getByRole('navigation', { name: '网站介绍', exact: true });
    const readingLink = nav.getByRole('link', { name: '阅读方式' });
    await readingLink.focus(); await expect(readingLink).toBeFocused(); await readingLink.press('Enter');
    await expect(page.getByTestId('room-heading')).toHaveText('这个网站怎么运作');
    const article = page.locator('[data-room="design"]');
    await expect(article).toContainText('河流让几处文字持续经过');
    const technicalLink = nav.getByRole('link', { name: '实现细节' });
    await technicalLink.focus(); await expect(technicalLink).toBeFocused(); await technicalLink.press('Enter');
    await expect(page.locator('[data-room="technical"]')).toHaveAttribute('data-explained-map', 'exact-neighbors');
    await expect(page.getByRole('heading', { name: '流动的预览，稳定的原文' })).toBeVisible();
    await page.reload(); await expect(page.getByTestId('room-heading')).toHaveText('技术实现');
    await page.getByRole('link', { name: '返回网站说明', exact: true }).click();
    await expect(page.getByTestId('room-heading')).toHaveText('这个网站怎么运作');
});

test('SVG and generated fallbacks resolve from a deep static entry', async ({ page, request }, info) => {
    await page.goto(roomPath('design/technical', info.project.metadata.scope));
    await expect(page.getByTestId('room-heading')).toHaveText('技术实现');
    const prefix = info.project.metadata.scope === 'public' ? '/henrys-reading-world/' : '/';
    for (const [selector, file] of [['link[rel="icon"][type="image/svg+xml"]', 'favicon.svg'], ['link[rel="icon"][type="image/png"]', 'favicon-32.png'], ['link[rel="apple-touch-icon"]', 'apple-touch-icon.png']]) {
        const url = await page.locator(selector!).evaluate(el => (el as HTMLLinkElement).href);
        expect(new URL(url).pathname).toBe(prefix + file);
        expect(new URL(url).search).toBe('?v=water-1');
        const response = await request.get(url); expect(response.status()).toBe(200);
        expect(await response.body()).toEqual(readFileSync('public/' + file));
    }
});
