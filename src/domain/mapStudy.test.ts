import { describe, expect, it } from 'vitest';
import { mapToScreen } from './map.ts';
import { studyContourAt, studyContourPaths, studyPointAt, studyPointZoomThreshold } from './mapStudy.ts';
import type { MapContour, MapPoint } from './types.ts';

const view = { centerX: 5000, centerY: 5000, zoom: 4 };
const dimensions = { width: 390, height: 620 };
const point: MapPoint = { highlightId: 'h-001', x: 5000, y: 5000 };

describe('study map hit testing', () => {
    it('unlocks point selection at a viewport-aware threshold', () => {
        expect(studyPointZoomThreshold(390)).toBe(4);
        expect(studyPointZoomThreshold(1360)).toBe(3);
    });

    it('selects the nearest point once, including overlapping and off-centre taps', () => {
        const target = mapToScreen(point, view, dimensions.width, dimensions.height);
        const neighbour: MapPoint = { highlightId: 'h-002', x: 5000, y: 5000 };
        expect(studyPointAt([neighbour, point], target, view, dimensions.width, dimensions.height)).toEqual(point);
        expect(studyPointAt([point], { x: target.x + 10, y: target.y }, view, dimensions.width, dimensions.height)).toEqual(point);
        expect(studyPointAt([point], { x: target.x + 14, y: target.y }, view, dimensions.width, dimensions.height)).toBeUndefined();
    });

    it('groups separate rings at the same density level and highlights only the touched ring', () => {
        const contours: MapContour[] = [{ level: 96, segments: [
            [3000, 3000, 4000, 3000], [4000, 3000, 4000, 4000],
            [7000, 7000, 8000, 7000], [8000, 7000, 8000, 8000],
        ] }];
        const paths = studyContourPaths(contours);
        expect(paths).toHaveLength(2);
        expect(paths.map((path) => path.segments.length)).toEqual([2, 2]);
        const nearFirst = mapToScreen({ x: 3500, y: 3000 }, view, dimensions.width, dimensions.height);
        expect(studyContourAt(paths, nearFirst, view, dimensions.width, dimensions.height)).toBe(0);
        expect(studyContourAt(paths, { x: dimensions.width / 2, y: dimensions.height / 2 }, view, dimensions.width, dimensions.height)).toBeNull();
    });
});
