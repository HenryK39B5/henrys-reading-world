import { mapToScreen, type MapViewport } from './map.ts';
import type { MapPoint } from './types.ts';

export function studyPointZoomThreshold(width: number): number {
    return width < 520 ? 4 : 3;
}

/** Hit testing uses pixels, not map units; overlapping dots need visual confirmation. */
export function studyPointAt(
    points: readonly MapPoint[],
    pointer: { x: number; y: number },
    view: MapViewport,
    width: number,
    height: number,
): { point: MapPoint; ambiguous: boolean } | undefined {
    const near: Array<{ point: MapPoint; distance: number; screen: { x: number; y: number } }> = [];
    for (const point of points) {
        const screen = mapToScreen(point, view, width, height);
        const distance = Math.hypot(screen.x - pointer.x, screen.y - pointer.y);
        if (distance <= 13) near.push({ point, screen, distance });
    }
    near.sort((left, right) => left.distance - right.distance || left.point.highlightId.localeCompare(right.point.highlightId));
    const first = near[0];
    if (first === undefined) return undefined;
    const ambiguous = first.distance > 6 || near.slice(1).some(({ screen }) => Math.hypot(screen.x - first.screen.x, screen.y - first.screen.y) < 8);
    return { point: first.point, ambiguous };
}
