import { MAP_COORDINATE_MAX, type MapPoint } from '../../src/domain/types.ts';

export function mapDistanceSquared(left: Pick<MapPoint, 'x' | 'y'>, right: Pick<MapPoint, 'x' | 'y'>): number {
    return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

/** World diagonal is 1; this is a published coordinate diagnostic, not a semantic distance. */
export function normalizedMapDistance(left: Pick<MapPoint, 'x' | 'y'>, right: Pick<MapPoint, 'x' | 'y'>): number {
    const values = [left.x, left.y, right.x, right.y];
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > MAP_COORDINATE_MAX)) throw new Error('invalid public-map coordinate');
    return Math.sqrt(mapDistanceSquared(left, right)) / (MAP_COORDINATE_MAX * Math.SQRT2);
}

export function rankPublishedNeighbor(points: readonly MapPoint[], sourceId: string, targetId: string): number {
    if (sourceId === targetId || new Set(points.map((point) => point.highlightId)).size !== points.length) throw new Error('invalid map IDs');
    const source = points.find((point) => point.highlightId === sourceId);
    const target = points.find((point) => point.highlightId === targetId);
    if (!source || !target) throw new Error('missing map point');
    const distance = mapDistanceSquared(source, target);
    return 1 + points.filter((point) => point.highlightId !== sourceId &&
        (mapDistanceSquared(source, point) < distance || (mapDistanceSquared(source, point) === distance && point.highlightId < targetId))).length;
}

export function pickBookMatchedId(ids: readonly string[], rng: () => number): string {
    if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !id)) throw new Error('invalid book controls');
    const draw = rng();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('invalid RNG');
    return [...ids].sort()[Math.floor(draw * ids.length)]!;
}
