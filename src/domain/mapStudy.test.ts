import { describe, expect, it } from 'vitest';
import { mapToScreen } from './map.ts';
import { studyPointAt, studyPointZoomThreshold } from './mapStudy.ts';
import type { MapPoint } from './types.ts';

const view = { centerX: 5000, centerY: 5000, zoom: 4 };
const dimensions = { width: 390, height: 620 };
const point: MapPoint = { highlightId: 'h-001', x: 5000, y: 5000 };

describe('study point selection', () => {
    it('unlocks at a pixel-aware viewport threshold', () => {
        expect(studyPointZoomThreshold(390)).toBe(4);
        expect(studyPointZoomThreshold(1360)).toBe(3);
    });

    it('opens only an isolated point on the first tap', () => {
        const target = mapToScreen(point, view, dimensions.width, dimensions.height);
        const second: MapPoint = { highlightId: 'h-002', x: 5300, y: 5000 };
        expect(studyPointAt([point, second], target, view, dimensions.width, dimensions.height)).toEqual({ point, ambiguous: false });
        expect(studyPointAt([point], { x: 0, y: 0 }, view, dimensions.width, dimensions.height)).toBeUndefined();
    });

    it('requires confirmation when a touch is near but not centered on a dot', () => {
        const target = mapToScreen(point, view, dimensions.width, dimensions.height);
        expect(studyPointAt([point], { x: target.x + 10, y: target.y }, view, dimensions.width, dimensions.height)).toEqual({ point, ambiguous: true });
        expect(studyPointAt([point], { x: target.x + 14, y: target.y }, view, dimensions.width, dimensions.height)).toBeUndefined();
    });

    it('flags close positions and breaks exact-coordinate ties by stable id', () => {
        const sameSpot: MapPoint = { highlightId: 'h-002', x: 5000, y: 5000 };
        const target = mapToScreen(point, view, dimensions.width, dimensions.height);
        expect(studyPointAt([sameSpot, point], target, view, dimensions.width, dimensions.height)).toEqual({ point, ambiguous: true });
    });
});
