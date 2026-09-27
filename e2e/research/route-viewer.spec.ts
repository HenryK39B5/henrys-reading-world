import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const folder = '.private/research/map/route-first';
const data = JSON.parse(await readFile(`${folder}/viewer-data.json`, 'utf8')) as { seeds: string[]; points: Record<string, { text: string; bookTitle: string; bookId: string }>; neighbors: Record<string, { id: string; score: number }[]> };
const study = JSON.parse(await readFile(`${folder}/study.json`, 'utf8')) as { snapshotSha256: string; parameters: { reviewIds: string[] } };
if (data.seeds.slice(0, 10).join('|') !== study.parameters.reviewIds.join('|') || data.seeds[10] !== 'h-043') throw new Error('viewer seeds drifted');
await mkdir(`${folder}/screenshots`, { recursive: true });

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
        const state = () => page.evaluate(() => (window as unknown as { __routeStudy: { state: { trail: string[]; currentId: string; options: { band: string; id: string | null; rank: number | null }[] } } }).__routeStudy.state);
        let current = await state(); expect(current.trail).toEqual([data.seeds[0]]);
        expect(await page.locator('#text').textContent()).toBe(data.points[current.currentId]!.text);
        await page.screenshot({ path: `${folder}/screenshots/crossroads-${width}.png`, fullPage: true });
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
        await page.screenshot({ path: `${folder}/screenshots/step1-${width}.png`, fullPage: true });
        await page.locator('#back').click();
        expect((await state()).trail).toEqual([data.seeds[0]]);
        await page.locator('#seed').selectOption('h-4504');
        expect((await state()).trail).toEqual(['h-4504']);
        await page.screenshot({ path: `${folder}/screenshots/education-${width}.png`, fullPage: true });
        await page.locator('#restart').click(); expect((await state()).trail).toEqual(['h-4504']);
        await page.locator('#seed').selectOption('h-043');
        expect((await state()).trail).toEqual(['h-043']);
        await expect(page.locator('#dead-end')).toContainText('走到这里');
        await page.screenshot({ path: `${folder}/screenshots/dead-end-${width}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
        expect(errors).toEqual([]); expect(external).toEqual([]);
    });
}

test('a mobile visitor can follow actual cross-book edges for several choices and retrace the trail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto('/');
    await page.locator('#seed').selectOption('h-2288');
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
    await page.screenshot({ path: `${folder}/screenshots/deep-route-390.png`, fullPage: true });
    await page.locator('#trail button').first().click();
    expect((await state()).trail).toEqual(['h-2288']);
});
