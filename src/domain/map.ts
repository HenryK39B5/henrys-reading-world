import { MAP_COORDINATE_MAX, type MapLabel, type MapPoint } from './types.ts';
import type { SnapshotIndex } from './snapshot.ts';

export type MapViewport = {
    centerX: number;
    centerY: number;
    zoom: number;
};

export const WORLD_MAP_VIEW: MapViewport = {
    centerX: MAP_COORDINATE_MAX / 2,
    centerY: MAP_COORDINATE_MAX / 2,
    zoom: 1,
};

export type MapLabelSummary = {
    label: MapLabel;
    tagId: string;
    title: string;
    description?: string;
    highlightCount: number;
    bookCount: number;
};

export function mapPointsById(index: SnapshotIndex): Map<string, MapPoint> {
    return new Map((index.snapshot.map?.points ?? []).map((point) => [point.highlightId, point]));
}

export function mapPointsForTag(index: SnapshotIndex, tagId: string): MapPoint[] {
    const points = mapPointsById(index);
    return (index.highlightsByTag.get(tagId) ?? [])
        .map((highlight) => points.get(highlight.id))
        .filter((point): point is MapPoint => point !== undefined);
}

export function mapPointsForBook(index: SnapshotIndex, bookId: string): MapPoint[] {
    const points = mapPointsById(index);
    return (index.highlightsByBook.get(bookId) ?? [])
        .map((highlight) => points.get(highlight.id))
        .filter((point): point is MapPoint => point !== undefined);
}

export function summarizeMapLabels(index: SnapshotIndex): MapLabelSummary[] {
    return (index.snapshot.map?.labels ?? []).flatMap((label) => {
        const tag = index.tagsById.get(label.tagId);
        if (tag === undefined) return [];
        const highlights = index.highlightsByTag.get(label.tagId) ?? [];
        return [{
            label,
            tagId: tag.id,
            title: tag.title,
            ...(tag.description === undefined ? {} : { description: tag.description }),
            highlightCount: highlights.length,
            bookCount: new Set(highlights.map((highlight) => highlight.bookId)).size,
        }];
    });
}

export function fitMapPoints(points: readonly MapPoint[], maximumZoom = 6): MapViewport {
    if (points.length === 0) return WORLD_MAP_VIEW;
    let minX = MAP_COORDINATE_MAX;
    let maxX = 0;
    let minY = MAP_COORDINATE_MAX;
    let maxY = 0;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    const span = Math.max(900, maxX - minX, maxY - minY);
    return {
        centerX: Math.round((minX + maxX) / 2),
        centerY: Math.round((minY + maxY) / 2),
        zoom: Math.max(1, Math.min(maximumZoom, (MAP_COORDINATE_MAX * 0.72) / span)),
    };
}

export function clampMapView(view: MapViewport): MapViewport {
    const half = MAP_COORDINATE_MAX / (2 * Math.max(1, view.zoom));
    return {
        centerX: Math.max(half, Math.min(MAP_COORDINATE_MAX - half, view.centerX)),
        centerY: Math.max(half, Math.min(MAP_COORDINATE_MAX - half, view.centerY)),
        zoom: Math.max(1, Math.min(8, view.zoom)),
    };
}

export function mapToScreen(
    point: Pick<MapPoint, 'x' | 'y'>,
    view: MapViewport,
    width: number,
    height: number,
): { x: number; y: number } {
    const scale = (Math.min(width, height) / MAP_COORDINATE_MAX) * view.zoom;
    return {
        x: width / 2 + (point.x - view.centerX) * scale,
        y: height / 2 + (point.y - view.centerY) * scale,
    };
}

export function screenToMap(
    point: { x: number; y: number },
    view: MapViewport,
    width: number,
    height: number,
): { x: number; y: number } {
    const scale = (Math.min(width, height) / MAP_COORDINATE_MAX) * view.zoom;
    return {
        x: view.centerX + (point.x - width / 2) / scale,
        y: view.centerY + (point.y - height / 2) / scale,
    };
}

/** Zoom while keeping the map coordinate beneath an on-screen anchor stationary. */
export function zoomMapViewAt(
    view: MapViewport,
    factor: number,
    anchor: { x: number; y: number },
    width: number,
    height: number,
): MapViewport {
    const mapAnchor = screenToMap(anchor, view, width, height);
    const zoom = Math.max(1, Math.min(8, view.zoom * factor));
    const scale = (Math.min(width, height) / MAP_COORDINATE_MAX) * zoom;
    return clampMapView({
        zoom,
        centerX: mapAnchor.x - (anchor.x - width / 2) / scale,
        centerY: mapAnchor.y - (anchor.y - height / 2) / scale,
    });
}

export function nearestPoint(
    points: readonly MapPoint[],
    target: { x: number; y: number },
    view: MapViewport,
    width: number,
    height: number,
    maximumPixels: number,
): MapPoint | undefined {
    let nearest: MapPoint | undefined;
    let distanceSquared = maximumPixels * maximumPixels;
    for (const point of points) {
        const screen = mapToScreen(point, view, width, height);
        const dx = screen.x - target.x;
        const dy = screen.y - target.y;
        const candidate = dx * dx + dy * dy;
        if (candidate <= distanceSquared) {
            nearest = point;
            distanceSquared = candidate;
        }
    }
    return nearest;
}
