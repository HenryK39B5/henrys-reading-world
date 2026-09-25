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
    const maximumLabels = size.width < 520 ? 10 : 18;
    const placed: LabelPlacement[] = [];
    for (const summary of ordered) {
        if (placed.length >= maximumLabels) break;
        const active = summary.tagId === activeTagId;
        const anchor = mapToScreen(summary.label, fixedView, size.width, size.height);
        const width = measure(summary.title, active);
        for (const offset of active ? LABEL_OFFSETS.slice(0, 1) : LABEL_OFFSETS) {
            const x = anchor.x + offset.x;
            const y = anchor.y + offset.y;
            const candidate = {
                summary,
                left: x - width / 2 - 8,
                right: x + width / 2 + 8,
                top: y - (active ? 16 : 13),
                bottom: y + (placeNames ? 15 : 9),
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
