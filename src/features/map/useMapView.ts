import { useEffect, useMemo, useState } from 'react';
import { clampMapView, fitMapPoints, mapPointsForTag, WORLD_MAP_VIEW, type MapViewport } from '../../domain/map.ts';
import { MAP_READING_ZOOM } from '../../domain/mapReading.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';

const viewSessions = new Map<string, MapViewport>();
const WORLD_VIEW_KEY = 'reading-world:map:world-view:v1';

function savedWorldView(): MapViewport | null {
    try {
        const raw = sessionStorage.getItem(WORLD_VIEW_KEY);
        if (raw === null) return null;
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null) return null;
        const { centerX, centerY, zoom } = value as Record<string, unknown>;
        if (typeof centerX !== 'number' || typeof centerY !== 'number' || typeof zoom !== 'number' ||
            !Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(zoom)) return null;
        return clampMapView({ centerX, centerY, zoom });
    } catch { return null; }
}

function rememberedView(scopeKey: string, initial: MapViewport): MapViewport {
    return viewSessions.get(scopeKey) ?? (scopeKey === 'world' ? savedWorldView() : null) ?? initial;
}

function openingView(index: SnapshotIndex, tagId: string | null): MapViewport {
    return tagId === null ? WORLD_MAP_VIEW : fitMapPoints(mapPointsForTag(index, tagId));
}

export type MapViewController = {
    view: MapViewport;
    setView: (view: MapViewport) => void;
    reset: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
};

/** One remembered viewport per world / topic region for the life of the document. */
export function useMapView(index: SnapshotIndex, tagId: string | null): MapViewController {
    const scopeKey = tagId === null ? 'world' : `tag:${tagId}`;
    const initial = useMemo(() => openingView(index, tagId), [index, tagId]);
    const [renderedScope, setRenderedScope] = useState(scopeKey);
    const [view, setViewState] = useState<MapViewport>(() => rememberedView(scopeKey, initial));

    if (renderedScope !== scopeKey) {
        setRenderedScope(scopeKey);
        setViewState(rememberedView(scopeKey, initial));
    }

    useEffect(() => {
        viewSessions.set(renderedScope, view);
        if (renderedScope !== 'world') return;
        try {
            if (view.zoom >= MAP_READING_ZOOM) sessionStorage.setItem(WORLD_VIEW_KEY, JSON.stringify(view));
            else sessionStorage.removeItem(WORLD_VIEW_KEY);
        } catch { /* Storage can be blocked; the in-memory return still works. */ }
    }, [renderedScope, view]);

    const setView = (next: MapViewport): void => setViewState(clampMapView(next));
    return {
        view,
        setView,
        reset: () => setViewState(initial),
        zoomIn: () => setViewState((current) => clampMapView({ ...current, zoom: current.zoom * 1.25 })),
        zoomOut: () => setViewState((current) => clampMapView({ ...current, zoom: current.zoom / 1.25 })),
    };
}
