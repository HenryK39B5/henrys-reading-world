import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { mapToScreen } from '../src/domain/map.ts';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

test('selected map label stays reachable through pan and zoom at desktop and mobile widths', async ({ page }) => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');
    const snapshot = loadSnapshot();
    const label = snapshot.map?.labels.find((item) => item.tagId === 'tag-040');
    const tag = snapshot.tags.find((item) => item.id === label?.tagId);
    expect(label).toBeDefined();
    expect(tag).toBeDefined();
    if (label === undefined || tag === undefined) return;
    const folder = join(process.cwd(), '.private/review/maintenance/m01');
    await mkdir(folder, { recursive: true });

    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await page.goto(`/map?tag=${tag.id}`);
        const canvas = page.getByTestId('map-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const labelPosition = async () => {
            const box = await canvas.boundingBox();
            expect(box).not.toBeNull();
            if (box === null) throw new Error('map canvas has no bounds');
            const view = {
                centerX: Number(await canvas.getAttribute('data-map-center-x')),
                centerY: Number(await canvas.getAttribute('data-map-center-y')),
                zoom: Number(await canvas.getAttribute('data-map-zoom')),
            };
            const point = mapToScreen(label, view, box.width, box.height);
            return { x: box.x + point.x, y: box.y + point.y };
        };
        const initial = await labelPosition();
        await page.mouse.move(initial.x, initial.y);
        await expect(page.locator('.map-hover-readout')).toContainText(tag.title);
        await canvas.screenshot({ path: join(folder, `region-${String(width)}-before.png`) });

        await page.mouse.down();
        await page.mouse.move(initial.x + 45, initial.y + 26, { steps: 8 });
        await page.mouse.up();
        const moved = await labelPosition();
        await page.mouse.move(moved.x, moved.y);
        await expect(page.locator('.map-hover-readout')).toContainText(tag.title);
        await canvas.screenshot({ path: join(folder, `region-${String(width)}-after-pan.png`) });

        const beforeZoom = await canvas.getAttribute('data-map-zoom');
        await page.mouse.wheel(0, -100);
        await expect(canvas).not.toHaveAttribute('data-map-zoom', beforeZoom ?? '');
        await canvas.screenshot({ path: join(folder, `region-${String(width)}-after-zoom.png`) });
        const zoomed = await labelPosition();
        await page.mouse.move(zoomed.x + 1, zoomed.y);
        await expect(page.locator('.map-hover-readout')).toContainText(tag.title);
    }
});
