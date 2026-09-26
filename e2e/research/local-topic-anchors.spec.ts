import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Snapshot } from '../../src/domain/types.ts';
import type { auditLocalAnchor } from '../../scripts/research/localTopicAnchors.ts';

const input = readFileSync('src/data/public-snapshot.json', 'utf8');
const snapshot = JSON.parse(input) as Snapshot;
const methods = ['median', 'medoid', 'localDensity', 'localBookCapped'] as const;
type Method = typeof methods[number];
const study = JSON.parse(readFileSync('.private/research/map/local-anchors/study.json', 'utf8')) as {
    inputSha256: string;
    pointsHash: string;
    mapVersion: string;
    development: string[];
    topics: { tagId: string; title: string; methods: Record<Method, ReturnType<typeof auditLocalAnchor>> }[];
};
const out = join(process.cwd(), '.private/research/map/local-anchors/screenshots');
type Draw = { title: string; x: number; y: number };
type Capture = {
    method: Method; width: number; topic: string; file: string;
    camera: { x: string | null; y: string | null; zoom: string | null };
    canvas: { width: number; height: number; visiblePixels: number };
    letters: Draw[];
    displacement: number | null;
};

for (const method of methods) {
    test(`${method}: same production points and cameras at 1440/390/320`, async ({ page }) => {
        expect(study.inputSha256).toBe(createHash('sha256').update(input).digest('hex'));
        expect(study.pointsHash).toBe(createHash('sha256').update(JSON.stringify(snapshot.map!.points)).digest('hex'));
        expect(study.mapVersion).toBe(snapshot.map!.version);
        mkdirSync(out, { recursive: true });
        const candidate: Snapshot = {
            ...snapshot,
            map: {
                ...snapshot.map!,
                labels: snapshot.map!.labels.map((label) => {
                    const topic = study.topics.find((entry) => entry.tagId === label.tagId)!;
                    return { ...label, ...topic.methods[method].anchor };
                }),
            },
        };
        expect(candidate.map!.points).toEqual(snapshot.map!.points);
        expect(candidate.map!.density).toEqual(snapshot.map!.density);
        expect(candidate.map!.contours).toEqual(snapshot.map!.contours);
        await page.route('**/assets/public-snapshot-*.json', (route) => route.fulfill({ json: candidate }));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(() => {
            const state = window as typeof window & { researchLetters: Draw[] };
            state.researchLetters = [];
            const fillText = CanvasRenderingContext2D.prototype.fillText;
            const clearRect = CanvasRenderingContext2D.prototype.clearRect;
            CanvasRenderingContext2D.prototype.clearRect = function (...args) {
                if (this.canvas.dataset.testid === 'map-canvas') state.researchLetters = [];
                return clearRect.apply(this, args);
            };
            CanvasRenderingContext2D.prototype.fillText = function (title, x, y, maxWidth) {
                if (this.canvas.dataset.testid === 'map-canvas') state.researchLetters.push({ title, x, y });
                if (maxWidth === undefined) return fillText.call(this, title, x, y);
                return fillText.call(this, title, x, y, maxWidth);
            };
        });
        const exceptions: string[] = [];
        page.on('pageerror', (error) => exceptions.push(error.message));
        const captures: Capture[] = [];
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
            for (const tagId of ['world', ...study.development]) {
                const topic = study.topics.find((entry) => entry.tagId === tagId);
                const query = tagId === 'world' ? '' : `?tag=${tagId}`;
                await page.goto(`/henrys-reading-world/map/${query}`);
                await expect(page.getByTestId('map-summary')).toContainText('3462 个真实点');
                await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
                await page.evaluate(async () => {
                    await document.fonts.ready;
                    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                });
                const canvas = page.getByTestId('map-canvas');
                const pixel = await canvas.evaluate((node) => {
                    const element = node as HTMLCanvasElement;
                    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
                    let visiblePixels = 0;
                    for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) visiblePixels += 1;
                    return { width: element.width, height: element.height, visiblePixels };
                });
                expect(pixel.width).toBeGreaterThan(200);
                expect(pixel.visiblePixels).toBeGreaterThan(500);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
                const letters = await page.evaluate(() => (window as typeof window & { researchLetters: Draw[] }).researchLetters);
                const camera = {
                    x: await canvas.getAttribute('data-map-center-x'),
                    y: await canvas.getAttribute('data-map-center-y'),
                    zoom: await canvas.getAttribute('data-map-zoom'),
                };
                let displacement: number | null = null;
                const bounds = await canvas.boundingBox();
                expect(bounds).not.toBeNull();
                if (topic !== undefined) {
                    const actual = letters.find((entry) => entry.title === topic.title);
                    expect(actual, `${topic.title} must be painted`).toBeDefined();
                    const scale = Math.min(bounds!.width, bounds!.height) / 10_000 * Number(camera.zoom);
                    const anchor = topic.methods[method].anchor;
                    const expectedX = bounds!.width / 2 + (anchor.x - Number(camera.x)) * scale;
                    const expectedY = bounds!.height / 2 + (anchor.y - Number(camera.y)) * scale;
                    displacement = Math.hypot(actual!.x - expectedX, actual!.y - expectedY);
                    // Camera attributes are rounded; this allows sub-pixel diagnostic error, not relocation.
                    expect(displacement).toBeLessThan(0.2);
                    const nearPoint = snapshot.map!.points.find((point) => snapshot.highlights.find((highlight) => highlight.id === point.highlightId)?.tagIds.includes(tagId));
                    expect(nearPoint).toBeDefined();
                    await expect(page.getByRole('navigation', { name: '当前地图层级' }).getByRole('link', { name: '回到世界总览', exact: true })).toBeVisible();
                } else {
                    expect(letters.length).toBeLessThanOrEqual(width < 520 ? 10 : 18);
                }
                const file = `${method}-${tagId}-${width}.png`;
                await page.locator('.map-canvas-wrap').screenshot({ path: join(out, file) });
                captures.push({ method, width, topic: tagId, file, camera, canvas: pixel, letters, displacement });
                if (topic !== undefined && tagId === 'tag-026' && width === 390) {
                    const actual = letters.find((entry) => entry.title === topic.title)!;
                    await canvas.click({ position: { x: actual.x, y: actual.y } });
                    await expect(page).toHaveURL(new RegExp(`tag=${tagId}`));
                    await expect(page.getByTestId('map-detail')).toHaveCount(0);
                    await page.getByRole('navigation', { name: '当前地图层级' }).getByRole('link', { name: '回到世界总览', exact: true }).click();
                    await expect(page).toHaveURL('/henrys-reading-world/map/');
                }
            }
        }
        expect(exceptions).toEqual([]);
        writeFileSync(join(out, `${method}-captures.json`), JSON.stringify(captures, null, 2) + '\n');
    });
}

test('paired captures use identical cameras and form inspectable contact sheets', async ({ page }) => {
    const all = methods.flatMap((method) => JSON.parse(readFileSync(join(out, `${method}-captures.json`), 'utf8')) as Capture[]);
    expect(all).toHaveLength(108);
    for (const width of [1440, 390, 320]) {
        for (const topic of ['world', ...study.development]) {
            const pairs = all.filter((capture) => capture.width === width && capture.topic === topic);
            expect(pairs).toHaveLength(4);
            for (const pair of pairs) expect(pair.camera).toEqual(pairs[0]!.camera);
            if (width !== 390) continue;
            const images = pairs.map((pair) => ({ method: pair.method, data: readFileSync(join(out, pair.file)).toString('base64') }));
            await page.setViewportSize({ width: 780, height: 900 });
            await page.setContent(`<html><head><style>body{margin:0;background:#17211b;color:#eee;font:14px system-ui}main{display:grid;grid-template-columns:390px 390px}figure{margin:0;padding:0}figcaption{padding:10px;height:22px}img{display:block;width:390px}</style></head><body><main>${images.map((image) => `<figure><figcaption>${image.method}</figcaption><img src="data:image/png;base64,${image.data}" /></figure>`).join('')}</main></body></html>`);
            await page.locator('img').evaluateAll(async (images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
            await page.screenshot({ path: join(out, `comparison-${topic}-390.png`), fullPage: true });
        }
    }
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ inputSha256: study.inputSha256, pointsHash: study.pointsHash, captures: all }, null, 2) + '\n');
});
