import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { MapContour, Snapshot } from '../src/domain/types.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const artifact = JSON.parse(readFileSync('.private/review/maintenance/m04/candidate-contours.json', 'utf8')) as {
    sourceVersion: string;
    pointsHash: string;
    densityHash: string;
    candidate: MapContour[];
};
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const folder = join(process.cwd(), '.private/review/maintenance/m04');

test('current and interpolated contours render the identical public map at matching views', async ({ page }) => {
    const map = snapshot.map;
    expect(map).toBeDefined();
    if (map === undefined) return;
    expect(artifact.sourceVersion).toBe(map.version);
    expect(artifact.pointsHash).toBe(hash(map.points));
    expect(artifact.densityHash).toBe(hash(map.density));
    mkdirSync(folder, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const variant of ['current', 'interpolated'] as const) {
        if (variant === 'interpolated') {
            await page.route('**/assets/public-snapshot-*.json', (route) => route.fulfill({
                json: { ...snapshot, map: { ...map, contours: artifact.candidate } },
            }));
        }
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
            for (const [room, path] of [
                ['world', '/henrys-reading-world/map/'],
                ['region', '/henrys-reading-world/map/?tag=tag-040'],
            ] as const) {
                await page.goto(path);
                const canvas = page.getByTestId('map-canvas');
                await expect(canvas).toBeVisible();
                await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
                await canvas.screenshot({ path: join(folder, `${variant}-${room}-${String(width)}.png`) });
                await expect(page.getByTestId('map-summary')).toContainText('3462 个真实点');
            }
        }
    }
});
