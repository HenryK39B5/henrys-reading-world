import { describe, expect, it } from 'vitest';
import type { MapLabelSummary } from '../../domain/map.ts';
import { mapLabelFontSize, placeMapLabels, planMapLabels, projectMapLabels, visibleMapLabels } from './labelPlacement.ts';

const size = { width: 400, height: 400 };
const summary = (tagId: string, x: number, count: number, title: string): MapLabelSummary => ({
    tagId,
    title,
    highlightCount: count,
    bookCount: 1,
    label: { tagId, x, y: 5000 },
});

const measure = (text: string): number => text.length * 14;

describe('map label placement', () => {
    it('keeps labels at the same map position when a higher-priority label leaves the viewport', () => {
        const labels = [summary('tag-001', 3900, 100, 'A'), summary('tag-002', 5000, 20, 'nearby')];
        const plan = planMapLabels(labels, null, size, measure);
        const placed = projectMapLabels(plan, 4, size, measure, null);
        expect(placed).toHaveLength(2);
        const first = visibleMapLabels(placed, 4800, 5000, 4, size);
        const second = visibleMapLabels(placed, 5600, 5000, 4, size);
        expect(first.map((entry) => entry.summary.tagId)).toContain('tag-001');
        expect(second.map((entry) => entry.summary.tagId)).not.toContain('tag-001');
        const before = first.find((entry) => entry.summary.tagId === 'tag-002');
        const after = second.find((entry) => entry.summary.tagId === 'tag-002');
        expect(before).toBeDefined();
        expect(after).toBeDefined();
        expect(after!.x - before!.x).toBe(-128);
        expect(after!.y).toBe(before!.y);
    });

    it('uses collision spacing at each zoom instead of a sudden label-count cutoff', () => {
        const labels = [
            summary('tag-001', 2500, 3, 'A'),
            summary('tag-002', 4000, 2, 'B'),
            summary('tag-003', 5500, 1, 'C'),
        ];
        const plan = planMapLabels(labels, null, size, measure);
        for (const zoom of [1, 1.7, 1.71, 2, 2.01]) {
            expect(projectMapLabels(plan, zoom, size, measure, null).map((entry) => entry.summary.tagId))
                .toEqual(['tag-001', 'tag-002', 'tag-003']);
        }
    });

    it('centers pure lettering on the real anchor and reserves a larger invisible hit area', () => {
        const label = summary('tag-001', 5000, 1, '学习');
        const [placed] = placeMapLabels([label], null, 1, size, measure, true);
        expect(placed).toBeDefined();
        expect(placed!.y).toBe(placed!.anchorY);
        expect(placed!.top).toBeLessThan(placed!.y - 6);
        expect(placed!.bottom).toBeGreaterThan(placeMapLabels([label], null, 1, size, measure)[0]!.bottom);
    });

    it('keeps the world type scale and gives zoomed-in places a bounded, readable hierarchy', () => {
        expect(mapLabelFontSize(1, 1440, false)).toBe(14);
        expect(mapLabelFontSize(1, 1440, true)).toBe(16);
        expect(mapLabelFontSize(4, 1440, false)).toBeGreaterThan(19);
        expect(mapLabelFontSize(4, 1440, true)).toBeGreaterThan(21);
        expect(mapLabelFontSize(8, 1440, false)).toBeLessThanOrEqual(22);
        expect(mapLabelFontSize(8, 390, false)).toBeLessThanOrEqual(19);
        expect(mapLabelFontSize(8, 390, true)).toBeLessThanOrEqual(21);
        expect(mapLabelFontSize(1, 1440, false, true)).toBe(13);
        expect(mapLabelFontSize(4, 1440, false, true)).toBe(19);
        expect(mapLabelFontSize(8, 390, true, true, true)).toBe(16);
        expect(placeMapLabels([summary('tag-001', 5000, 1, 'A')], null, 4, size, measure, true, true)).toHaveLength(1);
    });

    it('lets genuine lower-ranked places enter at reading scale without moving them when panned', () => {
        const candidates: MapLabelSummary[] = Array.from({ length: 12 }, (_, number) => ({
            tagId: `tag-${String(number + 1).padStart(3, '0')}`,
            title: `Place ${String(number + 1)}`,
            highlightCount: 12 - number,
            bookCount: 1,
            label: {
                tagId: `tag-${String(number + 1).padStart(3, '0')}`,
                x: 1200 + (number % 4) * 2300,
                y: 1200 + Math.floor(number / 4) * 3000,
            },
        }));
        const titleWidth = (title: string): number => title.length * 9;
        const plan = planMapLabels(candidates, null, size, titleWidth, true);
        const world = projectMapLabels(plan, 1, size, titleWidth, null, true);
        expect(world).toEqual(placeMapLabels(candidates, null, 1, size, titleWidth, true, true));
        expect(world.map((entry) => entry.summary.tagId)).not.toContain('tag-012');
        expect(placeMapLabels(candidates, null, 4, size, titleWidth, true, true)).toHaveLength(10);
        const close = projectMapLabels(plan, 4, size, titleWidth, null, true);
        const target = candidates[11]!;
        expect(close.map((entry) => entry.summary.tagId)).toContain(target.tagId);
        const first = visibleMapLabels(close, target.label.x, target.label.y, 4, size)
            .find((entry) => entry.summary.tagId === target.tagId);
        const panned = visibleMapLabels(close, target.label.x + 100, target.label.y, 4, size)
            .find((entry) => entry.summary.tagId === target.tagId);
        expect(first).toBeDefined();
        expect(panned?.x).toBeCloseTo(first!.x - 16);
        expect(projectMapLabels(planMapLabels(candidates, target.tagId, size, titleWidth, true), 4, size, titleWidth, target.tagId, true)[0]?.summary.tagId)
            .toBe(target.tagId);
        let previous = new Set<string>();
        for (let tenth = 10; tenth <= 80; tenth += 1) {
            const current = new Set(projectMapLabels(plan, tenth / 10, size, titleWidth, null, true)
                .map((entry) => entry.summary.tagId));
            expect([...previous].every((id) => current.has(id))).toBe(true);
            previous = current;
        }
    });

    it('reserves the first placement for the selected region', () => {
        const labels = [summary('tag-001', 5000, 100, 'high-count'), summary('tag-002', 5010, 1, 'selected')];
        const placed = placeMapLabels(labels, 'tag-002', 1.5, size, measure);
        expect(placed[0]?.summary.tagId).toBe('tag-002');
        expect(placed[0]?.x).toBe(placed[0]?.anchorX);
    });
});
