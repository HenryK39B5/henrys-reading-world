import { describe, expect, it } from 'vitest';
import type { MapLabelSummary } from '../../domain/map.ts';
import { placeMapLabels, visibleMapLabels } from './labelPlacement.ts';

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
        const labels = [summary('tag-001', 4200, 100, 'A'), summary('tag-002', 5000, 20, 'nearby')];
        const placed = placeMapLabels(labels, null, 2, size, measure);
        expect(placed).toHaveLength(2);
        const first = visibleMapLabels(placed, 4500, 5000, 2, size);
        const second = visibleMapLabels(placed, 6500, 5000, 2, size);
        expect(first.map((entry) => entry.summary.tagId)).toContain('tag-001');
        expect(second.map((entry) => entry.summary.tagId)).not.toContain('tag-001');
        const before = first.find((entry) => entry.summary.tagId === 'tag-002');
        const after = second.find((entry) => entry.summary.tagId === 'tag-002');
        expect(before).toBeDefined();
        expect(after).toBeDefined();
        expect(after!.x - before!.x).toBe(-160);
        expect(after!.y).toBe(before!.y);
    });

    it('uses collision spacing at each zoom instead of a sudden label-count cutoff', () => {
        const labels = [
            summary('tag-001', 2500, 3, 'A'),
            summary('tag-002', 4000, 2, 'B'),
            summary('tag-003', 5500, 1, 'C'),
        ];
        for (const zoom of [1, 1.7, 1.71, 2, 2.01]) {
            expect(placeMapLabels(labels, null, zoom, size, measure).map((entry) => entry.summary.tagId))
                .toEqual(['tag-001', 'tag-002', 'tag-003']);
        }
    });

    it('keeps a place name above its true anchor and reserves the anchor in its hit bounds', () => {
        const label = summary('tag-001', 5000, 1, '学习');
        const [placed] = placeMapLabels([label], null, 1, size, measure, true);
        expect(placed).toBeDefined();
        expect(placed!.y).toBe(placed!.anchorY - 10);
        expect(placed!.top).toBeLessThan(placed!.y - 6);
        expect(placed!.bottom).toBeGreaterThan(placed!.anchorY);
        expect(placeMapLabels([label], null, 1, size, measure)[0]?.y).toBe(placed!.anchorY);
    });

    it('reserves the first placement for the selected region', () => {
        const labels = [summary('tag-001', 5000, 100, 'high-count'), summary('tag-002', 5010, 1, 'selected')];
        const placed = placeMapLabels(labels, 'tag-002', 1.5, size, measure);
        expect(placed[0]?.summary.tagId).toBe('tag-002');
        expect(placed[0]?.x).toBe(placed[0]?.anchorX);
    });
});
