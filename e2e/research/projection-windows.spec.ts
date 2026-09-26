import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const directory = '.private/research/map/projection-window';
const data = JSON.parse(await readFile(`${directory}/viewer-data.json`, 'utf8')) as {
    inputSha256: string;
    cases: { id: string; tagId: string }[];
    views: { id: string; topic: string | null; alpha: number | null; theta: number | null }[];
};
const report = JSON.parse(await readFile(`${directory}/study.json`, 'utf8')) as {
    inputSha256: string;
    queries: { id: string; bySpace: { space: string; nearest60: { id: string }[] }[] }[];
};
if (data.inputSha256 !== report.inputSha256) throw new Error('research inputs do not agree');
const out = `${directory}/screenshots`;
await mkdir(out, { recursive: true });

for (const width of [1440, 390, 320]) {
    test(`${width}: true projections, stable ID, pixels, keyboard and paired evidence`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = [];
        const external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5200/')) external.push(request.url()); });
        await page.goto('/');
        await expect(page.locator('#selected-id')).toHaveText('h-3501');
        await expect(page.locator('#corpus')).toHaveText('3,462 条 / 108 本');
        await page.screenshot({ path: `${out}/published-page-${width}.png`, fullPage: true });
        const evidence: unknown[] = [];
        const state = () => page.evaluate(() => (window as unknown as { __projectionStudy: { state: Record<string, unknown> } }).__projectionStudy.state);
        for (const view of data.views) {
            const mode = view.id.startsWith('cpca1024') ? 'cpca1024' : view.id.startsWith('cpca-') ? 'cpca' : view.id.startsWith('pca-') ? 'pca' : view.id;
            await page.locator('#window').selectOption(mode);
            if (view.topic !== null) await page.locator('#topic').selectOption(view.topic);
            if (mode === 'cpca') await page.locator('#alpha').selectOption(String(view.alpha));
            if (mode === 'pca') await page.locator('#angle').evaluate((element, theta) => {
                const slider = element as HTMLInputElement; slider.value = String(theta); slider.dispatchEvent(new Event('input', { bubbles: true }));
            }, view.theta);
            await expect.poll(async () => (await state()).viewId).toBe(view.id);
            await expect(page.locator('#selected-id')).toHaveText('h-3501');
            const pixel = await page.locator('#plot').evaluate((element) => {
                const canvas = element as HTMLCanvasElement;
                const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
                let colored = 0;
                for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 50 || pixels[i + 1]! > 60 || pixels[i + 2]! > 60) colored += 1;
                return { width: canvas.width, height: canvas.height, colored };
            });
            expect(pixel.colored).toBeGreaterThan(1500);
            const actual = await page.evaluate(() => (window as unknown as { __projectionStudy: { neighbors: { low: string[] } } }).__projectionStudy.neighbors.low);
            const expected = report.queries.find((q) => q.id === 'h-3501')!.bySpace.find((s) => s.space === view.id)!.nearest60.slice(0, 30).map((n) => n.id);
            expect(actual).toEqual(expected);
            await expect(page.locator('#text')).not.toBeEmpty();
            await page.locator('#plot').screenshot({ path: `${out}/${view.id}-${width}.png` });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            expect(overflow).toBe(false);
            evidence.push({ view: view.id, width, pixel, state: await state() });
        }
        for (const c of data.cases.filter((entry, i, list) => list.findIndex((other) => other.id === entry.id) === i)) {
            await page.locator('#query').selectOption(c.id);
            await page.locator('#topic').selectOption(c.tagId);
            for (const mode of ['published', 'cpca1024']) {
                await page.locator('#window').selectOption(mode);
                await expect(page.locator('#selected-id')).toHaveText(c.id);
                const view = mode === 'published' ? mode : `cpca1024-${c.tagId}-1`;
                const actual = await page.evaluate(() => (window as unknown as { __projectionStudy: { neighbors: { low: string[] } } }).__projectionStudy.neighbors.low);
                const expected = report.queries.find((q) => q.id === c.id)!.bySpace.find((s) => s.space === view)!.nearest60.slice(0, 30).map((n) => n.id);
                expect(actual).toEqual(expected);
                await page.locator('#plot').screenshot({ path: `${out}/case-${c.id}-${mode}-${width}.png` });
                evidence.push({ case: c.id, width, state: await state(), neighbors: actual });
                if (c.id === 'h-4504' && mode === 'cpca1024') await page.screenshot({ path: `${out}/class-education-page-${width}.png`, fullPage: true });
            }
        }
        await page.locator('#query').selectOption('h-3501');
        await page.locator('#topic').selectOption('tag-026');
        await page.locator('#window').selectOption('pca');
        await page.locator('#angle').focus();
        await page.locator('#angle').press('Home');
        const before = (await state()).selectedCoordinates;
        await page.locator('#angle').press('ArrowRight');
        expect((await state()).theta).toBe(1);
        expect((await state()).selectedCoordinates).not.toEqual(before);
        await page.locator('#angle').press('End');
        expect((await state()).theta).toBe(90);
        await page.locator('#angle').evaluate((element) => { const slider = element as HTMLInputElement; slider.value = '45'; slider.dispatchEvent(new Event('input', { bubbles: true })); });
        await expect(page.locator('#metric')).toContainText('未采样角度');
        await page.locator('#plot').screenshot({ path: `${out}/pca-45-${width}.png` });
        await page.getByRole('button', { name: '原视角', exact: true }).click();
        await expect.poll(async () => (await state()).viewId).toBe('published');
        await expect(page.locator('#selected-id')).toHaveText('h-3501');
        const canvas = page.locator('#plot');
        await canvas.focus(); await canvas.press('ArrowRight');
        expect((await state()).panX).toBe(20);
        await canvas.press('+'); expect((await state()).zoom).toBe(1.25);
        await page.getByRole('tab', { name: '原空间', exact: true }).focus();
        await page.getByRole('tab', { name: '原空间', exact: true }).press('ArrowRight');
        await expect(page.getByRole('tab', { name: '观察平面', exact: true })).toBeFocused();
        const neighbor = page.locator('.neighbor').first();
        const id = (await neighbor.getAttribute('aria-label'))!.split(' ')[0]!;
        await neighbor.focus(); await neighbor.press('Enter');
        await expect(page.locator('#selected-id')).toHaveText(id);
        await expect(page.locator('#selected-id')).toBeFocused();
        expect((await state()).pointCount).toBe(3462);
        expect(await page.locator('button').count()).toBeLessThan(20);
        expect(errors).toEqual([]); expect(external).toEqual([]);
        await writeFile(`${out}/evidence-${width}.json`, JSON.stringify({ inputSha256: data.inputSha256, width, evidence, pageErrors: errors, externalRequests: external }, null, 2) + '\n', 'utf8');
    });
}

test('pointer pan/wheel and genuine mobile tap preserve the selected original', async ({ page, browser }) => {
    await page.goto('/');
    await expect(page.locator('#selected-id')).toHaveText('h-3501');
    const state = () => page.evaluate(() => (window as unknown as { __projectionStudy: { state: { selected: string; panX: number; zoom: number } } }).__projectionStudy.state);
    const rect = (await page.locator('#plot').boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 50, rect.y + rect.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    expect((await state()).panX).toBe(50);
    await expect(page.locator('#selected-id')).toHaveText('h-3501');
    await page.mouse.wheel(0, -150);
    await expect.poll(async () => (await state()).zoom).toBeGreaterThan(1);
    await page.getByRole('button', { name: '原视角', exact: true }).click();
    expect((await state()).zoom).toBe(1);
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    try {
        const mobile = await context.newPage(); await mobile.goto('http://127.0.0.1:5200/');
        await expect(mobile.locator('#selected-id')).toHaveText('h-3501');
        await mobile.locator('#query').selectOption('h-898');
        await mobile.locator('#plot').scrollIntoViewIfNeeded();
        const box = (await mobile.locator('#plot').boundingBox())!;
        const xy = await mobile.evaluate(() => (window as unknown as { __projectionStudy: { state: { selectedScreen: number[] } } }).__projectionStudy.state.selectedScreen);
        await mobile.touchscreen.tap(box.x + xy[0]!, box.y + xy[1]!);
        await expect(mobile.locator('#selected-id')).toHaveText('h-898');
        await mobile.locator('#window').selectOption('cpca1024');
        await expect(mobile.locator('#selected-id')).toHaveText('h-898');
        await mobile.getByRole('button', { name: '原视角', exact: true }).click();
        await expect(mobile.locator('#selected-id')).toHaveText('h-898');
    } finally { await context.close(); }
});

test('read-only loopback whitelist exposes no vectors, reports or arbitrary project files', async ({ request }) => {
    const viewer = await request.get('/viewer-data.json'); expect(viewer.status()).toBe(200);
    const payload = await viewer.json() as { points: { pc4: number[]; tags: string[] }[] };
    expect(payload.points).toHaveLength(3462);
    expect(payload.points.every((p) => p.pc4.length === 4)).toBe(true);
    const raw = await viewer.text();
    expect(raw).not.toMatch(/"(?:values|vectors|textHash|eigenvalues|confidence|account|sourceBookId|sourceHighlightId|reviewReason)"/u);
    for (const path of ['/study.json', '/nearest-text-review.md', '/.private/local-snapshot.json', '/scripts/research/projectionWindows.ts', '/../../package.json', '/%2e%2e/%2e%2e/package.json']) expect((await request.get(path)).status()).toBe(404);
    expect((await request.post('/viewer-data.json', { data: {} })).status()).toBe(405);
    expect((await request.get('/viewer-data.json', { headers: { Origin: 'https://example.com' } })).status()).toBe(403);
    expect((await request.get('/', { headers: { Host: 'example.com:5200' } })).status()).toBe(403);
    expect(viewer.headers()['cache-control']).toBe('no-store');
});
