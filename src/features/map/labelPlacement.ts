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

type Size = { width: number; height: number; scaleBasis?: number };

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

/** Original greedy layout: study mode, selected regions and 4×/8× detail tiers. */
function placeOneLabel(
    summary: MapLabelSummary,
    placed: readonly LabelPlacement[],
    activeTagId: string | null,
    zoom: number,
    size: Size,
    measure: (title: string, active: boolean) => number,
    placeNames: boolean,
    fixedStudy: boolean,
    withinFrame = false,
): LabelPlacement | undefined {
    const active = summary.tagId === activeTagId;
    const anchor = mapToScreen(summary.label,
        { centerX: MAP_COORDINATE_MAX / 2, centerY: MAP_COORDINATE_MAX / 2, zoom, scaleBasis: size.scaleBasis }, size.width, size.height);
    const width = measure(summary.title, active);
    const fontSize = mapLabelFontSize(zoom, size.width, active, placeNames, fixedStudy);
    for (const offset of active ? LABEL_OFFSETS.slice(0, 1) : LABEL_OFFSETS) {
        const x = anchor.x + offset.x;
        const y = anchor.y + offset.y;
        const candidate: LabelPlacement = {
            summary,
            left: x - width / 2 - 8,
            right: x + width / 2 + 8,
            top: y - (fixedStudy ? (active ? 16 : 13) : Math.max(placeNames ? (active ? 16 : 13) : 0, Math.ceil(fontSize / 2) + (active ? 8 : 6))),
            bottom: y + (fixedStudy ? 15 : Math.max(placeNames ? 15 : 0, Math.ceil(fontSize / 2) + (active ? 4 : 2))),
            x, y, anchorX: anchor.x, anchorY: anchor.y,
        };
        if (withinFrame && (candidate.left < 8 || candidate.right > size.width - 8 || candidate.top < 8 || candidate.bottom > size.height - 8)) continue;
        if (active || !placed.some((entry) => overlaps(entry, candidate))) return candidate;
    }
    return undefined;
}

export function placeMapLabels(
    labels: readonly MapLabelSummary[],
    activeTagId: string | null,
    zoom: number,
    size: Size,
    measure: (title: string, active: boolean) => number,
    placeNames = false,
    fixedStudy = false,
): LabelPlacement[] {
    const selected = labels.find((entry) => entry.tagId === activeTagId);
    const ordered = orderMapLabels(labels, activeTagId, selected);
    const worldLimit = worldLabelLimit(size.width);
    const progress = fixedStudy ? 0 : Math.min(1, Math.max(0, (zoom - 1) / 3));
    const maximumLabels = Math.floor(worldLimit + progress * Math.max(0, labels.length - worldLimit));
    const placed: LabelPlacement[] = [];
    for (const summary of ordered) {
        if (placed.length >= maximumLabels) break;
        const candidate = placeOneLabel(summary, placed, activeTagId, zoom, size, measure, placeNames, fixedStudy);
        if (candidate !== undefined) placed.push(candidate);
    }
    return placed;
}

// Overview names describe supported places, not merely the most frequent tags worldwide.
// Screen-space coverage is a navigation/typography constraint, NOT a thematic cluster.
export function placeOverviewLabels(
    labels: readonly MapLabelSummary[],
    size: Size,
    measure: (title: string, active: boolean) => number,
    placeNames = false,
): LabelPlacement[] {
    const minimumLocalMembers = 3;
    const radius = size.width < 520 ? 46 : 65;
    const baseLimit = worldLabelLimit(size.width);
    const ordered = orderMapLabels(labels, null, undefined);
    const eligible = ordered.filter((entry) => (entry.localHighlightCount ?? minimumLocalMembers) >= minimumLocalMembers);
    const positions = new Map(ordered.map((entry) => [entry.tagId, mapToScreen(entry.label,
        { centerX: MAP_COORDINATE_MAX / 2, centerY: MAP_COORDINATE_MAX / 2, zoom: 1, scaleBasis: size.scaleBasis }, size.width, size.height)]));
    const distance = (left: MapLabelSummary, right: MapLabelSummary): number => {
        const a = positions.get(left.tagId)!;
        const b = positions.get(right.tagId)!;
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const placed: LabelPlacement[] = [];
    const add = (entry: MapLabelSummary): boolean => {
        const candidate = placeOneLabel(entry, placed, null, 1, size, measure, placeNames, false, true);
        if (candidate === undefined) return false;
        placed.push(candidate);
        return true;
    };
    const first = eligible.find((entry) => add(entry));
    if (first === undefined) return placed;
    const chosen = new Set(placed.map((entry) => entry.summary.tagId));
    const covered = (entry: MapLabelSummary): boolean => placed.some((item) => distance(item.summary, entry) <= radius);
    // Farthest uncovered place first; its representative can be a different *nearby*
    // reviewed name with better local support. This does not equate their meanings.
    while (placed.length < baseLimit + 2) {
        const uncovered = eligible.filter((entry) => !covered(entry))
            .sort((a, b) => {
                const remoteness = (item: MapLabelSummary): number =>
                    Math.min(...placed.map((name) => distance(item, name.summary)));
                return remoteness(b) - remoteness(a) || b.highlightCount - a.highlightCount;
            });
        let next: MapLabelSummary | undefined;
        for (const target of uncovered) {
            next = eligible.filter((entry) => !chosen.has(entry.tagId) && distance(entry, target) <= radius &&
                placeOneLabel(entry, placed, null, 1, size, measure, placeNames, false, true) !== undefined)
                .sort((a, b) => {
                    const gain = (entry: MapLabelSummary): number => uncovered.filter((item) => distance(entry, item) <= radius).length;
                    return gain(b) - gain(a) || (b.localHighlightCount ?? 0) - (a.localHighlightCount ?? 0) ||
                        b.highlightCount - a.highlightCount || a.tagId.localeCompare(b.tagId);
                })[0];
            if (next !== undefined) break;
        }
        if (next === undefined) break;
        add(next);
        chosen.add(next.tagId);
    }
    // Once separated places have a signpost, retain a little of the original overview's
    // richer central typography. The extra two slots are only for uncovered places.
    for (const entry of eligible) {
        if (placed.length >= baseLimit) break;
        if (!chosen.has(entry.tagId) && add(entry)) chosen.add(entry.tagId);
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
    const fixedView = { centerX: MAP_COORDINATE_MAX / 2, centerY: MAP_COORDINATE_MAX / 2, zoom, scaleBasis: size.scaleBasis };
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
    // Regional selection keeps its established neighbour-first layout; coverage applies
    // to the unfiltered world overview, where missing signposts were the problem.
    const world = activeTagId === null
        ? placeOverviewLabels(labels, size, (title, active) => measure(title, active, 1), placeNames)
        : at(1);
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
    const newFar = far.filter((entry) => !used.has(entry.summary.tagId) && !newNear.some((nearEntry) => nearEntry.summary.tagId === entry.summary.tagId));
    // A new name cannot make a permanent world signpost vanish. In the unfiltered world,
    // choose one stable offset and the earliest zoom at which it no longer collides with
    // ANY already-admitted name at later scales. No viewport-relative replanning on pan.
    const admit = (entry: LabelPlacement, earliest: number): void => {
        const preferred = offset(entry);
        if (activeTagId !== null) {
            plan.push({ summary: entry.summary, offset: preferred, firstZoom: earliest });
            return;
        }
        const offsets = [preferred, ...LABEL_OFFSETS.filter((candidate) => candidate.x !== preferred.x || candidate.y !== preferred.y)];
        const firstStep = Math.ceil(earliest * 20);
        const samples = Array.from({ length: 161 - firstStep }, (_, index) => {
            const step = firstStep + index;
            const zoom = step / 20;
            return { step, zoom, occupied: projectMapLabels(plan, zoom, size, measure, null, placeNames) };
        });
        let best: PlannedMapLabel | undefined;
        for (const candidateOffset of offsets) {
            let lastCollision = firstStep - 1;
            for (const { step, zoom, occupied } of samples) {
                const candidate = plannedPlacement({ summary: entry.summary, offset: candidateOffset, firstZoom: zoom },
                    zoom, size, measure, null, placeNames);
                if (occupied.some((placed) => overlaps(placed, candidate))) lastCollision = step;
            }
            const firstZoom = (lastCollision + 1) / 20;
            if (firstZoom > 8) continue;
            if (best === undefined || firstZoom < best.firstZoom) {
                best = { summary: entry.summary, offset: candidateOffset, firstZoom };
            }
        }
        if (best !== undefined) plan.push(best);
    };
    for (const [rank, entry] of newNear.entries()) {
        admit(entry, 2 + 2 * (rank + 1) / newNear.length);
        used.add(entry.summary.tagId);
    }
    for (const [rank, entry] of newFar.entries()) {
        admit(entry, 4 + 4 * (rank + 1) / newFar.length);
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
    const scale = (size.scaleBasis ?? Math.min(size.width, size.height)) / MAP_COORDINATE_MAX * zoom;
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
