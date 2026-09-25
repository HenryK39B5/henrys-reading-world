import { mapToScreen, type MapViewport } from './map.ts';
import type { MapContour, MapPoint } from './types.ts';

export function studyPointZoomThreshold(width: number): number {
    return width < 520 ? 4 : 3;
}

/** Nearby real points are exploratory targets: closest screen position wins. */
export function studyPointAt(
    points: readonly MapPoint[],
    pointer: { x: number; y: number },
    view: MapViewport,
    width: number,
    height: number,
    maximumPixels = 13,
): MapPoint | undefined {
    let nearest: MapPoint | undefined;
    let distanceSquared = maximumPixels * maximumPixels;
    for (const point of points) {
        const screen = mapToScreen(point, view, width, height);
        const dx = screen.x - pointer.x;
        const dy = screen.y - pointer.y;
        const candidate = dx * dx + dy * dy;
        if (candidate < distanceSquared || (candidate === distanceSquared && point.highlightId < (nearest?.highlightId ?? ''))) {
            nearest = point;
            distanceSquared = candidate;
        }
    }
    return nearest;
}

export type StudyContourPath = { level: number; segments: number[][] };

/** Separate connected contours within each level so hover never lights unrelated hills. */
export function studyContourPaths(contours: readonly MapContour[]): StudyContourPath[] {
    const paths: StudyContourPath[] = [];
    for (const contour of contours) {
        const neighbours = new Map<string, number[]>();
        contour.segments.forEach((segment, index) => {
            const [x0, y0, x1, y1] = segment;
            if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) return;
            for (const key of [`${String(x0)},${String(y0)}`, `${String(x1)},${String(y1)}`]) {
                const entries = neighbours.get(key) ?? [];
                entries.push(index);
                neighbours.set(key, entries);
            }
        });
        const visited = new Set<number>();
        contour.segments.forEach((segment, index) => {
            if (visited.has(index) || segment.length !== 4) return;
            const pending = [index];
            const connected: number[][] = [];
            visited.add(index);
            while (pending.length > 0) {
                const current = contour.segments[pending.pop() ?? -1];
                if (current === undefined) continue;
                connected.push(current);
                for (const key of [`${String(current[0])},${String(current[1])}`, `${String(current[2])},${String(current[3])}`]) {
                    for (const next of neighbours.get(key) ?? []) {
                        if (visited.has(next)) continue;
                        visited.add(next);
                        pending.push(next);
                    }
                }
            }
            paths.push({ level: contour.level, segments: connected });
        });
    }
    return paths;
}

/** Pixel-space distance to a segment, including its endpoints. */
function segmentDistanceSquared(
    pointer: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((pointer.x - start.x) * dx + (pointer.y - start.y) * dy) / lengthSquared));
    return (pointer.x - start.x - t * dx) ** 2 + (pointer.y - start.y - t * dy) ** 2;
}

export function studyContourAt(
    paths: readonly StudyContourPath[],
    pointer: { x: number; y: number },
    view: MapViewport,
    width: number,
    height: number,
    maximumPixels = 4,
): number | null {
    let chosen: number | null = null;
    let nearest = maximumPixels * maximumPixels;
    paths.forEach((path, index) => {
        for (const [x0, y0, x1, y1] of path.segments) {
            if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) continue;
            const start = mapToScreen({ x: x0, y: y0 }, view, width, height);
            const end = mapToScreen({ x: x1, y: y1 }, view, width, height);
            const distance = segmentDistanceSquared(pointer, start, end);
            if (distance < nearest) { nearest = distance; chosen = index; }
        }
    });
    return chosen;
}
