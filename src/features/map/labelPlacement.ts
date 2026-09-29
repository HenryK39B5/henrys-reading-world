import { mapToScreen, type MapLabelSummary } from '../../domain/map.ts';
import { MAP_COORDINATE_MAX } from '../../domain/types.ts';

export type LabelPlacement = {
    summary: MapLabelSummary;
    left: number;
    top: number;
    right: number;
    bottom: number;
    x: number;
    y: number;
    anchorX: number;
    anchorY: number;
};

type Size = { width: number; height: number };

/** Screen typography grows with proximity, not with the popularity of a tag. */
export function mapLabelFontSize(zoom: number, width: number, active: boolean, placeNames = false, fixedStudy = false): number {
    if (fixedStudy) return active ? 16 : 13;
    const narrow = width < 520;
    const start = active ? 16 : placeNames ? 13 : 14;
    const ceiling = narrow ? (active ? 21 : placeNames ? 18.5 : 19) : (active ? 24 : placeNames ? 21 : 22);
    const perOctave = narrow ? (active || placeNames ? 2.3 : 2.1) : (active || placeNames ? 3 : 2.7);
    return Math.round(Math.min(ceiling, start + Math.log2(Math.max(1, zoom)) * perOctave) * 10) / 10;
}

function worldLabelLimit(width: number): number { return width < 520 ? 10 : 18; }

/** Admit real, lower-ranked places gradually; only a bounded number appear on screen. */
export function mapLabelViewportLimit(zoom: number, width: number, fixedStudy = false): number {
    const world = worldLabelLimit(width);
    if (fixedStudy) return world;
    const near = width < 520 ? 6 : 12;
    return Math.round(world - Math.min(1, Math.max(0, (zoom - 1) / 3)) * (world - near));
}

const LABEL_OFFSETS = [
    { x: 0, y: 0 },
    { x: 0, y: -22 },
    { x: 22, y: -13 },
    { x: -22, y: -13 },
    { x: 24, y: 13 },
    { x: -24, y: 13 },
    { x: 0, y: 23 },
];

function overlaps(left: LabelPlacement, right: LabelPlacement): boolean {
    return !(left.right + 8 < right.left || right.right + 8 < left.left || left.bottom + 5 < right.top || right.bottom + 5 < left.top);
}

/** Place all labels before clipping to the viewport, so panning never reflows the ones still in view. */
export function placeMapLabels(
    labels: readonly MapLabelSummary[],
    activeTagId: string | null,
    zoom: number,
    size: Size,
    measure: (title: string, active: boolean) => number,
    placeNames = false,
    fixedStudy = false,
): LabelPlacement[] {
    const fixedView = { centerX: MAP_COORDINATE_MAX / 2, centerY: MAP_COORDINATE_MAX / 2, zoom };
    const selected = labels.find((entry) => entry.tagId === activeTagId);
    const ordered = [...labels].sort((left, right) => {
        if (left.tagId === activeTagId) return -1;
        if (right.tagId === activeTagId) return 1;
        if (selected !== undefined) {
            const distance = (entry: MapLabelSummary): number =>
                (entry.label.x - selected.label.x) ** 2 + (entry.label.y - selected.label.y) ** 2;
            const separation = distance(left) - distance(right);
            if (separation !== 0) return separation;
        }
        return right.highlightCount - left.highlightCount || left.tagId.localeCompare(right.tagId);
    });
    const worldLimit = worldLabelLimit(size.width);
    const progress = fixedStudy ? 0 : Math.min(1, Math.max(0, (zoom - 1) / 3));
    const maximumLabels = Math.floor(worldLimit + progress * Math.max(0, labels.length - worldLimit));
    const placed: LabelPlacement[] = [];
    for (const summary of ordered) {
        if (placed.length >= maximumLabels) break;
        const active = summary.tagId === activeTagId;
        const anchor = mapToScreen(summary.label, fixedView, size.width, size.height);
        const width = measure(summary.title, active);
        const fontSize = mapLabelFontSize(zoom, size.width, active, placeNames, fixedStudy);
        for (const offset of active ? LABEL_OFFSETS.slice(0, 1) : LABEL_OFFSETS) {
            const x = anchor.x + offset.x;
            const y = anchor.y + offset.y;
            const candidate = {
                summary,
                left: x - width / 2 - 8,
                right: x + width / 2 + 8,
                top: y - (fixedStudy ? (active ? 16 : 13) : Math.max(placeNames ? (active ? 16 : 13) : 0, Math.ceil(fontSize / 2) + (active ? 8 : 6))),
                bottom: y + (fixedStudy ? 15 : Math.max(placeNames ? 15 : 0, Math.ceil(fontSize / 2) + (active ? 4 : 2))),
                x,
                y,
                anchorX: anchor.x,
                anchorY: anchor.y,
            };
            if (active || !placed.some((entry) => overlaps(entry, candidate))) {
                placed.push(candidate);
                break;
            }
        }
    }
    return placed;
}

export function visibleMapLabels(
    placed: readonly LabelPlacement[],
    centerX: number,
    centerY: number,
    zoom: number,
    size: Size,
): LabelPlacement[] {
    const scale = Math.min(size.width, size.height) / MAP_COORDINATE_MAX * zoom;
    const dx = (MAP_COORDINATE_MAX / 2 - centerX) * scale;
    const dy = (MAP_COORDINATE_MAX / 2 - centerY) * scale;
    return placed.flatMap((entry) => {
        const hit = {
            ...entry,
            left: entry.left + dx,
            right: entry.right + dx,
            top: entry.top + dy,
            bottom: entry.bottom + dy,
            x: entry.x + dx,
            y: entry.y + dy,
            anchorX: entry.anchorX + dx,
            anchorY: entry.anchorY + dy,
        };
        return hit.left >= 8 && hit.top >= 8 && hit.right <= size.width - 8 && hit.bottom <= size.height - 8 ? [hit] : [];
    });
}
