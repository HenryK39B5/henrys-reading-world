import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const folder = '.private/research/map/route-first';
const captureFolder = `${folder}/three-view/screenshots`;
const data = JSON.parse(await readFile(`${folder}/viewer-data.json`, 'utf8')) as { seeds: string[]; points: Record<string, { text: string; bookTitle: string; bookId: string }>;
    neighbors: Record<string, { id: string; score: number }[]>; publishedMap: { points: { highlightId: string; x: number; y: number }[]; contours: { segments: number[][] }[] } };
const spatial = JSON.parse(await readFile(`${folder}/spatial-trace.json`, 'utf8')) as { inputSha256: string; edges: { seedId: string; kind: string; stepIndex: number; toId: string; target2dRank: number; normalizedDistance: number }[] };
const study = JSON.parse(await readFile(`${folder}/study.json`, 'utf8')) as { snapshotSha256: string; parameters: { reviewIds: string[] } };
if (data.seeds.slice(0, 10).join('|') !== study.parameters.reviewIds.join('|') || data.seeds[10] !== 'h-043' || data.publishedMap.points.length !== 3462 || spatial.inputSha256 !== study.snapshotSha256) throw new Error('viewer inputs drifted');
await mkdir(captureFolder, { recursive: true });

test('route viewer is strictly local and read-only', async ({ request }) => {
    expect((await request.get('/.private/research/map/route-first/study.json')).status()).toBe(404);
    expect((await request.get('/answer-key.json')).status()).toBe(404);
    expect((await request.post('/viewer-data.json')).status()).toBe(405);
    expect((await request.get('/viewer-data.json', { headers: { Origin: 'https://remote.invalid' } })).status()).toBe(403);
    expect((await request.get('/viewer-data.json', { headers: { Host: 'remote.invalid' } })).status()).toBe(403);
    const payload = await request.get('/viewer-data.json');
    expect(payload.ok()).toBe(true);
    const raw = await payload.text();
    expect(raw).not.toContain('"values"');
    expect(raw).not.toContain('textHash');
    expect((await payload.json()).inputSha256).toBe(study.snapshotSha256);
});

for (const width of [1440, 720, 390, 320]) {
    test(`${width}: full original text, actual neighbor choices, backtracking, keyboard, no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = []; const external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5201/')) external.push(request.url()); });
        await page.goto('/');
        await expect(page.locator('#source')).toHaveText(data.points[data.seeds[0]!]!.bookTitle);
        await expect(page.locator('#atlas')).toBeHidden();
        await page.getByRole('radio', { name: '阅读＋地图' }).check();
        const state = () => page.evaluate(() => (window as unknown as { __routeStudy: { state: { trail: string[]; currentId: string; options: { band: string; id: string | null; rank: number | null }[] } } }).__routeStudy.state);
        let current = await state(); expect(current.trail).toEqual([data.seeds[0]]);
        expect(await page.locator('#text').textContent()).toBe(data.points[current.currentId]!.text);
        const atlasPixels = await page.locator('#atlas').evaluate((element) => {
            const canvas = element as HTMLCanvasElement; const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
            let visible = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) visible += 1;
            return visible;
        });
        expect(atlasPixels).toBeGreaterThan(1000);
        await expect(page.locator('#map-summary')).toContainText('起点已定位');
        await page.screenshot({ path: `${captureFolder}/crossroads-${width}.png`, fullPage: true });
        const choice = current.options.find((entry) => entry.id !== null);
        expect(choice).toBeTruthy();
        const rank = choice!.rank!;
        expect(data.neighbors[current.currentId]![rank - 1]!.id).toBe(choice!.id);
        expect(data.points[choice!.id!]!.bookId).not.toBe(data.points[current.currentId]!.bookId);
        const button = page.locator('#options button').first();
        await button.focus(); await button.press('Enter');
        current = await state();
        expect(current.currentId).toBe(choice!.id);
        expect(current.trail).toHaveLength(2);
        expect(await page.locator('#text').textContent()).toBe(data.points[choice!.id!]!.text);
        await expect(page.locator('#passage-title')).toBeFocused();
        expect(await page.locator('#passage-title').evaluate((node) => { const y = node.getBoundingClientRect(); return y.top >= 0 && y.top < innerHeight; })).toBe(true);
        const map = new Map(data.publishedMap.points.map((point) => [point.highlightId, point]));
        const from = map.get(data.seeds[0]!)!; const to = map.get(choice!.id!)!;
        const squared = (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
        const rank2d = 1 + data.publishedMap.points.filter((point) => point.highlightId !== data.seeds[0] &&
            ((point.x - from.x) ** 2 + (point.y - from.y) ** 2 < squared ||
            ((point.x - from.x) ** 2 + (point.y - from.y) ** 2 === squared && point.highlightId < choice!.id!))).length;
        await expect(page.locator('#map-summary')).toContainText(`发布平面第 ${rank2d} 近`);
        await expect(page.locator('#map-summary')).toContainText(`${(Math.sqrt(squared) / (10_000 * Math.SQRT2) * 100).toFixed(1)}%`);
        await page.screenshot({ path: `${captureFolder}/step1-${width}.png`, fullPage: true });
        await page.locator('#back').click();
        expect((await state()).trail).toEqual([data.seeds[0]]);
        await expect(page.locator('#map-summary')).toContainText('起点已定位');
        await page.locator('#seed').selectOption('h-4504');
        expect((await state()).trail).toEqual(['h-4504']);
        await page.screenshot({ path: `${captureFolder}/education-${width}.png`, fullPage: true });
        await page.locator('#restart').click(); expect((await state()).trail).toEqual(['h-4504']);
        await page.locator('#seed').selectOption('h-043');
        expect((await state()).trail).toEqual(['h-043']);
        await expect(page.locator('#dead-end')).toContainText('走到这里');
        await page.screenshot({ path: `${captureFolder}/dead-end-${width}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
        expect(errors).toEqual([]); expect(external).toEqual([]);
    });
}

for (const width of [1440, 720, 390, 320]) {
    test(`${width}: Henry's three views retain identical real choices and trail across switching`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = []; const external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5201/')) external.push(request.url()); });
        await page.goto('/');
        await expect(page.getByRole('radio', { name: '纯文字岔路' })).toBeChecked();
        await expect(page.locator('.atlas-area')).toBeHidden();
        await page.locator('#options button').first().click();
        const state = () => page.evaluate(() => window.__routeStudy.state);
        const invariant = (result: Awaited<ReturnType<typeof state>>) => ({ trail: result.trail, currentId: result.currentId, options: result.options });
        const visited = await state(); const fixed = invariant(visited);
        expect(fixed.trail).toHaveLength(2);
        const fullText = data.points[fixed.currentId]!.text;
        const choices = await page.locator('#options button').allTextContents();
        const measure = () => page.evaluate(() => {
            const top = (selector: string) => {
                const element = document.querySelector(selector); return element?.getClientRects().length ? Math.round(element.getBoundingClientRect().top + scrollY) : null;
            };
            return { view: window.__routeStudy.state.view, viewport: [innerWidth, innerHeight], pageHeight: document.documentElement.scrollHeight,
                passageTop: top('.passage'), mapTop: top('.atlas-area'), choicesTop: top('#crossroads-title'), currentId: window.__routeStudy.state.currentId };
        });
        const measurements = [await measure()];
        await page.screenshot({ path: `${captureFolder}/trial-${width}-text.png`, fullPage: true });
        await page.getByRole('radio', { name: '阅读＋地图' }).check();
        await expect(page.locator('.atlas-area')).toBeVisible();
        const alongside = await state();
        expect(alongside.view).toBe('alongside'); expect(invariant(alongside)).toEqual(fixed);
        await expect(page.locator('#text')).toHaveText(fullText);
        expect(await page.locator('#options button').allTextContents()).toEqual(choices);
        const order = () => page.locator('#view-content').evaluate((workspace) =>
            [...workspace.children].map((child) => child.className));
        expect(await order()).toEqual(['trail-head', '', 'passage', 'atlas-area', 'crossroads']);
        await expect.poll(() => page.locator('#atlas').evaluate((element) => {
            const canvas = element as HTMLCanvasElement; return canvas.width * canvas.height;
        })).toBeGreaterThan(10000);
        measurements.push(await measure());
        await page.screenshot({ path: `${captureFolder}/trial-${width}-alongside.png`, fullPage: true });
        await page.getByRole('radio', { name: '地图优先' }).check();
        const mapFirst = await state();
        expect(mapFirst.view).toBe('map-first'); expect(invariant(mapFirst)).toEqual(fixed);
        expect(await order()).toEqual(['atlas-area', 'trail-head', '', 'passage', 'crossroads']);
        await expect(page.locator('#text')).toHaveText(fullText);
        measurements.push(await measure());
        await writeFile(`${folder}/three-view/metrics-${width}.json`, JSON.stringify(measurements, null, 2) + '\n');
        await page.screenshot({ path: `${captureFolder}/trial-${width}-map-first.png`, fullPage: true });
        await page.getByRole('radio', { name: '地图优先' }).focus();
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('radio', { name: '阅读＋地图' })).toBeChecked();
        expect((await state()).trail).toEqual(fixed.trail);
        await page.locator('#back').click();
        expect((await state()).trail).toEqual([data.seeds[0]]);
        await page.getByRole('radio', { name: '纯文字岔路' }).check();
        await expect(page.locator('.atlas-area')).toBeHidden();
        const alternative = (await state()).options.filter((option) => option.id !== null).at(-1)!;
        await page.locator('#options button').last().click();
        expect((await state()).currentId).toBe(alternative.id);
        await page.locator('#seed').selectOption('h-043');
        await page.getByRole('radio', { name: '地图优先' }).check();
        await expect(page.locator('#dead-end')).toContainText('走到这里');
        expect((await state()).trail).toEqual(['h-043']);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
        expect(errors).toEqual([]); expect(external).toEqual([]);
    });
}

test('post-result long-jump diagnostic shows a real interactive choice as a spatial jump, not a road', async ({ page }) => {
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 }); await page.goto('/');
        await page.locator('#seed').selectOption('h-898');
        await page.getByRole('radio', { name: '阅读＋地图' }).check();
        const candidate = await page.evaluate(() => window.__routeStudy.state.options.find((option) => option.band === '侧边'));
        expect(candidate?.id).toBe('h-3515'); // Largest first-hop map distance among the 11 seeds × visible choices; post-result diagnostic.
        await page.getByRole('button', { name: /侧边：到/ }).click();
        expect((await page.evaluate(() => window.__routeStudy.state.trail))).toEqual(['h-898', 'h-3515']);
        await expect(page.locator('#map-summary')).toContainText('35.9%');
        await expect(page.locator('#map-summary')).toContainText('这些不是同一种距离');
        await page.screenshot({ path: `${captureFolder}/long-jump-${width}.png`, fullPage: true });
    }
});

test('a mobile visitor can follow actual cross-book edges for several choices and retrace the trail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto('/');
    await page.locator('#seed').selectOption('h-2288');
    await page.getByRole('radio', { name: '阅读＋地图' }).check();
    const state = () => page.evaluate(() => (window as unknown as { __routeStudy: { state: { trail: string[]; currentId: string; options: { id: string | null; rank: number | null }[] } } }).__routeStudy.state);
    let walked = 0;
    while (walked < 6) {
        const before = await state();
        const selection = before.options.find((option) => option.id !== null);
        if (!selection) break;
        await page.locator('#options button').first().click();
        const after = await state();
        expect(after.trail.length).toBe(before.trail.length + 1);
        expect(after.currentId).toBe(selection.id);
        expect(data.neighbors[before.currentId]![selection.rank! - 1]!.id).toBe(selection.id);
        expect(data.points[before.currentId]!.bookId).not.toBe(data.points[selection.id!]!.bookId);
        await expect(page.locator('#passage-title')).toBeFocused();
        walked += 1;
    }
    expect(walked).toBeGreaterThanOrEqual(3);
    expect((await state()).trail).toHaveLength(walked + 1);
    await page.screenshot({ path: `${captureFolder}/deep-route-390.png`, fullPage: true });
    await page.locator('#trail button').first().click();
    expect((await state()).trail).toEqual(['h-2288']);
});
