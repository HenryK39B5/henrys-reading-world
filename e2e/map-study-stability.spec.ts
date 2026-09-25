import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const output = join(process.cwd(), '.private/review/maintenance/m04/stability');

test.use({ deviceScaleFactor: 2 });

test('terrain survives resize and sustained pan/zoom without blanking or losing navigation', async ({ page, browserName }) => {
    mkdirSync(output, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/map');
    const stage = page.getByTestId('map-stage');
    const canvas = page.getByTestId('map-canvas');
    const terrain = page.getByTestId('map-study-terrain');
    await expect(page.locator('.map-canvas-wrap[data-map-study="ready"]')).toBeVisible({ timeout: 15_000 });
    await expect(terrain).toHaveAttribute('data-renderer', /webgl2|bands/);
    const original = await stage.screenshot();
    let previousWidth = 1440;
    for (const width of [720, 390, 320, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 720 });
        if (width === 1440) {
            await expect.poll(async () => canvas.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBeGreaterThan(previousWidth);
        } else {
            await expect.poll(async () => canvas.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBeLessThan(previousWidth);
        }
        const actualWidth = await canvas.evaluate((node) => Math.round(node.getBoundingClientRect().width));
        expect(actualWidth).toBeLessThanOrEqual(width);
        previousWidth = actualWidth;
        await expect.poll(async () => terrain.evaluate((node) => {
            const element = node as HTMLCanvasElement;
            return Math.abs(element.width - element.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio)) < 3;
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
    const frame = await canvas.boundingBox();
    if (frame === null) throw new Error('map canvas missing after resize');
    // Keep the pointer away from the controls and from the viewport edge while testing direct manipulation.
    await page.mouse.move(frame.x + frame.width * 0.45, frame.y + frame.height * 0.65);
    const samples: number[] = [];
    for (let index = 0; index < 24; index += 1) {
        const start = Date.now();
        await page.mouse.wheel(0, index % 2 === 0 ? -90 : 90);
        await page.mouse.move(frame.x + frame.width * 0.45, frame.y + frame.height * 0.65);
        await page.mouse.down();
        await page.mouse.move(frame.x + frame.width * 0.45 + (index % 2 === 0 ? 28 : -28), frame.y + frame.height * 0.65, { steps: 3 });
        await page.mouse.up();
        samples.push(Date.now() - start);
    }
    await expect(terrain).toHaveAttribute('data-renderer', /webgl2|bands/);
    const moved = await stage.screenshot();
    expect(moved.equals(original)).toBe(false);
    const distinctMapPixels = await canvas.evaluate((node) => {
        const element = node as HTMLCanvasElement;
        const ctx = element.getContext('2d');
        if (ctx === null) return 0;
        const samples = new Set<string>();
        for (let row = 1; row < 12; row += 1) for (let column = 1; column < 12; column += 1) {
            const pixel = ctx.getImageData(Math.floor(element.width * column / 12), Math.floor(element.height * row / 12), 1, 1).data;
            samples.add(`${pixel[0]}:${pixel[1]}:${pixel[2]}:${pixel[3]}`);
        }
        return samples.size;
    });
    expect(distinctMapPixels).toBeGreaterThan(5);
    await stage.screenshot({ path: join(output, `${browserName}-map-after-stress.png`) });
    await canvas.focus();
    await page.keyboard.press('+');
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThan(1);
    await page.locator('.map-region-list a').first().click();
    await expect(page.locator('.map-point-list a').first()).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: join(output, `${browserName}-after-navigation.png`) });
    writeFileSync(join(output, `${browserName}-samples.json`), JSON.stringify({
        browser: browserName, dpr: 2, interactions: samples.length,
        medianMs: [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)],
        maxMs: Math.max(...samples), renderer: await terrain.getAttribute('data-renderer'),
        distinctMapPixels,
        note: 'Playwright command round-trip includes automation overhead; not GPU frame timing',
    }, null, 2));
});

test('a lost WebGL context keeps a usable Canvas fallback across resize and movement', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'context-loss extension is not consistently exposed by WebKit');
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/map');
    const terrain = page.getByTestId('map-study-terrain');
    await expect(terrain).toHaveAttribute('data-renderer', 'webgl2');
    const lost = await terrain.evaluate((node) => {
        const gl = (node as HTMLCanvasElement).getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (extension === null || extension === undefined) return false;
        extension.loseContext();
        return true;
    });
    test.skip(!lost, 'WEBGL_lose_context extension unavailable');
    await expect(terrain).toHaveAttribute('data-renderer', 'bands');
    const before = await terrain.screenshot();
    await page.setViewportSize({ width: 390, height: 720 });
    await expect.poll(async () => terrain.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBe(390);
    await page.getByRole('button', { name: '放大地图' }).click();
    await expect(terrain).toHaveAttribute('data-renderer', 'bands');
    const after = await terrain.screenshot();
    expect(after.equals(before)).toBe(false);
    await page.getByTestId('map-stage').screenshot({ path: join(output, 'chromium-context-loss-fallback.png') });
});
