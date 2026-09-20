import { describe, expect, it } from 'vitest';
import { clampMapView, fitMapPoints, mapToScreen, nearestPoint, screenToMap, zoomMapViewAt } from './map.ts';
import { MAP_COORDINATE_MAX, type MapPoint } from './types.ts';

const points: MapPoint[] = [
    { highlightId: 'h-001', x: 2000, y: 3000 },
    { highlightId: 'h-002', x: 4000, y: 5000 },
];

describe('map viewport geometry', () => {
    it('fits a region without moving outside the world', () => {
        const view = fitMapPoints(points);
        expect(view.centerX).toBe(3000);
        expect(view.centerY).toBe(4000);
        expect(view.zoom).toBeGreaterThan(1);
        expect(clampMapView({ centerX: -100, centerY: MAP_COORDINATE_MAX + 100, zoom: 99 }).zoom).toBe(8);
    });

    it('round-trips screen and map coordinates', () => {
        const view = { centerX: 5000, centerY: 5000, zoom: 2 };
        const screen = mapToScreen({ x: 6200, y: 4300 }, view, 1000, 700);
        const restored = screenToMap(screen, view, 1000, 700);
        expect(restored.x).toBeCloseTo(6200);
        expect(restored.y).toBeCloseTo(4300);
    });

    it('keeps the coordinate under the pointer fixed while zooming', () => {
        const view = { centerX: 5000, centerY: 5000, zoom: 1.5 };
        const anchor = { x: 730, y: 180 };
        const before = screenToMap(anchor, view, 1000, 700);
        const zoomed = zoomMapViewAt(view, 1.8, anchor, 1000, 700);
        const after = screenToMap(anchor, zoomed, 1000, 700);
        expect(zoomed.zoom).toBeCloseTo(2.7);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });

    it('finds only points within the requested hit radius', () => {
        const view = { centerX: 3000, centerY: 4000, zoom: 2 };
        const target = mapToScreen(points[0]!, view, 1000, 700);
        expect(nearestPoint(points, target, view, 1000, 700, 10)?.highlightId).toBe('h-001');
        expect(nearestPoint(points, { x: 0, y: 0 }, view, 1000, 700, 5)).toBeUndefined();
    });
});
