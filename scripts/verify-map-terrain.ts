import { readFile } from 'node:fs/promises';
import type { Snapshot } from '../src/domain/types.ts';
import { matchesMapTerrain } from './embeddings/mapTerrainArtifact.ts';
import { verifyPublicMapRelease } from './publicMapRelease.ts';

const snapshot = JSON.parse(await readFile('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const artifact = JSON.parse(await readFile('src/data/public-map-terrain.json', 'utf8')) as unknown;
if (snapshot.visibility !== 'public' || !matchesMapTerrain(artifact, snapshot)) {
    throw new Error('Public terrain is stale or incomplete; run npm run map:terrain:public before building.');
}
verifyPublicMapRelease(snapshot, artifact, JSON.parse(await readFile('scripts/public-map-release.json', 'utf8')) as unknown);
console.log(`public terrain verified against ${snapshot.map?.points.length ?? 0} fixed points`);
