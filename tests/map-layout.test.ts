import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../src/domain/types.ts';
import {
    MAP_COORDINATE_MAX,
} from '../src/domain/types.ts';
import {
    assembleMapLayout,
    buildContours,
    buildDensity,
    buildMapLabels,
    mapTagHash,
    mulberry32,
    normalizeMapPoints,
    projectForMap,
} from '../scripts/embeddings/mapLayout.ts';

const snapshot = {
    tags: [
        { id: 'tag-001', title: '选择' },
        { id: 'tag-002', title: '风险' },
    ],
    highlights: [
        { id: 'h-001', bookId: 'b-001', text: 'a', tagIds: ['tag-001'] },
        { id: 'h-002', bookId: 'b-002', text: 'b', tagIds: ['tag-001', 'tag-002'] },
        { id: 'h-003', bookId: 'b-003', text: 'c', tagIds: [] },
    ],
} satisfies Pick<Snapshot, 'tags' | 'highlights'>;

const points = [
    { highlightId: 'h-001', x: 1000, y: 2000 },
    { highlightId: 'h-002', x: 5000, y: 6000 },
    { highlightId: 'h-003', x: 9000, y: 8000 },
];

describe('map layout derivation', () => {
    it('uses a deterministic independent projection and seeded RNG', () => {
        const vector = Array.from({ length: 128 }, (_, index) => Math.sin(index + 1));
        expect(projectForMap(vector)).toEqual(projectForMap(vector));
        expect(projectForMap(vector)).toHaveLength(96);
        expect(projectForMap(vector)).not.toEqual(projectForMap([...vector].reverse()));

        const first = mulberry32(1234);
        const second = mulberry32(1234);
        expect([first(), first(), first()]).toEqual([second(), second(), second()]);
    });

    it('normalizes outliers into bounded stable map coordinates', () => {
        const normalized = normalizeMapPoints([
            { highlightId: 'h-001', x: -100, y: 10 },
            { highlightId: 'h-002', x: 0, y: 20 },
            { highlightId: 'h-003', x: 100, y: 30 },
        ]);
        expect(normalized).toHaveLength(3);
        for (const point of normalized) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(MAP_COORDINATE_MAX);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(MAP_COORDINATE_MAX);
        }
    });

    it('places tag labels at robust member centres and leaves untagged points unnamed', () => {
        expect(buildMapLabels(snapshot, points)).toEqual([
            { tagId: 'tag-001', x: 3000, y: 4000 },
            { tagId: 'tag-002', x: 5000, y: 6000 },
        ]);
    });

    it('builds bounded density and real contour segments from every point', () => {
        const density = buildDensity(points, 12, 8);
        expect(density.values).toHaveLength(96);
        expect(Math.max(...density.values)).toBe(255);
        expect(density.values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
        const contours = buildContours(density, [80, 160]);
        expect(contours).toHaveLength(2);
        expect(contours.some((contour) => contour.segments.length > 0)).toBe(true);
        for (const contour of contours) {
            for (const segment of contour.segments) {
                expect(segment).toHaveLength(4);
                expect(segment.every((value) => value >= 0 && value <= MAP_COORDINATE_MAX)).toBe(true);
            }
        }
    });

    it('assembles a complete consumer layout and hashes tag changes', () => {
        const layout = assembleMapLayout(snapshot, 'map-test-v1', points);
        expect(layout.points).toHaveLength(3);
        expect(layout.labels).toHaveLength(2);
        expect(layout.contours).toHaveLength(3);
        const changed = {
            ...snapshot,
            highlights: snapshot.highlights.map((highlight) =>
                highlight.id === 'h-003' ? { ...highlight, tagIds: ['tag-002'] } : highlight,
            ),
        };
        expect(mapTagHash(changed)).not.toBe(mapTagHash(snapshot));
    });
});
