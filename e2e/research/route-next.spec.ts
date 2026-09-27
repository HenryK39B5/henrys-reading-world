import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deterministicNext, visibleForks, type NextData } from '../../scripts/research/routeNext.mjs';

const dir = '.private/research/map/route-first/next-step';
const raw = await readFile('.private/research/map/route-first/viewer-data.json', 'utf8');
if (createHash('sha256').update(raw).digest('hex') !== 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d') throw new Error('R4-K input drift');
const data = JSON.parse(raw) as NextData & { seeds: string[]; points: Record<string, { bookId: string; bookTitle: string; text: string }>; publishedMap: { points: { highlightId: string; x: number; y: number }[] } };
await mkdir(`${dir}/screenshots`, { recursive: true });

test('the new local entry has the same read-only host/origin and allowlist boundaries', async ({ request }) => {
    for (const path of ['/next', '/next.css', '/next.mjs', '/route-next-rule.mjs', '/viewer-data.json']) expect((await request.get(path)).status()).toBe(200);
    expect((await request.get('/.private/research/map/route-first/viewer-data.json')).status()).toBe(404);
    expect((await request.get('/next', { headers: { Host: 'remote.invalid' } })).status()).toBe(403);
    expect((await request.get('/next', { headers: { Origin: 'https://remote.invalid' } })).status()).toBe(403);
    expect((await request.post('/next')).status()).toBe(405);
    expect((await request.get('/unknown')).status()).toBe(404);
});

test('a frozen fixed-case automatic walk keeps the long spatial leap visible and traceable', async ({ page }) => {
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 850 }); await page.goto('/next');
        await expect(page.locator('#book')).toHaveText(data.points[data.seeds[0]!]!.bookTitle);
        await page.locator('#seed').selectOption('h-4504');
        const trail = ['h-4504'];
        for (let index = 0; index < 4; index += 1) {
            const next = deterministicNext(data, trail);
            expect(next.status).toBe('ready');
            await page.locator('#next').click(); trail.push(next.candidate!.id);
        }
        expect(trail).toEqual(['h-4504', 'h-1367', 'h-1860', 'h-2229', 'h-4034']);
        expect((await page.evaluate(() => window.__nextStudy.state.trail))).toEqual(trail);
        await expect(page.locator('#text')).toHaveText(data.points['h-4034']!.text);
        await expect(page.locator('#edge-note')).toContainText('49.4%');
        await page.screenshot({ path: `${dir}/screenshots/fixed-long-jump-${width}.png`, fullPage: true });
    }
});

for (const width of [1440, 720, 390, 320]) {
    test(`${width}: one-click reading keeps real text/map together and optional branches remain reversible`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = []; const external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5202/')) external.push(request.url()); });
        await page.goto('/next');
        await expect(page.locator('#book')).toHaveText(data.points[data.seeds[0]!]!.bookTitle);
        const state = () => page.evaluate(() => window.__nextStudy.state);
        const first = await state(); expect(first.trail).toEqual([data.seeds[0]]);
        const automatic = deterministicNext(data, first.trail);
        expect(automatic.status).toBe('ready'); expect(first.automatic).toEqual(automatic);
        await expect(page.getByRole('radio', { name: '直接续读' })).toBeChecked();
        await page.getByRole('radio', { name: '直接续读' }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('radio', { name: '自己选路' })).toBeChecked();
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('radio', { name: '直接续读' })).toBeChecked();
        expect((await state()).trail).toEqual([first.currentId]);
        await expect(page.locator('#choose-mode')).toBeHidden();
        await expect(page.locator('#text')).toHaveText(data.points[first.currentId]!.text);
        const initialPixels = await page.locator('#atlas').evaluate((element) => {
            const canvas = element as HTMLCanvasElement; const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) count += 1;
            return count;
        });
        expect(initialPixels).toBeGreaterThan(500);
        await page.screenshot({ path: `${dir}/screenshots/first-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: '再读一句 →' }).focus();
        await page.keyboard.press('Enter');
        let walked = await state(); expect(walked.trail).toEqual([first.currentId, automatic.candidate!.id]);
        expect(data.neighbors[first.currentId]![automatic.candidate!.rank - 1]!.id).toBe(walked.currentId);
        expect(data.points[walked.currentId]!.bookId).not.toBe(data.points[first.currentId]!.bookId);
        await expect(page.locator('#text')).toHaveText(data.points[walked.currentId]!.text);
        await expect(page.locator('#passage-label')).toBeFocused();
        await expect(page.locator('#edge-note')).toContainText(`原向量空间第 ${automatic.candidate!.rank} 名`);
        const destination = data.publishedMap.points.find((point) => point.highlightId === walked.currentId)!;
        const marker = await page.locator('#atlas').evaluate((element, point) => {
            const canvas = element as HTMLCanvasElement; const width = canvas.clientWidth; const height = canvas.clientHeight;
            const ratio = canvas.width / width; const size = Math.min(width, height) - 22;
            const x = ((width - size) / 2 + point.x * size / 10_000) * ratio;
            const y = ((height - size) / 2 + point.y * size / 10_000) * ratio;
            return [...canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data];
        }, destination);
        expect(marker[0]).toBeGreaterThan(180); expect(marker[3]).toBe(255);
        await page.screenshot({ path: `${dir}/screenshots/step1-${width}.png`, fullPage: true });
        const geometry = await page.evaluate(() => {
            const position = (selector: string) => {
                const node = document.querySelector(selector)!; const rect = node.getBoundingClientRect();
                return { x: Math.round(rect.x + scrollX), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) };
            };
            return { viewport: [innerWidth, innerHeight], map: position('.map-shell'), text: position('#text'), action: position('.walk-controls'),
                pageHeight: document.documentElement.scrollHeight, scrollX: document.documentElement.scrollWidth };
        });
        if (width > 600) expect(geometry.map.x + geometry.map.width).toBeLessThan(geometry.text.x);
        else expect(geometry.text.y - geometry.map.y).toBeLessThan(350);
        expect(geometry.scrollX).toBeLessThanOrEqual(width + 1);
        await writeFile(`${dir}/co-view-${width}.json`, JSON.stringify(geometry, null, 2) + '\n');
        await page.getByRole('radio', { name: '自己选路' }).check();
        walked = await state(); expect(walked.trail).toEqual([first.currentId, automatic.candidate!.id]);
        const forks = visibleForks(data, walked.trail);
        expect(walked.forks).toEqual(forks.map((fork) => ({ band: fork.band, id: fork.candidate?.id ?? null, rank: fork.candidate?.rank ?? null, isDefault: fork.isDefault })));
        if (walked.automatic.status === 'ready') expect(forks.some((fork) => fork.candidate?.id === walked.automatic.candidate!.id)).toBe(true);
        await page.screenshot({ path: `${dir}/screenshots/branches-${width}.png`, fullPage: true });
        await page.locator('#back').click();
        expect((await state()).trail).toEqual([first.currentId]);
        const rootForks = visibleForks(data, [first.currentId]);
        const other = rootForks.find((fork) => fork.candidate && fork.candidate.id !== automatic.candidate!.id);
        expect(other?.candidate).toBeTruthy();
        await page.getByRole('button', { name: new RegExp(`${other!.title}：到`) }).click();
        expect((await state()).trail).toEqual([first.currentId, other!.candidate!.id]);
        await page.locator('#back').click();
        await page.getByRole('radio', { name: '直接续读' }).check();
        expect((await state()).automatic.candidate?.id).toBe(automatic.candidate!.id);
        await page.locator('#next').click();
        expect((await state()).trail).toEqual([first.currentId, automatic.candidate!.id]);
        await page.locator('#seed').selectOption('h-043');
        expect((await state()).automatic.status).toBe('dead-end');
        await expect(page.locator('#next')).toBeDisabled();
        await expect(page.locator('#end-status')).toContainText('没有合格的跨书未见划线');
        await page.screenshot({ path: `${dir}/screenshots/dead-end-${width}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
        expect(errors).toEqual([]); expect(external).toEqual([]);
    });
}
