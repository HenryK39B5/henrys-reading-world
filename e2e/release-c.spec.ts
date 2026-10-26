import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import type { Snapshot } from '../src/domain/types.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import { mapReadingWindow } from '../src/domain/mapReading.ts';
import { mapToScreen } from '../src/domain/map.ts';
const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const terrain = JSON.parse(readFileSync('src/data/public-map-terrain.json', 'utf8')) as { contours: { segments: number[][] }[] };
const index = indexSnapshot(snapshot), prefix = '/henrys-reading-world/';
const evidence = process.env.RELEASE_EVIDENCE ?? '.private/review/release-c/static'; mkdirSync(evidence, { recursive: true });
const evidenceByPage = new WeakMap<Page, { errors: string[]; requests: string[]; failed: string[] }>();
test.beforeEach(async ({ page }) => {
    const state = { errors: [] as string[], requests: [] as string[], failed: [] as string[] }; evidenceByPage.set(page, state);
    page.on('pageerror', e => state.errors.push(e.message)); page.on('request', r => state.requests.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) state.failed.push(`${r.status()} ${r.url()}`); });
});
test.afterEach(async ({ page }) => {
    const state = evidenceByPage.get(page)!;
    expect(state.errors).toEqual([]); expect(state.failed).toEqual([]);
    expect(state.requests.some(u => new URL(u).pathname.includes('/__'))).toBe(false);
    expect(state.requests.every(u => new URL(u).origin === new URL(page.url()).origin)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
for (const width of [1440, 390]) test(`approved single, river and tide work with stable share and return at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 980 }); await page.goto(prefix);
    await expect(page.getByTestId('browse-single')).toBeVisible();
    await expect(page.locator('.site-nav .nav-link')).toHaveText(['随便看看', '主题小径', '世界地图', '书架', '关于']);
    const original = await page.getByTestId('stage-passage').innerText(); expect(snapshot.highlights.some(h => h.text === original)).toBe(true);
    const id = new URL(page.url()).searchParams.get('h'); expect(snapshot.highlights.some(h => h.id === id)).toBe(true);
    for (const form of ['河流', '潮汐']) {
        await page.getByRole('button', { name: form, exact: true }).click();
        await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state', 'ready');
        await expect(page.locator('.play-original blockquote > p')).toHaveText(original);
        await expect(page.getByRole('button', { name: '沿这处流一会儿', exact: false })).toHaveCount(0);
        const pause = page.getByRole('button', { name: '暂停流动', exact: true });
        if (await pause.count()) await pause.click();
        await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-paused', 'true');
        await page.screenshot({ path: `${evidence}/${info.project.name}-${width}-${form === '河流' ? 'river' : 'tide'}-held.png` });
    }
    await page.reload(); await expect(page.locator('.play-original blockquote > p')).toHaveText(original);
    await page.getByRole('link', { name: '去这本书', exact: true }).click(); await expect(page).toHaveURL(/\/books\/b-\d+\/$/);
    await page.goBack(); await expect(page.locator('.play-original blockquote > p')).toHaveText(original);
    await page.getByRole('button', { name: '分享', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText(original);
    await page.keyboard.press('Escape');
    const pauseAgain = page.getByRole('button', { name: '暂停流动', exact: true }); if (await pauseAgain.count()) await pauseAgain.click();
    await page.getByRole('button', { name: '放回流中', exact: false }).click();
    await expect(page.locator('.play-original')).toBeHidden();
    await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning', '');
    const targets = page.locator('.text-flow-hit:visible'); await expect(targets).toHaveCount(width === 390 ? 4 : 7);
    const before = await page.locator('.text-flow-hit').evaluateAll(elements => elements.map(el => ({ id: (el as HTMLElement).dataset.highlightId, transform: (el as HTMLElement).style.transform })));
    await page.locator('.play-page-menu summary').click(); const button = page.locator('.play-page-strip button').nth(width === 390 ? 6 : 1);
    const selected = await button.getAttribute('data-highlight-id'); await button.click();
    const h = snapshot.highlights.find(h => h.id === selected)!; await expect(page.locator('.play-original blockquote > p')).toHaveText(h.text);
    for (const tag of h.tagIds) await expect(page.locator('.play-clues')).toContainText(index.tagsById.get(tag)!.title);
    const after = await page.locator('.text-flow-hit').evaluateAll(elements => elements.map(el => ({ id: (el as HTMLElement).dataset.highlightId, transform: (el as HTMLElement).style.transform })));
    expect(after.filter(p => p.id !== selected)).toEqual(before.filter(p => p.id !== selected));
    await page.getByRole('button', { name: '一句一句', exact: true }).click(); await expect(page.getByTestId('stage-passage')).toHaveText(h.text);
    await page.getByTestId('nav-books').click(); await expect(page.getByRole('navigation', { name: '书架浏览方式' })).toBeVisible();
    await page.getByRole('link', { name: '按书籍主题', exact: true }).click(); await expect(page).toHaveURL(/\/themes\/$/);
});

test('real topic scope survives draws and old local-only scope links cannot empty the public reader', async ({ page }) => {
    const tag = snapshot.tags.find(t => snapshot.highlights.filter(h => h.tagIds.includes(t.id)).length > 20)!;
    const members = snapshot.highlights.filter(h => h.tagIds.includes(tag.id)), h = members[0]!;
    await page.goto(`${prefix}?view=single&h=${h.id}&world=${tag.id}&anchor=h-231`);
    await expect(page.getByTestId('stage-passage')).toHaveText(h.text); await expect(page).not.toHaveURL(/anchor=/);
    for (let i = 0; i < 3; i++) {
        await page.locator('.browse-single .stage-actions button').first().click();
        await expect(page.locator('.browse-single .stage')).toHaveAttribute('data-phase', 'idle');
        expect(members.map(h => h.text)).toContain(await page.getByTestId('stage-passage').innerText());
    }
    await page.getByRole('button', { name: '潮汐', exact: true }).click(); await page.reload(); await expect(page).toHaveURL(new RegExp('world=' + tag.id));
    await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state', 'ready');
    await page.goto(prefix + '?h=h-1761'); await expect(page.getByTestId('link-unavailable')).toBeVisible();
    await expect(page.getByTestId('stage-passage')).toBeVisible();
});

for (const width of [1440, 390, 320]) test(`public-only map keeps originals, nearby comparison and actual coordinates at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(prefix + 'map/'); const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study', 'ready');
    await canvas.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${evidence}/${info.project.name}-${width}-map.png` });
    // Frozen approved coordinates, not the complete local map.
    const p = snapshot.map!.points.find(p => p.highlightId === 'h-4648')!;
    await page.evaluate(p => sessionStorage.setItem('reading-world:map:world-view:v1', JSON.stringify({ centerX: p.x, centerY: p.y, zoom: 3.4 })), p);
    await page.reload(); await expect(canvas).toHaveAttribute('data-map-zoom', '3.400'); await canvas.scrollIntoViewIfNeeded(); await canvas.focus(); await canvas.press('+');
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    const bounds = await canvas.boundingBox(); if (!bounds) throw Error('Missing real map');
    const view = { centerX: Number(await canvas.getAttribute('data-map-center-x')), centerY: Number(await canvas.getAttribute('data-map-center-y')), zoom: Number(await canvas.getAttribute('data-map-zoom')), scaleBasis: Number(await canvas.getAttribute('data-map-scale-basis')) };
    const first = mapReadingWindow(index, view, bounds.width, bounds.height).entries[0]!;
    await expect(page.locator('.map-reading-window > .map-reading-passage p')).toHaveText(first.highlight.text);
    await page.locator('.map-reading-books > li > button').first().click(); await expect(page.getByTestId('map-reading-comparison')).toBeVisible();
    const compared = await canvas.getAttribute('data-map-compare-highlight'), text = index.highlightsById.get(compared!)!.text;
    await expect(page.getByTestId('map-reading-comparison').locator('.map-reading-passage p')).toHaveText(text);
    await page.screenshot({ path: `${evidence}/${info.project.name}-${width}-compare.png` });
    await page.getByTestId('map-reading-comparison').locator('a.map-reading-focus').click(); await expect(page.locator('.map-detail-passage')).toHaveText(text);
    await page.getByRole('link', { name: '关闭划线详情，返回地图' }).click(); await expect(canvas).toHaveAttribute('data-map-compare-highlight', compared!);
    await page.evaluate(() => sessionStorage.removeItem('reading-world:map:world-view:v1'));
    await page.goto(prefix + 'map/?h=h-4504'); const point = snapshot.map!.points.find(p => p.highlightId === 'h-4504')!;
    await expect(canvas).toHaveAttribute('data-map-center-x', String(point.x)); await expect(canvas).toHaveAttribute('data-map-center-y', String(point.y));
    await expect(page.locator('.map-detail-passage')).toHaveText(index.highlightsById.get('h-4504')!.text);
});

test('map contour and point hover use the released geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 980 }); await page.goto(prefix + 'map/');
    const canvas = page.getByTestId('map-canvas'); await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study', 'ready'); await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox(); if (!box) throw Error('No map');
    const view = { centerX: Number(await canvas.getAttribute('data-map-center-x')), centerY: Number(await canvas.getAttribute('data-map-center-y')), zoom: 1, scaleBasis: Number(await canvas.getAttribute('data-map-scale-basis')) };
    let hit = false;
    for (const s of terrain.contours.flatMap(c => c.segments).slice(0, 100)) {
        const p = mapToScreen({ x: (s[0]! + s[2]!) / 2, y: (s[1]! + s[3]!) / 2 }, view, box.width, box.height);
        if (p.x < 20 || p.x > box.width - 20 || p.y < 20 || p.y > box.height - 20) continue;
        await page.mouse.move(box.x + p.x, box.y + p.y);
        if (await canvas.getAttribute('data-map-hover-contour') !== null) { hit = true; break; }
    }
    expect(hit).toBe(true);
    let hovered: string | null = null;
    for (const point of snapshot.map!.points.slice(0, 160)) {
        const p = mapToScreen(point, view, box.width, box.height);
        if (p.x < 20 || p.x > box.width - 20 || p.y < 20 || p.y > box.height - 20) continue;
        await page.mouse.move(box.x + p.x, box.y + p.y);
        hovered = await canvas.getAttribute('data-map-hover-point'); if (hovered !== null) break;
    }
    expect(hovered).not.toBeNull(); expect(index.highlightsById.has(hovered!)).toBe(true);
});

test('the delivered dataset equals the approved release and current explanations describe public features', async ({ page, request }) => {
    await page.goto(prefix + 'design/technical/'); await expect(page.getByTestId('room-heading')).toHaveText('技术实现');
    await expect(page.locator('[data-room="technical"]')).toHaveAttribute('data-explained-map', 'exact-neighbors');
    await expect(page.getByRole('heading', { name: '流动的预览，稳定的原文' })).toBeVisible();
    const asset = await page.locator('script[data-public-snapshot]').getAttribute('data-public-snapshot'); expect(asset).toBeTruthy();
    const result = await request.get(asset!); expect(result.status()).toBe(200); expect(await result.json()).toEqual(snapshot);
    for (const selector of ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="icon"][type="image/png"]', 'link[rel="apple-touch-icon"]']) {
        const href = await page.locator(selector).evaluate(el => (el as HTMLLinkElement).href); expect((await request.get(href)).status()).toBe(200);
    }
    await page.goto(prefix + '?view=tide'); await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state', 'ready');
    await page.locator('.play-notes summary').click(); await expect(page.locator('.play-notes')).not.toContainText('仅本机试行');
    await expect(page.locator('.play-notes')).not.toContainText('已发布第二版不变');
});

test('long approved original remains readable with Canvas fallback and reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => { const old = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) { if (type === '2d') return null; return old.call(this, type, ...args); } as typeof old; });
    const h = [...snapshot.highlights].sort((a, b) => b.text.length - a.text.length)[0]!;
    await page.goto(`${prefix}?view=tide&h=${h.id}`); await expect(page.locator('.play-original blockquote > p')).toHaveText(h.text);
    const body = page.locator('.play-reading-body'); await body.focus(); await body.press('End');
    await expect.poll(() => body.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
});
