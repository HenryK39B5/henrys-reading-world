import { createHash } from 'node:crypto';
import { contours } from 'd3-contour';
import type { Snapshot } from '../../src/domain/types.ts';
import { interpolatedContours } from './contourCandidate.ts';
import { densityAtResolution } from './densityStudy.ts';

export const TERRAIN_LEVELS = [48, 96, 136, 160, 184, 208, 232] as const;
export const terrainHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function buildMapTerrain(snapshot: Snapshot) {
    const map = snapshot.map;
    if (map === undefined || map.points.length !== snapshot.highlights.length) throw new Error('terrain requires a complete map');
    const density = densityAtResolution(map.points, 128, 80);
    return {
        sourceVersion: map.version,
        pointsHash: terrainHash(map.points),
        density,
        contours: interpolatedContours(density, TERRAIN_LEVELS),
        bands: contours().size([density.columns, density.rows]).thresholds([...TERRAIN_LEVELS]).smooth(true)(density.values),
    };
}

export function matchesMapTerrain(value: unknown, snapshot: Snapshot): boolean {
    if (typeof value !== 'object' || value === null || snapshot.map === undefined) return false;
    const artifact = value as ReturnType<typeof buildMapTerrain>;
    return artifact.sourceVersion === snapshot.map.version && artifact.pointsHash === terrainHash(snapshot.map.points) &&
        artifact.density?.columns === 128 && artifact.density?.rows === 80 && artifact.density.values?.length === 128 * 80 &&
        Array.isArray(artifact.contours) && artifact.contours.length === TERRAIN_LEVELS.length &&
        Array.isArray(artifact.bands) && artifact.bands.length === TERRAIN_LEVELS.length;
}
