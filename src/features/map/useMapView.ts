import { useEffect, useMemo, useState } from 'react';
import { clampMapView, fitMapPoints, mapPointsForTag, WORLD_MAP_VIEW, type MapViewport } from '../../domain/map.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';

const viewSessions = new Map<string, MapViewport>();

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
    const [view, setViewState] = useState<MapViewport>(() => viewSessions.get(scopeKey) ?? initial);

    if (renderedScope !== scopeKey) {
        setRenderedScope(scopeKey);
        setViewState(viewSessions.get(scopeKey) ?? initial);
    }

    useEffect(() => {
        viewSessions.set(renderedScope, view);
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
