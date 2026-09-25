import { useEffect, useMemo, useRef, useState } from 'react';
import {
    clampMapView,
    mapPointsForBook,
    mapPointsForTag,
    mapToScreen,
    nearestPoint,
    screenToMap,
    summarizeMapLabels,
    zoomMapViewAt,
    type MapViewport,
} from '../../domain/map.ts';
import { studyContourAt, studyContourPaths, studyPointAt, studyPointZoomThreshold } from '../../domain/mapStudy.ts';
import { MAP_COORDINATE_MAX } from '../../domain/types.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { placeMapLabels, visibleMapLabels, type LabelPlacement } from './labelPlacement.ts';
import { MapStudyTerrain, type MapStudyData } from './MapStudyTerrain.tsx';

export type MapCanvasProps = {
    index: SnapshotIndex;
    view: MapViewport;
    onViewChange: (view: MapViewport) => void;
    activeTagId: string | null;
    activeBookId: string | null;
    activeHighlightId: string | null;
    bookAccent: string;
    highlightAccent: string;
    onSelectTag: (tagId: string) => void;
    onSelectHighlight: (highlightId: string) => void;
};

type Size = { width: number; height: number };

type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    view: MapViewport;
    moved: boolean;
};

type PinchState = {
    startDistance: number;
    startView: MapViewport;
    anchorMap: { x: number; y: number };
};

function midpoint(left: { x: number; y: number }, right: { x: number; y: number }): { x: number; y: number } {
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
    return Math.hypot(left.x - right.x, left.y - right.y);
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
}

export function MapCanvas({
    index,
    view,
    onViewChange,
    activeTagId,
    activeBookId,
    activeHighlightId,
    bookAccent,
    highlightAccent,
    onSelectTag,
    onSelectHighlight,
}: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelHits = useRef<LabelPlacement[]>([]);
    const drag = useRef<DragState | null>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const pinch = useRef<PinchState | null>(null);
    const gestureMoved = useRef(false);
    const [size, setSize] = useState<Size>({ width: 1, height: 1 });
    const [hoverText, setHoverText] = useState('');
    const [study, setStudy] = useState<MapStudyData | null>(null);
    const [hoverTarget, setHoverTarget] = useState<{ kind: 'point' | 'label'; id: string } | { kind: 'contour'; index: number } | null>(null);
    const zoomFrame = useRef<number | null>(null);
    const wheelState = useRef({ view, onViewChange, size });
    wheelState.current = { view, onViewChange, size };
    const layout = useMemo(() => {
        const base = index.snapshot.map;
        return base === undefined || !__MAP_STUDY__ || study === null
            ? base
            : { ...base, density: study.density, contours: study.contours };
    }, [index.snapshot.map, study]);
    const contourPaths = useMemo(() => __MAP_STUDY__ && study !== null ? studyContourPaths(study.contours) : [], [study]);
    const labels = useMemo(() => summarizeMapLabels(index), [index]);
    const tagPoints = useMemo(
        () => (activeTagId === null ? [] : mapPointsForTag(index, activeTagId)),
        [activeTagId, index],
    );
    const bookPoints = useMemo(
        () => (activeBookId === null ? [] : mapPointsForBook(index, activeBookId)),
        [activeBookId, index],
    );
    const interactivePoints = activeTagId !== null ? tagPoints : bookPoints;
    const tagPointIds = useMemo(() => new Set(tagPoints.map((point) => point.highlightId)), [tagPoints]);
    const bookPointIds = useMemo(() => new Set(bookPoints.map((point) => point.highlightId)), [bookPoints]);

    useEffect(() => {
        if (!__MAP_STUDY__) return;
        const controller = new AbortController();
        void fetch('/__map_study', { cache: 'no-store', signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Map study field unavailable');
                return response.json() as Promise<MapStudyData>;
            })
            .then((value) => { if (!controller.signal.aborted) setStudy(value); })
            .catch(() => { /* The ordinary map stays usable if the local study artifact is missing. */ });
        return () => controller.abort();
    }, []);

    useEffect(() => () => { if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current); }, []);
    useEffect(() => { if (__MAP_STUDY__) setHoverTarget(null); }, [view.centerX, view.centerY, view.zoom]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry === undefined) return;
            setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) return;
        const handleWheel = (event: WheelEvent): void => {
            if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
            if (__MAP_STUDY__) setHoverTarget(null);
            const current = wheelState.current;
            const rect = canvas.getBoundingClientRect();
            const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
            const next = zoomMapViewAt(current.view, factor, anchor, current.size.width, current.size.height);
            if (next.zoom === current.view.zoom) return;
            event.preventDefault();
            current.onViewChange(next);
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null || layout === undefined) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);

        const wash = ctx.createRadialGradient(
            size.width * 0.54,
            size.height * 0.44,
            0,
            size.width * 0.54,
            size.height * 0.44,
            Math.max(size.width, size.height) * 0.72,
        );
        wash.addColorStop(0, 'rgba(135, 171, 142, 0.10)');
        wash.addColorStop(0.64, 'rgba(135, 171, 142, 0.025)');
        wash.addColorStop(1, 'rgba(135, 171, 142, 0)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, size.width, size.height);

        ctx.beginPath();
        for (let coordinate = 1000; coordinate < MAP_COORDINATE_MAX; coordinate += 1000) {
            const verticalStart = mapToScreen({ x: coordinate, y: 0 }, view, size.width, size.height);
            const horizontalStart = mapToScreen({ x: 0, y: coordinate }, view, size.width, size.height);
            if (__MAP_STUDY__ && study !== null) {
                if (verticalStart.x >= 5 && verticalStart.x <= size.width - 5) {
                    for (let other = 1000; other < MAP_COORDINATE_MAX; other += 1000) {
                        const crossing = mapToScreen({ x: coordinate, y: other }, view, size.width, size.height);
                        if (crossing.y < 5 || crossing.y > size.height - 5) continue;
                        const radius = size.width < 520 ? 2.4 : 3;
                        ctx.moveTo(crossing.x - radius, crossing.y);
                        ctx.lineTo(crossing.x + radius, crossing.y);
                        ctx.moveTo(crossing.x, crossing.y - radius);
                        ctx.lineTo(crossing.x, crossing.y + radius);
                    }
                }
            } else {
                const verticalEnd = mapToScreen({ x: coordinate, y: MAP_COORDINATE_MAX }, view, size.width, size.height);
                const horizontalEnd = mapToScreen({ x: MAP_COORDINATE_MAX, y: coordinate }, view, size.width, size.height);
                ctx.moveTo(verticalStart.x, verticalStart.y);
                ctx.lineTo(verticalEnd.x, verticalEnd.y);
                ctx.moveTo(horizontalStart.x, horizontalStart.y);
                ctx.lineTo(horizontalEnd.x, horizontalEnd.y);
            }
        }
        ctx.strokeStyle = __MAP_STUDY__ && study !== null ? 'rgba(181, 198, 178, 0.16)' : 'rgba(155, 181, 153, 0.035)';
        ctx.lineWidth = __MAP_STUDY__ && study !== null ? 0.9 : 0.6;
        ctx.stroke();

        if (!__MAP_STUDY__ || study === null) {
            const { density } = layout;
            for (let row = 0; row < density.rows; row += 1) {
                for (let column = 0; column < density.columns; column += 1) {
                    const value = density.values[row * density.columns + column] ?? 0;
                    if (value < 18) continue;
                    const start = mapToScreen({
                        x: (column / (density.columns - 1)) * MAP_COORDINATE_MAX,
                        y: (row / (density.rows - 1)) * MAP_COORDINATE_MAX,
                    }, view, size.width, size.height);
                    const end = mapToScreen({
                        x: ((column + 1) / (density.columns - 1)) * MAP_COORDINATE_MAX,
                        y: ((row + 1) / (density.rows - 1)) * MAP_COORDINATE_MAX,
                    }, view, size.width, size.height);
                    ctx.fillStyle = `rgba(135, 171, 142, ${String((value / 255) * 0.16)})`;
                    ctx.fillRect(start.x, start.y, end.x - start.x + 1, end.y - start.y + 1);
                }
            }
        }

        for (const contour of layout.contours) {
            ctx.beginPath();
            for (const segment of contour.segments) {
                const start = mapToScreen({ x: segment[0] ?? 0, y: segment[1] ?? 0 }, view, size.width, size.height);
                const end = mapToScreen({ x: segment[2] ?? 0, y: segment[3] ?? 0 }, view, size.width, size.height);
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
            }
            ctx.strokeStyle = contour.level >= 150 ? 'rgba(132, 175, 143, 0.38)' : 'rgba(155, 181, 153, 0.19)';
            ctx.lineWidth = contour.level >= 150 ? 1.2 : 0.75;
            ctx.stroke();
        }

        if (__MAP_STUDY__ && hoverTarget?.kind === 'contour') {
            const path = contourPaths[hoverTarget.index];
            if (path !== undefined) {
                ctx.beginPath();
                for (const segment of path.segments) {
                    const start = mapToScreen({ x: segment[0] ?? 0, y: segment[1] ?? 0 }, view, size.width, size.height);
                    const end = mapToScreen({ x: segment[2] ?? 0, y: segment[3] ?? 0 }, view, size.width, size.height);
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                }
                ctx.strokeStyle = 'rgba(191, 216, 178, 0.09)';
                ctx.lineWidth = 3.5;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(205, 227, 188, 0.65)';
                ctx.lineWidth = 1.25;
                ctx.stroke();
            }
        }

        ctx.beginPath();
        for (const point of layout.points) {
            if (tagPointIds.has(point.highlightId) || bookPointIds.has(point.highlightId) || point.highlightId === activeHighlightId) continue;
            const screen = mapToScreen(point, view, size.width, size.height);
            if (screen.x < -3 || screen.y < -3 || screen.x > size.width + 3 || screen.y > size.height + 3) continue;
            drawCircle(ctx, screen.x, screen.y, view.zoom > 2 ? 1.35 : 1.05);
        }
        ctx.fillStyle = activeTagId === null && activeBookId === null ? 'rgba(183, 202, 177, 0.36)' : 'rgba(183, 202, 177, 0.13)';
        ctx.fill();

        if (tagPoints.length > 0) {
            ctx.beginPath();
            for (const point of tagPoints) {
                const screen = mapToScreen(point, view, size.width, size.height);
                drawCircle(ctx, screen.x, screen.y, 2.45);
            }
            ctx.fillStyle = 'rgba(235, 232, 211, 0.88)';
            ctx.fill();

            ctx.beginPath();
            for (const point of tagPoints) {
                const highlight = index.highlightsById.get(point.highlightId);
                if ((highlight?.tagIds.length ?? 0) < 2) continue;
                const screen = mapToScreen(point, view, size.width, size.height);
                ctx.moveTo(screen.x + 4.4, screen.y);
                ctx.arc(screen.x, screen.y, 4.4, 0, Math.PI * 2);
            }
            ctx.strokeStyle = 'rgba(185, 208, 171, 0.70)';
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }

        if (bookPoints.length > 0) {
            // Draw every real position. At world scale, 531 neighbouring opaque discs would merge into
            // a false-looking solid territory; smaller translucent marks keep density legible instead.
            const denseAtWorldScale = bookPoints.length > 200 && view.zoom < 1.5;
            ctx.save();
            ctx.beginPath();
            for (const point of bookPoints) {
                const screen = mapToScreen(point, view, size.width, size.height);
                drawCircle(ctx, screen.x, screen.y, denseAtWorldScale ? 1.55 : 3.25);
            }
            ctx.shadowColor = bookAccent;
            ctx.shadowBlur = denseAtWorldScale ? 0 : 3;
            ctx.globalAlpha = denseAtWorldScale ? 0.58 : 1;
            ctx.fillStyle = bookAccent;
            ctx.fill();
            ctx.restore();
        }

        if (__MAP_STUDY__ && hoverTarget?.kind === 'point' && hoverTarget.id !== activeHighlightId) {
            const hovered = layout.points.find((point) => point.highlightId === hoverTarget.id);
            if (hovered !== undefined) {
                const screen = mapToScreen(hovered, view, size.width, size.height);
                const glow = ctx.createRadialGradient(screen.x, screen.y, 1, screen.x, screen.y, 12);
                glow.addColorStop(0, 'rgba(233, 224, 183, 0.34)');
                glow.addColorStop(1, 'rgba(233, 224, 183, 0)');
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 12, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 2.6, 0, Math.PI * 2);
                ctx.fillStyle = '#e7dfba';
                ctx.fill();
            }
        }

        if (activeHighlightId !== null) {
            const active = layout.points.find((point) => point.highlightId === activeHighlightId);
            if (active !== undefined) {
                const screen = mapToScreen(active, view, size.width, size.height);
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = __MAP_STUDY__ && study !== null ? '#f0ead8' : highlightAccent;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 2.4, 0, Math.PI * 2);
                ctx.fillStyle = '#eee8d9';
                ctx.fill();
            }
        }

        const placedLabels = placeMapLabels(labels, activeTagId, view.zoom, size, (title, active) => {
            ctx.font = `${active ? '600 16px' : '400 13px'} system-ui, "Microsoft YaHei", sans-serif`;
            return ctx.measureText(title).width;
        }, __MAP_STUDY__ && study !== null);
        const visibleLabels = visibleMapLabels(placedLabels, view.centerX, view.centerY, view.zoom, size);
        for (const hit of visibleLabels) {
            const active = hit.summary.tagId === activeTagId;
            const placeName = __MAP_STUDY__ && study !== null;
            const hovered = placeName && hoverTarget?.kind === 'label' && hoverTarget.id === hit.summary.tagId;
            const width = hit.right - hit.left - 16;
            ctx.font = `${active ? '600 16px' : '400 13px'} system-ui, "Microsoft YaHei", sans-serif`;
            if (placeName) {
                if (Math.abs(hit.x - hit.anchorX) + Math.abs(hit.y + 10 - hit.anchorY) > 5) {
                    ctx.beginPath();
                    ctx.moveTo(hit.anchorX, hit.anchorY);
                    ctx.lineTo(hit.x, hit.y + 8);
                    ctx.strokeStyle = 'rgba(185, 203, 174, 0.54)';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(hit.anchorX, hit.anchorY, 1.7, 0, Math.PI * 2);
                ctx.fillStyle = hovered || active ? '#e9d6a8' : 'rgba(199, 218, 182, 0.82)';
                ctx.fill();
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(22, 36, 31, 0.97)';
                ctx.shadowColor = 'rgba(14, 27, 23, 0.9)';
                ctx.shadowBlur = 5;
                ctx.strokeText(hit.summary.title, hit.x, hit.y);
                ctx.shadowBlur = 0;
                ctx.fillStyle = active || hovered ? '#f7efd9' : '#dce7d4';
                ctx.fillText(hit.summary.title, hit.x, hit.y);
                ctx.restore();
            } else {
                if (Math.abs(hit.x - hit.anchorX) + Math.abs(hit.y - hit.anchorY) > 5) {
                    ctx.beginPath();
                    ctx.moveTo(hit.anchorX, hit.anchorY);
                    ctx.lineTo(hit.x, hit.y);
                    ctx.strokeStyle = 'rgba(164, 190, 157, 0.36)';
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
                ctx.fillStyle = active ? 'rgba(39, 55, 47, 0.96)' : 'rgba(28, 43, 38, 0.90)';
                ctx.fillRect(hit.left + 1, hit.top + 1, hit.right - hit.left - 2, hit.bottom - hit.top - 2);
                ctx.fillStyle = active ? '#f2ebd8' : 'rgba(224, 232, 209, 0.92)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(hit.summary.title, hit.x, hit.y);
            }
            if (active || hovered) {
                ctx.beginPath();
                if (placeName) {
                    const half = Math.min(width / 2, 14);
                    ctx.moveTo(hit.x - half, hit.y + 10);
                    ctx.lineTo(hit.x - 4, hit.y + 10);
                    ctx.moveTo(hit.x + 4, hit.y + 10);
                    ctx.lineTo(hit.x + half, hit.y + 10);
                } else {
                    ctx.moveTo(hit.x - width / 2, hit.y + 11);
                    ctx.lineTo(hit.x + width / 2, hit.y + 11);
                }
                ctx.strokeStyle = active ? '#c9ae80' : '#e7dfba';
                ctx.lineWidth = active ? 1.5 : 1;
                ctx.stroke();
            }
        }
        labelHits.current = visibleLabels;
    }, [activeBookId, activeHighlightId, activeTagId, bookAccent, highlightAccent, bookPointIds, bookPoints, contourPaths, hoverTarget, index, labels, layout, size, study, tagPointIds, tagPoints, view]);

    const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const labelAt = (position: { x: number; y: number }): LabelPlacement | undefined =>
        labelHits.current.find((hit) =>
            (position.x >= hit.left && position.x <= hit.right && position.y >= hit.top && position.y <= hit.bottom)
            || (__MAP_STUDY__ && study !== null && Math.hypot(position.x - hit.anchorX, position.y - hit.anchorY) <= 7),
        );

    const animateStudyZoom = (position: { x: number; y: number }): void => {
        if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
        const initial = view;
        const nextZoom = Math.min(8, initial.zoom * 1.8);
        if (nextZoom <= initial.zoom) return;
        const apply = (zoom: number): void => onViewChange(zoomMapViewAt(initial, zoom / initial.zoom, position, size.width, size.height));
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(nextZoom); return; }
        const start = performance.now();
        const step = (now: number): void => {
            const progress = Math.min(1, (now - start) / 210);
            apply(initial.zoom + (nextZoom - initial.zoom) * (1 - (1 - progress) ** 3));
            zoomFrame.current = progress < 1 ? requestAnimationFrame(step) : null;
        };
        zoomFrame.current = requestAnimationFrame(step);
    };

    return (
        <div className="map-canvas-wrap" data-map-study={__MAP_STUDY__ && study !== null ? 'ready' : undefined}>
            {__MAP_STUDY__ && study !== null ? <MapStudyTerrain data={study} view={view} width={size.width} height={size.height} /> : null}
            <canvas
                ref={canvasRef}
                className="map-canvas"
                data-testid="map-canvas"
                data-map-center-x={String(Math.round(view.centerX))}
                data-map-center-y={String(Math.round(view.centerY))}
                data-map-zoom={view.zoom.toFixed(3)}
                data-map-hover-point={__MAP_STUDY__ && hoverTarget?.kind === 'point' ? hoverTarget.id : undefined}
                data-map-hover-label={__MAP_STUDY__ && hoverTarget?.kind === 'label' ? hoverTarget.id : undefined}
                data-map-hover-contour={__MAP_STUDY__ && hoverTarget?.kind === 'contour' ? String(hoverTarget.index) : undefined}
                role="img"
                tabIndex={0}
                aria-label="阅读世界地图。可拖动、滚轮缩放或双指缩放；键盘访客可使用地图下方的主题区域与划线列表。"
                onPointerDown={(event) => {
                    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
                    if (__MAP_STUDY__) setHoverTarget(null);
                    const position = pointerPosition(event);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointers.current.set(event.pointerId, position);
                    if (pointers.current.size === 1) {
                        drag.current = { pointerId: event.pointerId, startX: position.x, startY: position.y, view, moved: false };
                        gestureMoved.current = false;
                    } else if (pointers.current.size === 2) {
                        const [left, right] = [...pointers.current.values()];
                        if (left !== undefined && right !== undefined) {
                            const anchor = midpoint(left, right);
                            pinch.current = {
                                startDistance: Math.max(1, distance(left, right)),
                                startView: view,
                                anchorMap: screenToMap(anchor, view, size.width, size.height),
                            };
                            drag.current = null;
                            gestureMoved.current = true;
                        }
                    }
                }}
                onPointerMove={(event) => {
                    const position = pointerPosition(event);
                    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, position);
                    const currentPinch = pinch.current;
                    if (currentPinch !== null && pointers.current.size >= 2) {
                        const [left, right] = [...pointers.current.values()];
                        if (left !== undefined && right !== undefined) {
                            const anchor = midpoint(left, right);
                            const zoom = Math.max(1, Math.min(8, currentPinch.startView.zoom * (distance(left, right) / currentPinch.startDistance)));
                            const scale = (Math.min(size.width, size.height) / MAP_COORDINATE_MAX) * zoom;
                            onViewChange(clampMapView({
                                zoom,
                                centerX: currentPinch.anchorMap.x - (anchor.x - size.width / 2) / scale,
                                centerY: currentPinch.anchorMap.y - (anchor.y - size.height / 2) / scale,
                            }));
                        }
                        event.currentTarget.style.cursor = 'grabbing';
                        return;
                    }
                    const currentDrag = drag.current;
                    if (currentDrag !== null && currentDrag.pointerId === event.pointerId) {
                        const dx = position.x - currentDrag.startX;
                        const dy = position.y - currentDrag.startY;
                        if (__MAP_STUDY__ && !currentDrag.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
                        if (Math.abs(dx) + Math.abs(dy) > 3) {
                            currentDrag.moved = true;
                            gestureMoved.current = true;
                            if (__MAP_STUDY__) setHoverTarget(null);
                        }
                        const startMap = screenToMap({ x: 0, y: 0 }, currentDrag.view, size.width, size.height);
                        const movedMap = screenToMap({ x: dx, y: dy }, currentDrag.view, size.width, size.height);
                        onViewChange(clampMapView({
                            ...currentDrag.view,
                            centerX: currentDrag.view.centerX - (movedMap.x - startMap.x),
                            centerY: currentDrag.view.centerY - (movedMap.y - startMap.y),
                        }));
                        event.currentTarget.style.cursor = 'grabbing';
                        return;
                    }
                    if (__MAP_STUDY__ && event.pointerType === 'touch') return;
                    const label = labelAt(position);
                    if (label !== undefined) {
                        if (__MAP_STUDY__ && study !== null) setHoverTarget((current) => current?.kind === 'label' && current.id === label.summary.tagId ? current : { kind: 'label', id: label.summary.tagId });
                        const definition = label.summary.description === undefined ? '' : `；${label.summary.description}`;
                        setHoverText(`${label.summary.title}：${String(label.summary.bookCount)} 本书，${String(label.summary.highlightCount)} 处已标注划线${definition}`);
                        event.currentTarget.style.cursor = 'pointer';
                        return;
                    }
                    const points = __MAP_STUDY__ && study !== null && activeTagId === null && activeBookId === null
                        ? layout?.points ?? [] : interactivePoints;
                    const point = __MAP_STUDY__ && study !== null
                        ? studyPointAt(points, position, view, size.width, size.height)
                        : nearestPoint(points, position, view, size.width, size.height, 11);
                    if (point !== undefined) {
                        if (__MAP_STUDY__ && study !== null) {
                            setHoverTarget((current) => current?.kind === 'point' && current.id === point.highlightId ? current : { kind: 'point', id: point.highlightId });
                        }
                        const highlight = index.highlightsById.get(point.highlightId);
                        const book = highlight === undefined ? undefined : index.booksById.get(highlight.bookId);
                        setHoverText(book === undefined ? '一处划线' : `《${book.title}》的一处划线`);
                        event.currentTarget.style.cursor = __MAP_STUDY__ && study !== null && activeTagId === null && activeBookId === null && view.zoom < studyPointZoomThreshold(size.width)
                            ? 'zoom-in' : 'pointer';
                    } else {
                        const contour = __MAP_STUDY__ && study !== null
                            ? studyContourAt(contourPaths, position, view, size.width, size.height) : null;
                        if (contour !== null) {
                            setHoverTarget((current) => current?.kind === 'contour' && current.index === contour ? current : { kind: 'contour', index: contour });
                            setHoverText('');
                        } else {
                            if (__MAP_STUDY__) setHoverTarget(null);
                            setHoverText('');
                        }
                        event.currentTarget.style.cursor = 'grab';
                    }
                }}
                onPointerUp={(event) => {
                    const position = pointerPosition(event);
                    const moved = gestureMoved.current || drag.current?.moved === true || pinch.current !== null;
                    pointers.current.delete(event.pointerId);
                    drag.current = null;
                    if (pointers.current.size < 2) pinch.current = null;
                    if (pointers.current.size === 1) {
                        const [remaining] = pointers.current.entries();
                        if (remaining !== undefined) {
                            drag.current = {
                                pointerId: remaining[0],
                                startX: remaining[1].x,
                                startY: remaining[1].y,
                                view,
                                moved: true,
                            };
                        }
                        return;
                    }
                    gestureMoved.current = false;
                    if (moved) return;
                    const label = labelAt(position);
                    if (label !== undefined) {
                        if (__MAP_STUDY__) setHoverTarget(null);
                        onSelectTag(label.summary.tagId);
                        return;
                    }
                    if (__MAP_STUDY__ && study !== null && activeTagId === null && activeBookId === null && layout !== undefined) {
                        const point = studyPointAt(layout.points, position, view, size.width, size.height);
                        if (point === undefined) { setHoverTarget(null); setHoverText(''); return; }
                        if (view.zoom < studyPointZoomThreshold(size.width)) {
                            setHoverTarget(null);
                            animateStudyZoom(position);
                            return;
                        }
                        setHoverTarget(null);
                        onSelectHighlight(point.highlightId);
                        return;
                    }
                    const point = nearestPoint(interactivePoints, position, view, size.width, size.height, 13);
                    if (point !== undefined) onSelectHighlight(point.highlightId);
                }}
                onPointerCancel={(event) => {
                    pointers.current.delete(event.pointerId);
                    drag.current = null;
                    pinch.current = null;
                    gestureMoved.current = false;
                    if (__MAP_STUDY__) setHoverTarget(null);
                }}
                onPointerLeave={(event) => {
                    if (drag.current === null) setHoverText('');
                    if (__MAP_STUDY__) setHoverTarget(null);
                    event.currentTarget.style.cursor = 'grab';
                }}
                onKeyDown={(event) => {
                    const step = 500 / view.zoom;
                    if (event.key === 'ArrowLeft') onViewChange(clampMapView({ ...view, centerX: view.centerX - step }));
                    else if (event.key === 'ArrowRight') onViewChange(clampMapView({ ...view, centerX: view.centerX + step }));
                    else if (event.key === 'ArrowUp') onViewChange(clampMapView({ ...view, centerY: view.centerY - step }));
                    else if (event.key === 'ArrowDown') onViewChange(clampMapView({ ...view, centerY: view.centerY + step }));
                    else if (event.key === '+' || event.key === '=') onViewChange(clampMapView({ ...view, zoom: view.zoom * 1.2 }));
                    else if (event.key === '-') onViewChange(clampMapView({ ...view, zoom: view.zoom / 1.2 }));
                    else return;
                    event.preventDefault();
                }}
            />
            <p className="map-hover-readout" aria-live="polite">{hoverText}</p>
        </div>
    );
}
