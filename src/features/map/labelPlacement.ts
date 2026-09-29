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

function orderMapLabels(labels: readonly MapLabelSummary[], activeTagId: string | null, selected: MapLabelSummary | undefined): MapLabelSummary[] {
    return [...labels].sort((left, right) => {
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
}

/** Original greedy world/study layout; retained for the exactly unchanged 1× overview. */
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
    const ordered = orderMapLabels(labels, activeTagId, selected);
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

export type PlannedMapLabel = {
    summary: MapLabelSummary;
    offset: { x: number; y: number };
    nearOffset?: { x: number; y: number };
    firstZoom: number;
};

type MeasureAtZoom = (title: string, active: boolean, zoom: number) => number;

function plannedPlacement(
    entry: PlannedMapLabel,
    zoom: number,
    size: Size,
    measure: MeasureAtZoom,
    activeTagId: string | null,
    placeNames: boolean,
): LabelPlacement {
    const active = entry.summary.tagId === activeTagId;
    const fixedView = { centerX: MAP_COORDINATE_MAX / 2, centerY: MAP_COORDINATE_MAX / 2, zoom };
    const anchor = mapToScreen(entry.summary.label, fixedView, size.width, size.height);
    const x = anchor.x + entry.offset.x;
    const y = anchor.y + entry.offset.y;
    const width = measure(entry.summary.title, active, zoom);
    const font = mapLabelFontSize(zoom, size.width, active, placeNames);
    return {
        summary: entry.summary,
        left: x - width / 2 - 8,
        right: x + width / 2 + 8,
        top: y - Math.max(placeNames ? (active ? 16 : 13) : 0, Math.ceil(font / 2) + (active ? 8 : 6)),
        bottom: y + Math.max(placeNames ? 15 : 0, Math.ceil(font / 2) + (active ? 4 : 2)),
        x, y,
        anchorX: anchor.x,
        anchorY: anchor.y,
    };
}

/** Fix admissions to world/near/far layouts and one-way zoom thresholds.
 * The plan depends on data, selected region and canvas size, NEVER on the camera center.
 */
export function planMapLabels(
    labels: readonly MapLabelSummary[],
    activeTagId: string | null,
    size: Size,
    measure: MeasureAtZoom,
    placeNames = false,
): PlannedMapLabel[] {
    const at = (zoom: number): LabelPlacement[] => placeMapLabels(labels, activeTagId, zoom, size,
        (title, active) => measure(title, active, zoom), placeNames);
    const world = at(1);
    const near = at(4);
    const far = at(8);
    const offset = (entry: LabelPlacement): { x: number; y: number } =>
        ({ x: entry.x - entry.anchorX, y: entry.y - entry.anchorY });
    const nearById = new Map(near.map((entry) => [entry.summary.tagId, entry]));
    const plan: PlannedMapLabel[] = world.map((entry) => {
        const nearEntry = nearById.get(entry.summary.tagId);
        return {
            summary: entry.summary,
            offset: offset(entry),
            ...(nearEntry === undefined ? {} : { nearOffset: offset(nearEntry) }),
            firstZoom: 1,
        };
    });
    const used = new Set(plan.map((entry) => entry.summary.tagId));
    const newNear = near.filter((entry) => !used.has(entry.summary.tagId));
    // Keep the exact accepted 1× and 4× layouts, and only add names as the scale approaches
    // the next one. Never evict a name just because a rival was admitted at a later zoom.
    for (const [rank, entry] of newNear.entries()) {
        plan.push({ summary: entry.summary, offset: offset(entry), firstZoom: 2 + 2 * (rank + 1) / newNear.length });
        used.add(entry.summary.tagId);
    }
    const newFar = far.filter((entry) => !used.has(entry.summary.tagId));
    for (const [rank, entry] of newFar.entries()) {
        plan.push({ summary: entry.summary, offset: offset(entry), firstZoom: 4 + 4 * (rank + 1) / newFar.length });
    }
    return plan;
}

export function projectMapLabels(
    plan: readonly PlannedMapLabel[],
    zoom: number,
    size: Size,
    measure: MeasureAtZoom,
    activeTagId: string | null,
    placeNames = false,
): LabelPlacement[] {
    const progress = Math.min(1, Math.max(0, (zoom - 1) / 3));
    return plan.filter((entry) => entry.firstZoom <= zoom).map((entry) => {
        const toward = entry.nearOffset ?? entry.offset;
        const offset = {
            x: entry.offset.x + (toward.x - entry.offset.x) * progress,
            y: entry.offset.y + (toward.y - entry.offset.y) * progress,
        };
        return plannedPlacement({ ...entry, offset }, zoom, size, measure, activeTagId, placeNames);
    });
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
