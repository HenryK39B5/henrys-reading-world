import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeMapLabels } from '../src/domain/map.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import type { Snapshot } from '../src/domain/types.ts';
import { mapLabelFontSize, placeMapLabels, planMapLabels, projectMapLabels, visibleMapLabels } from '../src/features/map/labelPlacement.ts';

const snapshot = JSON.parse(readFileSync(new URL('../src/data/public-snapshot.json', import.meta.url), 'utf8')) as Snapshot;
const labels = summarizeMapLabels(indexSnapshot(snapshot));

describe('real published map labels stay put during travel', () => {
    for (const size of [{ width: 390, height: 190 }, { width: 320, height: 190 }, { width: 890, height: 720 }]) {
        it(`never evicts an admitted name during continuous zoom at ${size.width}px`, () => {
            const measure = (title: string, active: boolean, zoom: number): number =>
                [...title].length * mapLabelFontSize(zoom, size.width, active, true);
            const plan = planMapLabels(labels, null, size, measure, true);
            const world = projectMapLabels(plan, 1, size, measure, null, true);
            expect(world).toEqual(placeMapLabels(labels, null, 1, size,
                (title, active) => measure(title, active, 1), true));
            let previous = new Set<string>();
            for (let step = 0; step <= 140; step += 1) {
                const zoom = 1 + step * 0.05;
                const current = new Set(projectMapLabels(plan, zoom, size, measure, null, true)
                    .map((entry) => entry.summary.tagId));
                expect([...previous].filter((id) => !current.has(id))).toEqual([]);
                previous = current;
            }
        });
    }

    it('does not evict a central real name when higher-priority names enter at the edge', () => {
        const size = { width: 390, height: 190 };
        const measure = (title: string, active: boolean, zoom: number): number =>
            [...title].length * mapLabelFontSize(zoom, size.width, active, true);
        const plan = planMapLabels(labels, null, size, measure, true);
        const placed = projectMapLabels(plan, 4, size, measure, null, true);
        const before = visibleMapLabels(placed, 5662, 2407, 4, size);
        const after = visibleMapLabels(placed, 6012, 2407, 4, size);
        const first = before.find((entry) => entry.summary.tagId === 'tag-006');
        const last = after.find((entry) => entry.summary.tagId === 'tag-006');
        expect(first).toBeDefined();
        expect(last).toBeDefined();
        expect(last!.x).toBeGreaterThan(50);
        expect(last!.x).toBeLessThan(size.width - 50);
        expect(last!.y).toBeGreaterThan(35);
        expect(last!.y).toBeLessThan(size.height - 35);
        expect(last!.x - first!.x).toBeCloseTo(-26.6, 2);
        expect(after.length).toBeGreaterThan(before.length);
    });
});
