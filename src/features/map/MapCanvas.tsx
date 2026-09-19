import { useEffect, useMemo, useRef, useState } from 'react';
import {
    clampMapView,
    mapPointsForBook,
    mapPointsForTag,
    mapToScreen,
    nearestPoint,
    screenToMap,
    summarizeMapLabels,
    type MapLabelSummary,
    type MapViewport,
} from '../../domain/map.ts';
import { MAP_COORDINATE_MAX } from '../../domain/types.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';

export type MapCanvasProps = {
    index: SnapshotIndex;
    view: MapViewport;
    onViewChange: (view: MapViewport) => void;
    activeTagId: string | null;
    activeBookId: string | null;
    activeHighlightId: string | null;
    bookAccent: string;
    onSelectTag: (tagId: string) => void;
    onSelectHighlight: (highlightId: string) => void;
};

type Size = { width: number; height: number };
type LabelHit = { summary: MapLabelSummary; left: number; top: number; right: number; bottom: number };

type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    view: MapViewport;
    moved: boolean;
};

function overlaps(left: LabelHit, right: LabelHit): boolean {
    return !(left.right + 8 < right.left || right.right + 8 < left.left || left.bottom + 5 < right.top || right.bottom + 5 < left.top);
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
    onSelectTag,
    onSelectHighlight,
}: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelHits = useRef<LabelHit[]>([]);
    const drag = useRef<DragState | null>(null);
    const [size, setSize] = useState<Size>({ width: 1, height: 1 });
    const [hoverText, setHoverText] = useState('');
    const layout = index.snapshot.map;
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
        if (canvas === null || layout === undefined) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);

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
                ctx.fillStyle = `rgba(49, 95, 75, ${String((value / 255) * 0.065)})`;
                ctx.fillRect(start.x, start.y, end.x - start.x + 1, end.y - start.y + 1);
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
            ctx.strokeStyle = contour.level >= 150 ? 'rgba(49, 95, 75, 0.22)' : 'rgba(96, 100, 93, 0.14)';
            ctx.lineWidth = contour.level >= 150 ? 1.15 : 0.75;
            ctx.stroke();
        }

        ctx.beginPath();
        for (const point of layout.points) {
            if (tagPointIds.has(point.highlightId) || bookPointIds.has(point.highlightId) || point.highlightId === activeHighlightId) continue;
            const screen = mapToScreen(point, view, size.width, size.height);
            if (screen.x < -3 || screen.y < -3 || screen.x > size.width + 3 || screen.y > size.height + 3) continue;
            drawCircle(ctx, screen.x, screen.y, view.zoom > 2 ? 1.35 : 1.05);
        }
        ctx.fillStyle = activeTagId === null && activeBookId === null ? 'rgba(32, 35, 31, 0.30)' : 'rgba(32, 35, 31, 0.12)';
        ctx.fill();

        if (tagPoints.length > 0) {
            ctx.beginPath();
            for (const point of tagPoints) {
                const screen = mapToScreen(point, view, size.width, size.height);
                drawCircle(ctx, screen.x, screen.y, 2.35);
            }
            ctx.fillStyle = 'rgba(32, 35, 31, 0.82)';
            ctx.fill();
        }

        if (bookPoints.length > 0) {
            ctx.beginPath();
            for (const point of bookPoints) {
                const screen = mapToScreen(point, view, size.width, size.height);
                drawCircle(ctx, screen.x, screen.y, 3.1);
            }
            ctx.fillStyle = bookAccent;
            ctx.fill();
        }

        if (activeHighlightId !== null) {
            const active = layout.points.find((point) => point.highlightId === activeHighlightId);
            if (active !== undefined) {
                const screen = mapToScreen(active, view, size.width, size.height);
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = bookAccent;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 2.4, 0, Math.PI * 2);
                ctx.fillStyle = '#20231f';
                ctx.fill();
            }
        }

        const visibleLabels: LabelHit[] = [];
        const activeLabel = labels.find((entry) => entry.tagId === activeTagId);
        const ordered = [...labels].sort((left, right) => {
            if (left.tagId === activeTagId) return -1;
            if (right.tagId === activeTagId) return 1;
            return right.highlightCount - left.highlightCount;
        });
        const maximumLabels = size.width < 520 ? 10 : view.zoom > 2 ? 16 : 22;
        for (const summary of ordered) {
            if (visibleLabels.length >= maximumLabels && summary.tagId !== activeTagId) break;
            if (activeLabel !== undefined && view.zoom > 1.4 && summary.tagId !== activeTagId) {
                const dx = summary.label.x - activeLabel.label.x;
                const dy = summary.label.y - activeLabel.label.y;
                if (Math.sqrt(dx * dx + dy * dy) > 2800) continue;
            }
            const screen = mapToScreen(summary.label, view, size.width, size.height);
            if (screen.x < 24 || screen.y < 22 || screen.x > size.width - 24 || screen.y > size.height - 22) continue;
            const active = summary.tagId === activeTagId;
            ctx.font = `${active ? '600 16px' : '400 13px'} system-ui, "Microsoft YaHei", sans-serif`;
            const width = ctx.measureText(summary.title).width;
            const hit: LabelHit = {
                summary,
                left: screen.x - width / 2 - 7,
                right: screen.x + width / 2 + 7,
                top: screen.y - (active ? 15 : 12),
                bottom: screen.y + 7,
            };
            if (!active && visibleLabels.some((placed) => overlaps(hit, placed))) continue;
            visibleLabels.push(hit);
            ctx.fillStyle = active ? '#20231f' : 'rgba(32, 35, 31, 0.72)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(summary.title, screen.x, screen.y);
            if (active) {
                ctx.beginPath();
                ctx.moveTo(screen.x - width / 2, screen.y + 11);
                ctx.lineTo(screen.x + width / 2, screen.y + 11);
                ctx.strokeStyle = '#315f4b';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
        labelHits.current = visibleLabels;
    }, [activeBookId, activeHighlightId, activeTagId, bookAccent, bookPointIds, bookPoints, index, labels, layout, size, tagPointIds, tagPoints, view]);

    const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const labelAt = (position: { x: number; y: number }): LabelHit | undefined =>
        labelHits.current.find((hit) => position.x >= hit.left && position.x <= hit.right && position.y >= hit.top && position.y <= hit.bottom);

    return (
        <div className="map-canvas-wrap">
            <canvas
                ref={canvasRef}
                className="map-canvas"
                data-testid="map-canvas"
                data-map-center-x={String(Math.round(view.centerX))}
                data-map-center-y={String(Math.round(view.centerY))}
                data-map-zoom={view.zoom.toFixed(3)}
                role="img"
                tabIndex={0}
                aria-label="阅读世界地图。可拖动和缩放；键盘访客可使用地图下方的主题区域与划线列表。"
                onPointerDown={(event) => {
                    const position = pointerPosition(event);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = { pointerId: event.pointerId, startX: position.x, startY: position.y, view, moved: false };
                }}
                onPointerMove={(event) => {
                    const position = pointerPosition(event);
                    const currentDrag = drag.current;
                    if (currentDrag !== null && currentDrag.pointerId === event.pointerId) {
                        const dx = position.x - currentDrag.startX;
                        const dy = position.y - currentDrag.startY;
                        if (Math.abs(dx) + Math.abs(dy) > 3) currentDrag.moved = true;
                        const startMap = screenToMap({ x: 0, y: 0 }, currentDrag.view, size.width, size.height);
                        const movedMap = screenToMap({ x: dx, y: dy }, currentDrag.view, size.width, size.height);
                        onViewChange(clampMapView({
                            ...currentDrag.view,
                            centerX: currentDrag.view.centerX - (movedMap.x - startMap.x),
                            centerY: currentDrag.view.centerY - (movedMap.y - startMap.y),
                        }));
                        return;
                    }
                    const label = labelAt(position);
                    if (label !== undefined) {
                        setHoverText(`${label.summary.title}：${String(label.summary.bookCount)} 本书，${String(label.summary.highlightCount)} 处已标注划线`);
                        event.currentTarget.style.cursor = 'pointer';
                        return;
                    }
                    const point = nearestPoint(interactivePoints, position, view, size.width, size.height, 11);
                    if (point !== undefined) {
                        const highlight = index.highlightsById.get(point.highlightId);
                        const book = highlight === undefined ? undefined : index.booksById.get(highlight.bookId);
                        setHoverText(book === undefined ? '一处划线' : `《${book.title}》的一处划线`);
                        event.currentTarget.style.cursor = 'pointer';
                    } else {
                        setHoverText('');
                        event.currentTarget.style.cursor = 'grab';
                    }
                }}
                onPointerUp={(event) => {
                    const position = pointerPosition(event);
                    const currentDrag = drag.current;
                    drag.current = null;
                    if (currentDrag?.moved === true) return;
                    const label = labelAt(position);
                    if (label !== undefined) {
                        onSelectTag(label.summary.tagId);
                        return;
                    }
                    const point = nearestPoint(interactivePoints, position, view, size.width, size.height, 13);
                    if (point !== undefined) onSelectHighlight(point.highlightId);
                }}
                onPointerCancel={() => { drag.current = null; }}
                onPointerLeave={(event) => {
                    if (drag.current === null) setHoverText('');
                    event.currentTarget.style.cursor = 'grab';
                }}
                onWheel={(event) => {
                    event.preventDefault();
                    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
                    onViewChange(clampMapView({ ...view, zoom: view.zoom * factor }));
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
