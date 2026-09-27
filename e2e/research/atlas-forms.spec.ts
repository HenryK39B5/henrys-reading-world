import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deterministicNext, type NextData } from '../../scripts/research/routeNext.mjs';
import { bookIslandLayout } from '../../scripts/research/atlasForms.mjs';

const dir = '.private/research/map/route-first/atlas-forms';
const raw = await readFile('.private/research/map/route-first/viewer-data.json', 'utf8');
if (createHash('sha256').update(raw).digest('hex') !== 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d') throw new Error('atlas fixed input drift');
const data = JSON.parse(raw) as NextData & { seeds: string[]; points: Record<string, { id: string; bookId: string; bookTitle: string; text: string }>; publishedMap: { points: { highlightId: string; x: number; y: number }[] } };
await mkdir(`${dir}/screenshots`, { recursive: true });
const variants = ['published', 'stars', 'islands'] as const;

test('new atlas forms expose only explicitly allowlisted loopback read-only resources', async ({ request }) => {
    for (const name of variants) expect((await request.get(`/atlas/${name}`)).status()).toBe(200);
    for (const path of ['/atlas-forms.css', '/atlas-forms.mjs', '/atlas-geometry.mjs', '/route-next-rule.mjs', '/viewer-data.json']) expect((await request.get(path)).status()).toBe(200);
    expect((await request.get('/.private/research/map/route-first/viewer-data.json')).status()).toBe(404);
    expect((await request.get('/atlas/fake')).status()).toBe(404);
    expect((await request.get('/atlas/stars', { headers: { Host: 'remote.invalid' } })).status()).toBe(403);
    expect((await request.get('/atlas/stars', { headers: { Origin: 'https://remote.invalid' } })).status()).toBe(403);
    expect((await request.post('/atlas/stars')).status()).toBe(405);
});

for (const variant of variants) for (const width of [1440, 720, 390, 320]) {
    test(`${variant} ${width}: one real route, fixed atlas while stepping, backtracking and complete text`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = []; const external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5203/')) external.push(request.url()); });
        await page.goto(`/atlas/${variant}`);
        await expect(page.locator('#point-id')).toHaveText(data.seeds[0]!);
        const state = () => page.evaluate(() => window.__atlasStudy.state);
        const start = await state(); expect(start.variant).toBe(variant); expect(start.islandCount).toBe(108);
        expect(start.trail).toEqual([data.seeds[0]]); expect(start.next).toEqual(deterministicNext(data, start.trail));
        await expect(page.locator('#text')).toHaveText(data.points[data.seeds[0]!]!.text);
        const initialPosition = start.currentPoint;
        const canvas = page.locator('#atlas');
        expect(await canvas.evaluate((element) => {
            const pixels = (element as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, (element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height).data;
            let nonempty = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) nonempty += 1;
            return nonempty;
        })).toBeGreaterThan(100);
        await page.screenshot({ path: `${dir}/screenshots/${variant}-${width}-start.png`, fullPage: true });
        await page.locator('#next').scrollIntoViewIfNeeded();
        const before = await page.locator('.map-frame').boundingBox();
        const first = deterministicNext(data, start.trail);
        await page.locator('#next').focus(); await page.keyboard.press('Enter');
        const walked = await state(); expect(walked.trail).toEqual([data.seeds[0], first.candidate!.id]);
        await expect(page.locator('#text')).toHaveText(data.points[first.candidate!.id]!.text);
        await expect(page.locator('#passage-label')).toBeFocused();
        const after = await page.locator('.map-frame').boundingBox();
        expect(after!.x).toBeCloseTo(before!.x, 0); expect(after!.y).toBeCloseTo(before!.y, 0);
        expect((await page.evaluate(() => document.documentElement.scrollWidth))).toBeLessThanOrEqual(width);
        if (width < 651) {
            expect(after!.y + after!.height).toBeLessThan(260);
            expect((await page.locator('#text').boundingBox())!.y).toBeGreaterThanOrEqual(after!.y + after!.height - 8);
        }
        await writeFile(`${dir}/${variant}-${width}-geometry.json`, JSON.stringify({ variant, viewport: [width, 850], before, after,
            text: await page.locator('#text').boundingBox(), pageHeight: await page.evaluate(() => document.documentElement.scrollHeight),
            destination: first.candidate!.id }, null, 2) + '\n');
        const expectedPosition = variant === 'islands' ? bookIslandLayout(data.points).byPoint[first.candidate!.id]! : data.publishedMap.points.find((point) => point.highlightId === first.candidate!.id)!;
        expect(walked.currentPoint.x).toBeCloseTo(expectedPosition.x, 8);
        expect(walked.currentPoint.y).toBeCloseTo(expectedPosition.y, 8);
        await page.screenshot({ path: `${dir}/screenshots/${variant}-${width}-step1.png`, fullPage: true });
        await page.locator('#back').click(); expect((await state()).trail).toEqual(start.trail);
        expect((await state()).currentPoint).toMatchObject({ x: initialPosition.x, y: initialPosition.y });
        await page.locator('#next').click(); expect((await state()).trail).toEqual(walked.trail);
        await page.locator('#seed').selectOption('h-043'); await expect(page.locator('#next')).toBeDisabled();
        await expect(page.locator('#end-status')).toContainText('无合格');
        expect((await state()).trail).toEqual(['h-043']);
        expect(errors).toEqual([]); expect(external).toEqual([]);
    });
}

test('frozen long-jump case retains identical real six-step sequence on all three map grammars', async ({ page }) => {
    for (const variant of variants) {
        await page.setViewportSize({ width: 390, height: 850 }); await page.goto(`/atlas/${variant}`);
        await expect(page.locator('#point-id')).toHaveText(data.seeds[0]!);
        await page.locator('#seed').selectOption('h-4504');
        const trail = ['h-4504'];
        for (let step = 0; step < 6; step += 1) {
            const next = deterministicNext(data, trail); expect(next.status).toBe('ready');
            await page.locator('#next').scrollIntoViewIfNeeded();
            const before = await page.locator('.map-frame').boundingBox();
            await page.locator('#next').click(); trail.push(next.candidate!.id);
            const after = await page.locator('.map-frame').boundingBox();
            expect(after!.y).toBeCloseTo(before!.y, 0);
        }
        expect((await page.evaluate(() => window.__atlasStudy.state.trail))).toEqual(trail);
        expect(trail.slice(0, 5)).toEqual(['h-4504', 'h-1367', 'h-1860', 'h-2229', 'h-4034']);
        await expect(page.locator('#next')).toBeDisabled();
        await page.screenshot({ path: `${dir}/screenshots/${variant}-390-six-step.png`, fullPage: true });
    }
});
