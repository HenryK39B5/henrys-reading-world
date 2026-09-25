import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { mapToScreen } from '../src/domain/map.ts';
import { studyContourPaths, studyPointAt } from '../src/domain/mapStudy.ts';
import type { MapPoint, Snapshot } from '../src/domain/types.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const points = snapshot.map?.points ?? [];
const contourStudy = JSON.parse(readFileSync('.private/review/maintenance/m04/resolution/field-comparison.json', 'utf8')) as {
    fields: Array<{ contours: NonNullable<Snapshot['map']>['contours'] }>;
};
const output = join(process.cwd(), '.private/review/maintenance/m04/interactive');

type View = { centerX: number; centerY: number; zoom: number };

async function readView(page: Page): Promise<{ view: View; width: number; height: number }> {
    const canvas = page.getByTestId('map-canvas');
    const size = await canvas.boundingBox();
    if (size === null) throw new Error('map canvas unavailable');
    return {
        view: {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        },
        width: size.width,
        height: size.height,
    };
}

function findPoint(frame: Awaited<ReturnType<typeof readView>>, overlap = false): { point: MapPoint; x: number; y: number } {
    for (const point of points) {
        const screen = mapToScreen(point, frame.view, frame.width, frame.height);
        if (screen.x < 36 || screen.x > frame.width - 36 || screen.y < frame.height * 0.47 || screen.y > frame.height - 55) continue;
        const result = studyPointAt(points, screen, frame.view, frame.width, frame.height);
        const crowded = overlap && points.some((other) => other.highlightId !== point.highlightId &&
            Math.hypot(mapToScreen(other, frame.view, frame.width, frame.height).x - screen.x,
                mapToScreen(other, frame.view, frame.width, frame.height).y - screen.y) < 8);
        if (result?.highlightId === point.highlightId && (!overlap || crowded)) {
            return { point, x: screen.x, y: screen.y };
        }
    }
    throw new Error(`no ${overlap ? 'overlapped' : 'visible'} point in map study`);
}

test('local map candidate renders real world and region views without a production map change', async ({ page }) => {
    mkdirSync(output, { recursive: true });
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        for (const [name, url] of [['world', '/map'], ['region', '/map?tag=tag-040']] as const) {
            await page.goto(url);
            await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
            await expect(page.getByTestId('map-study-terrain')).toHaveAttribute('data-renderer', 'webgl2');
            await expect(page.getByTestId('map-summary')).toContainText('3462 个真实点');
            await page.getByTestId('map-stage').screenshot({ path: join(output, `${name}-${String(width)}.png`) });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        }
    }
});

test('world tap zooms around the point, then an isolated point opens the existing detail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    const before = await readView(page);
    const candidate = points.map((point) => mapToScreen(point, before.view, before.width, before.height))
        .find((screen) => screen.x > before.width * 0.16 && screen.x < before.width * 0.34 &&
            screen.y > before.height * 0.58 && screen.y < before.height * 0.74);
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    const worldX = before.view.centerX + (candidate.x - before.width / 2) / (Math.min(before.width, before.height) / 10000);
    const worldY = before.view.centerY + (candidate.y - before.height / 2) / (Math.min(before.width, before.height) / 10000);
    await canvas.click({ position: candidate });
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThan(1.7);
    await expect(page.getByTestId('map-detail')).toHaveCount(0);
    const after = await readView(page);
    const anchored = mapToScreen({ x: worldX, y: worldY }, after.view, after.width, after.height);
    expect(Math.abs(anchored.x - candidate.x)).toBeLessThan(3);
    expect(Math.abs(anchored.y - candidate.y)).toBeLessThan(3);
    for (let attempt = 0; attempt < 3 && (await readView(page)).view.zoom < 4; attempt += 1) {
        await canvas.click({ position: candidate });
        await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThan(1.7 + attempt * 0.8);
        await page.waitForTimeout(230);
    }
    const ready = await readView(page);
    expect(ready.view.zoom).toBeGreaterThanOrEqual(4);
    const isolated = findPoint(ready);
    await canvas.click({ position: { x: isolated.x, y: isolated.y } });
    await expect(page).toHaveURL(new RegExp(`h=${isolated.point.highlightId}`));
    await expect(page.getByTestId('map-detail')).toBeVisible();
    await page.getByRole('link', { name: '关闭划线详情' }).click();
    await expect(canvas).toBeFocused();
});

test('one click on a crowded world dot opens its nearest real passage', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    for (let index = 0; index < 7; index += 1) await page.getByRole('button', { name: '放大地图' }).click();
    const frame = await readView(page);
    expect(frame.view.zoom).toBeGreaterThan(4);
    const overlap = findPoint(frame, true);
    await canvas.click({ position: { x: overlap.x, y: overlap.y } });
    await expect(page).toHaveURL(new RegExp(`h=${overlap.point.highlightId}`));
    await expect(page.getByTestId('map-detail')).toBeVisible();
    const highlight = snapshot.highlights.find((item) => item.id === overlap.point.highlightId);
    await expect(page.locator('.map-detail-passage')).toHaveText(highlight?.text ?? '');
    await page.getByTestId('map-stage').screenshot({ path: join(output, 'one-click-overlap-390.png') });
    await page.getByRole('link', { name: '关闭划线详情' }).click();
    await expect(canvas).toBeFocused();
});

test('hover gives a world point a soft focus without using the selected-passage outline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    const frame = await readView(page);
    const target = findPoint(frame);
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds === null) return;
    await page.mouse.move(bounds.x + target.x, bounds.y + target.y);
    await expect(canvas).toHaveAttribute('data-map-hover-point', target.point.highlightId);
    await expect(canvas).not.toHaveAttribute('data-map-hover-contour', /.+/);
    await expect(page.getByTestId('map-detail')).toHaveCount(0);
    await canvas.screenshot({ path: join(output, 'hover-point-390.png') });
    const hovered = await canvas.screenshot();
    await page.mouse.move(0, 0);
    await expect(canvas).not.toHaveAttribute('data-map-hover-point', /.+/);
    expect((await canvas.screenshot()).equals(hovered)).toBe(false);
});

test('hover highlights just one connected contour, without treating it as a clickable region', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    const frame = await readView(page);
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds === null) return;
    const paths = studyContourPaths(contourStudy.fields[1]?.contours ?? []);
    const before = await canvas.screenshot();
    let found = false;
    let contourPointer: { x: number; y: number } | null = null;
    for (let index = 0; index < paths.length && !found; index += 1) {
        for (const [x0, y0, x1, y1] of paths[index]?.segments ?? []) {
            if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) continue;
            const screen = mapToScreen({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, frame.view, frame.width, frame.height);
            if (screen.x < 45 || screen.x > frame.width - 45 || screen.y < 50 || screen.y > frame.height - 50 ||
                studyPointAt(points, screen, frame.view, frame.width, frame.height, 11) !== undefined) continue;
            await page.mouse.move(bounds.x + screen.x, bounds.y + screen.y);
            if (await canvas.getAttribute('data-map-hover-contour') === String(index)) {
                contourPointer = screen;
                found = true;
                break;
            }
        }
    }
    expect(found, 'visible contour away from dots and labels').toBe(true);
    await expect(canvas).not.toHaveAttribute('data-map-hover-point', /.+/);
    await canvas.screenshot({ path: join(output, 'hover-contour-1440.png') });
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    if (contourPointer !== null) {
        await canvas.click({ position: contourPointer });
        await expect(page.getByTestId('map-detail')).toHaveCount(0);
        await expect(canvas).toHaveAttribute('data-map-zoom', '1.000');
    }
    await page.mouse.move(0, 0);
    await expect(canvas).not.toHaveAttribute('data-map-hover-contour', /.+/);
});

test('the density underlay follows pan and zoom and survives WebGL context loss', async ({ page }) => {
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/map');
    const terrain = page.getByTestId('map-study-terrain');
    await expect(terrain).toHaveAttribute('data-renderer', 'webgl2');
    const initial = await terrain.screenshot();
    await page.getByRole('button', { name: '放大地图' }).click();
    const zoomed = await terrain.screenshot();
    expect(zoomed.equals(initial)).toBe(false);
    const canvas = page.getByTestId('map-canvas');
    const before = await readView(page);
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds === null) return;
    await page.mouse.move(bounds.x + 100, bounds.y + 400);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 175, bounds.y + 400, { steps: 5 });
    await page.mouse.up();
    const after = await readView(page);
    expect(after.view.centerX).not.toBe(before.view.centerX);
    await expect(page.getByTestId('map-detail')).toHaveCount(0);
    expect((await terrain.screenshot()).equals(zoomed)).toBe(false);
    const lost = await terrain.evaluate((element) => {
        const gl = (element as HTMLCanvasElement).getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (extension === null || extension === undefined) return false;
        extension.loseContext();
        return true;
    });
    if (lost) {
        await expect(terrain).toHaveAttribute('data-renderer', 'bands');
        await page.getByTestId('map-stage').screenshot({ path: join(output, 'context-lost-bands-720.png') });
    } else {
        test.info().annotations.push({ type: 'context loss unsupported', description: 'WEBGL_lose_context unavailable in this browser' });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('candidate keyboard pan and zoom preserve the semantic list route', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    await canvas.focus();
    await page.keyboard.press('+');
    const zoomed = await readView(page);
    expect(zoomed.view.zoom).toBeGreaterThan(1);
    await page.keyboard.press('ArrowRight');
    expect((await readView(page)).view.centerX).not.toBe(zoomed.view.centerX);
    await page.locator('.map-region-list a').first().click();
    await expect(page.locator('.map-point-list a').first()).toBeVisible();
});

test.describe('touch candidate', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test('a real touch gesture first zooms instead of choosing a crowded world point', async ({ page }) => {
        await page.goto('/map');
        const canvas = page.getByTestId('map-canvas');
        await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
        const frame = await readView(page);
        const target = points.map((point) => mapToScreen(point, frame.view, frame.width, frame.height))
            .find((screen) => screen.x > frame.width * 0.16 && screen.x < frame.width * 0.34 &&
                screen.y > frame.height * 0.58 && screen.y < frame.height * 0.74);
        expect(target).toBeDefined();
        if (target === undefined) return;
        await canvas.tap({ position: target });
        await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThan(1.7);
        await expect(page.getByTestId('map-detail')).toHaveCount(0);
        await expect(canvas).not.toHaveAttribute('data-map-hover-point', /.+/);
    });
});

test('Canvas isobands remain available without WebGL2 and reduced motion zooms without a long transition', async ({ page }) => {
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
            if (kind === 'webgl2') return null;
            return original.call(this, kind, ...options);
        } as typeof original;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/map');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible();
    await expect(page.getByTestId('map-study-terrain')).toHaveAttribute('data-renderer', 'bands');
    await page.getByTestId('map-stage').screenshot({ path: join(output, 'fallback-bands-320.png') });
    const canvas = page.getByTestId('map-canvas');
    const before = await readView(page);
    const point = points.map((entry) => mapToScreen(entry, before.view, before.width, before.height))
        .find((screen) => screen.x > before.width * 0.16 && screen.x < before.width * 0.34 &&
            screen.y > before.height * 0.58 && screen.y < before.height * 0.74);
    expect(point).toBeDefined();
    if (point === undefined) return;
    await canvas.click({ position: point });
    await expect(canvas).toHaveAttribute('data-map-zoom', '1.800');
    await expect(page.getByTestId('map-detail')).toHaveCount(0);
});
