import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../src/domain/types.ts';
import { buildMapTerrain, matchesMapTerrain } from '../scripts/embeddings/mapTerrainArtifact.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const terrain = JSON.parse(readFileSync('src/data/public-map-terrain.json', 'utf8')) as ReturnType<typeof buildMapTerrain>;

describe('approved map terrain artifact', () => {
    it('uses the exact fixed public points and reproducible field, contours and bands', () => {
        expect(matchesMapTerrain(terrain, snapshot)).toBe(true);
        expect(terrain).toEqual(buildMapTerrain(snapshot));
    });

    it('rejects stale coordinates and mismatched map version', () => {
        expect(snapshot.map).toBeDefined();
        if (snapshot.map === undefined) return;
        const changed = { ...snapshot, map: { ...snapshot.map, points: snapshot.map.points.map((point, index) => index === 0 ? { ...point, x: point.x + 1 } : point) } };
        expect(matchesMapTerrain(terrain, changed)).toBe(false);
        expect(matchesMapTerrain(terrain, { ...snapshot, map: { ...snapshot.map, version: 'stale' } })).toBe(false);
    });
});
