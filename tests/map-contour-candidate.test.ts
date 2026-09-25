import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_COORDINATE_MAX, type Snapshot } from '../src/domain/types.ts';
import { interpolatedContours } from '../scripts/embeddings/contourCandidate.ts';
import { MAP_CONTOUR_LEVELS } from '../scripts/embeddings/mapLayout.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;

describe('offline contour comparison on the real approved density field', () => {
    it('keeps all input positions and field values untouched while tracing bounded isolines', () => {
        const map = snapshot.map;
        expect(map).toBeDefined();
        if (map === undefined) return;
        const original = JSON.stringify(map);
        const candidate = interpolatedContours(map.density);
        expect(JSON.stringify(map)).toBe(original);
        expect(candidate.map((entry) => entry.level)).toEqual([...MAP_CONTOUR_LEVELS]);
        expect(candidate.map((entry) => entry.segments.length).every((count) => count > 0)).toBe(true);
        expect(candidate).not.toEqual(map.contours);
        for (const contour of candidate) {
            for (const segment of contour.segments) {
                expect(segment).toHaveLength(4);
                expect(segment.every((value) => Number.isFinite(value) && value >= 0 && value <= MAP_COORDINATE_MAX)).toBe(true);
                const [x0, y0, x1, y1] = segment;
                expect(x0 === x1 && (x0 === 0 || x0 === MAP_COORDINATE_MAX)).toBe(false);
                expect(y0 === y1 && (y0 === 0 || y0 === MAP_COORDINATE_MAX)).toBe(false);
            }
        }
    });
    it('adds nested local density levels without modifying the approved point field', () => {
        const map = snapshot.map;
        expect(map).toBeDefined();
        if (map === undefined) return;
        const before = JSON.stringify(map);
        const levels = [48, 96, 136, 160, 184, 208, 232];
        const relief = interpolatedContours(map.density, levels);
        expect(relief.map((entry) => entry.level)).toEqual(levels);
        expect(relief.every((entry) => entry.segments.length > 0)).toBe(true);
        expect(JSON.stringify(map)).toBe(before);
        for (const contour of relief) {
            for (const segment of contour.segments) {
                expect(segment).toHaveLength(4);
                expect(segment.every((value) => Number.isFinite(value) && value >= 0 && value <= MAP_COORDINATE_MAX)).toBe(true);
            }
        }
    });
});
