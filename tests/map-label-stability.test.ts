import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapToScreen, summarizeMapLabels } from '../src/domain/map.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import type { Snapshot } from '../src/domain/types.ts';
import { mapLabelFontSize, planMapLabels, projectMapLabels, visibleMapLabels, type LabelPlacement } from '../src/features/map/labelPlacement.ts';

const snapshot = JSON.parse(readFileSync(new URL('../src/data/public-snapshot.json', import.meta.url), 'utf8')) as Snapshot;
const labels = summarizeMapLabels(indexSnapshot(snapshot));

function expectSeparated(placed: readonly LabelPlacement[]): void {
    for (const [index, first] of placed.entries()) {
        for (const second of placed.slice(index + 1)) {
            expect(first.right + 8 < second.left || second.right + 8 < first.left ||
                first.bottom + 5 < second.top || second.bottom + 5 < first.top,
            `${first.summary.title}/${second.summary.title} have overlapping label or hit regions`).toBe(true);
        }
    }
}

describe('real published map labels stay put during travel', () => {
    for (const size of [{ width: 390, height: 530 }, { width: 320, height: 500 }, { width: 1360, height: 720 }]) {
        it(`gives every locally supported place an overview signpost at ${size.width}px without invented names`, () => {
            const measure = (title: string, active: boolean, zoom: number): number =>
                [...title].length * mapLabelFontSize(zoom, size.width, active, true);
            const plan = planMapLabels(labels, null, size, measure, true);
            const world = visibleMapLabels(projectMapLabels(plan, 1, size, measure, null, true), 5000, 5000, 1, size);
            const radius = size.width < 520 ? 46 : 65;
            const candidates = labels.filter((entry) => (entry.localHighlightCount ?? 0) >= 3);
            const unrepresented = candidates.filter((entry) => {
                const position = mapToScreen(entry.label, { centerX: 5000, centerY: 5000, zoom: 1 }, size.width, size.height);
                return world.every((name) => Math.hypot(position.x - name.anchorX, position.y - name.anchorY) > radius);
            });
            expect(unrepresented.map((entry) => entry.tagId)).toEqual([]);
            expect(world.length).toBeLessThanOrEqual(size.width < 520 ? 12 : 20);
            expect(world.every((entry) => (entry.summary.localHighlightCount ?? 0) >= 3)).toBe(true);
            expect(world.map((entry) => entry.summary.tagId)).not.toContain('tag-050'); // Its median has no nearby reviewed member.
            expectSeparated(world);
            for (let step = 1; step <= 140; step += 1) {
                expectSeparated(projectMapLabels(plan, 1 + step * 0.05, size, measure, null, true));
            }
        });
    }

    for (const size of [{ width: 390, height: 190 }, { width: 320, height: 190 }, { width: 890, height: 720 }]) {
        it(`never evicts an admitted name during continuous zoom at ${size.width}px`, () => {
            const measure = (title: string, active: boolean, zoom: number): number =>
                [...title].length * mapLabelFontSize(zoom, size.width, active, true);
            const plan = planMapLabels(labels, null, size, measure, true);
            const world = projectMapLabels(plan, 1, size, measure, null, true);
            expect(world.length).toBeGreaterThan(0);
            expect(world.length).toBeLessThanOrEqual(size.width < 520 ? 12 : 20);
            expect(new Set(world.map((entry) => entry.summary.tagId)).size).toBe(world.length);
            expect(world.every((entry) => (entry.summary.localHighlightCount ?? 0) >= 3)).toBe(true);
            let previous = new Set<string>();
            for (let step = 0; step <= 140; step += 1) {
                const zoom = 1 + step * 0.05;
                const placed = projectMapLabels(plan, zoom, size, measure, null, true);
                expectSeparated(placed);
                const current = new Set(placed.map((entry) => entry.summary.tagId));
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
