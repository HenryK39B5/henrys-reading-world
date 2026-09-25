import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import { buildMapTerrain, matchesMapTerrain } from './embeddings/mapTerrainArtifact.ts';

const scope = process.argv.find((arg) => arg.startsWith('--scope='))?.slice('--scope='.length);
if (scope !== 'public' && scope !== 'local') throw new Error('Use --scope=public or --scope=local');
const source = scope === 'public' ? 'src/data/public-snapshot.json' : '.private/local-snapshot.json';
const target = scope === 'public' ? 'src/data/public-map-terrain.json' : '.private/local-map-terrain.json';
const result = validateSnapshot(JSON.parse(await readFile(source, 'utf8')) as unknown, { expectedVisibility: scope === 'public' ? 'public' : 'local-only' });
if (!result.ok) throw new Error(`Invalid ${scope} snapshot: ${result.errors.join('; ')}`);
const artifact = buildMapTerrain(result.snapshot);
if (!matchesMapTerrain(artifact, result.snapshot)) throw new Error('Terrain generation did not match its source map');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(artifact)}\n`, 'utf8');
console.log(`${scope} terrain: ${target} (${artifact.density.columns}x${artifact.density.rows}, ${artifact.contours.length} levels)`);
