import { sha256 } from './core.ts';
import {
    MAP_COORDINATE_MAX,
    type Highlight,
    type MapContour,
    type MapDensity,
    type MapLabel,
    type MapLayout,
    type MapPoint,
    type Snapshot,
} from '../../src/domain/types.ts';

export const MAP_LAYOUT_ALGORITHM = 'umap-sparse-rp-v1';
export const MAP_LAYOUT_SEED = 0x4d415035;
export const MAP_PROJECTION_DIMENSIONS = 96;
export const MAP_DENSITY_COLUMNS = 64;
export const MAP_DENSITY_ROWS = 40;
export const MAP_CONTOUR_LEVELS = [48, 96, 160] as const;

export type RawMapPoint = { highlightId: string; x: number; y: number };

/** Small deterministic PRNG used by UMAP; the layout seed is part of the private manifest. */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function mix(value: number): number {
    let mixed = value >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return mixed >>> 0;
}

/**
 * Independent map-only sparse random projection. It reduces UMAP's working set without reusing the
 * 16-dimensional path projection or exporting any source-vector component.
 */
export function projectForMap(source: readonly number[], dimensions = MAP_PROJECTION_DIMENSIONS): number[] {
    if (source.length === 0 || source.some((value) => !Number.isFinite(value))) {
        throw new Error('map projection requires a non-empty finite vector');
    }
    if (!Number.isInteger(dimensions) || dimensions < 8) {
        throw new Error('map projection dimensions must be an integer of at least 8');
    }
    const result = Array.from<number>({ length: dimensions }).fill(0);
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
        const sourceValue = source[sourceIndex] ?? 0;
        for (let lane = 0; lane < 4; lane += 1) {
            const hash = mix(sourceIndex ^ Math.imul(lane + 1, 0x9e3779b1) ^ MAP_LAYOUT_SEED);
            const target = hash % dimensions;
            result[target] = (result[target] ?? 0) + ((hash & 0x80000000) === 0 ? sourceValue : -sourceValue);
        }
    }
    const norm = Math.sqrt(result.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
        throw new Error('map projection requires a non-zero vector');
    }
    return result.map((value) => value / norm);
}

export function cosineDistance(left: readonly number[], right: readonly number[]): number {
    if (left.length === 0 || left.length !== right.length) return 1;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index] ?? 0;
        const rightValue = right[index] ?? 0;
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm === 0 || rightNorm === 0) return 1;
    return 1 - dot / Math.sqrt(leftNorm * rightNorm);
}

function quantile(sorted: readonly number[], fraction: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)));
    return sorted[index] ?? 0;
}

/** Clip only the outer 1% so isolated UMAP points cannot compress the inhabited world. */
export function normalizeMapPoints(points: readonly RawMapPoint[]): MapPoint[] {
    if (points.length === 0) return [];
    const xs = points.map((point) => point.x).sort((left, right) => left - right);
    const ys = points.map((point) => point.y).sort((left, right) => left - right);
    const minX = quantile(xs, 0.01);
    const maxX = quantile(xs, 0.99);
    const minY = quantile(ys, 0.01);
    const maxY = quantile(ys, 0.99);
    const spanX = Math.max(Number.EPSILON, maxX - minX);
    const spanY = Math.max(Number.EPSILON, maxY - minY);
    const margin = 350;
    const usable = MAP_COORDINATE_MAX - margin * 2;
    const normalize = (value: number, minimum: number, span: number): number =>
        Math.round(margin + Math.max(0, Math.min(1, (value - minimum) / span)) * usable);
    return points.map((point) => ({
        highlightId: point.highlightId,
        x: normalize(point.x, minX, spanX),
        y: normalize(point.y, minY, spanY),
    }));
}

function median(values: number[]): number {
    values.sort((left, right) => left - right);
    if (values.length === 0) return 0;
    const middle = Math.floor(values.length / 2);
    if (values.length % 2 === 1) return values[middle] ?? 0;
    return Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2);
}

/** Tag labels use member medians, so one semantic outlier cannot drag a mountain name away. */
export function buildMapLabels(snapshot: Pick<Snapshot, 'tags' | 'highlights'>, points: readonly MapPoint[]): MapLabel[] {
    const pointsById = new Map(points.map((point) => [point.highlightId, point]));
    return snapshot.tags.flatMap((tag) => {
        const members = snapshot.highlights
            .filter((highlight) => highlight.tagIds.includes(tag.id))
            .map((highlight) => pointsById.get(highlight.id))
            .filter((point): point is MapPoint => point !== undefined);
        if (members.length === 0) return [];
        return [{
            tagId: tag.id,
            x: median(members.map((point) => point.x)),
            y: median(members.map((point) => point.y)),
        }];
    });
}

export function buildDensity(points: readonly MapPoint[], columns = MAP_DENSITY_COLUMNS, rows = MAP_DENSITY_ROWS): MapDensity {
    const values = Array.from<number>({ length: columns * rows }).fill(0);
    const radius = 4;
    const sigma = 1.55;
    for (const point of points) {
        const centerX = (point.x / MAP_COORDINATE_MAX) * (columns - 1);
        const centerY = (point.y / MAP_COORDINATE_MAX) * (rows - 1);
        for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(rows - 1, Math.ceil(centerY + radius)); y += 1) {
            for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(columns - 1, Math.ceil(centerX + radius)); x += 1) {
                const dx = x - centerX;
                const dy = y - centerY;
                const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
                const index = y * columns + x;
                values[index] = (values[index] ?? 0) + weight;
            }
        }
    }
    const maximum = Math.max(0, ...values);
    return {
        columns,
        rows,
        values: maximum === 0 ? values : values.map((value) => Math.round(Math.sqrt(value / maximum) * 255)),
    };
}

const EDGE_PAIRS: Record<number, number[][]> = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]],
    5: [[0, 3], [1, 2]], 6: [[0, 2]], 7: [[0, 3]], 8: [[3, 0]],
    9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[0, 1]], 12: [[1, 3]],
    13: [[1, 2]], 14: [[2, 3]],
};

export function buildContours(density: MapDensity, levels: readonly number[] = MAP_CONTOUR_LEVELS): MapContour[] {
    const { columns, rows, values } = density;
    const coordinate = (x: number, y: number, edge: number): [number, number] => {
        const positions: [number, number][] = [[x + 0.5, y], [x + 1, y + 0.5], [x + 0.5, y + 1], [x, y + 0.5]];
        const position = positions[edge] ?? positions[0] ?? [x, y];
        return [
            Math.round((position[0] / (columns - 1)) * MAP_COORDINATE_MAX),
            Math.round((position[1] / (rows - 1)) * MAP_COORDINATE_MAX),
        ];
    };
    return levels.map((level) => {
        const segments: number[][] = [];
        for (let y = 0; y < rows - 1; y += 1) {
            for (let x = 0; x < columns - 1; x += 1) {
                const topLeft = values[y * columns + x] ?? 0;
                const topRight = values[y * columns + x + 1] ?? 0;
                const bottomRight = values[(y + 1) * columns + x + 1] ?? 0;
                const bottomLeft = values[(y + 1) * columns + x] ?? 0;
                const state = (topLeft >= level ? 8 : 0) | (topRight >= level ? 4 : 0) |
                    (bottomRight >= level ? 2 : 0) | (bottomLeft >= level ? 1 : 0);
                for (const pair of EDGE_PAIRS[state] ?? []) {
                    const start = coordinate(x, y, pair[0] ?? 0);
                    const end = coordinate(x, y, pair[1] ?? 0);
                    segments.push([start[0], start[1], end[0], end[1]]);
                }
            }
        }
        return { level, segments };
    });
}

export function assembleMapLayout(snapshot: Pick<Snapshot, 'tags' | 'highlights'>, version: string, points: MapPoint[]): MapLayout {
    const density = buildDensity(points);
    return {
        version,
        points,
        labels: buildMapLabels(snapshot, points),
        density,
        contours: buildContours(density),
    };
}

export function mapTagHash(snapshot: Pick<Snapshot, 'tags' | 'highlights'>): string {
    const tagLines = snapshot.tags.map((tag) => `${tag.id}\0${tag.title}\0${tag.description ?? ''}`);
    const assignmentLines = snapshot.highlights.map((highlight: Highlight) => `${highlight.id}\0${highlight.tagIds.join(',')}`);
    return sha256([...tagLines, ...assignmentLines].join('\n'));
}

export function mapLayoutHash(layout: MapLayout): string {
    return sha256(JSON.stringify(layout));
}
