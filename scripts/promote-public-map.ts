/** One explicit map-only promotion. Refuses changes to approved originals, tags, books or covers. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateSnapshot } from '../src/domain/validate.ts';
import { buildMapTerrain } from './embeddings/mapTerrainArtifact.ts';
import { hashBytes } from './research/mapCoordinatePolish.ts';
import { PUBLIC_MAP_PARAMETERS, publicContentFingerprint, publicFingerprint, verifyPublicMapRelease } from './publicMapRelease.ts';

const sourcePath = 'src/data/public-snapshot.json';
const bytes = await readFile(sourcePath);
const before = validateSnapshot(JSON.parse(bytes.toString('utf8')) as unknown, { expectedVisibility: 'public' });
if (!before.ok) throw Error('Invalid approved public source');
const candidatePath = '.private/research/map/coordinate-polish/public-first/exact-1296126005.json';
const candidate = JSON.parse(await readFile(candidatePath, 'utf8')) as Record<string, unknown>;
if (candidate.scope !== 'public' || candidate.method !== 'exact' || candidate.seed !== 1296126005 ||
    candidate.sourceSnapshotHash !== hashBytes(bytes)) throw Error('Candidate is not derived from this approved public snapshot');
const checked = validateSnapshot({ ...before.snapshot, map: candidate.map }, { expectedVisibility: 'public' });
if (!checked.ok || !checked.snapshot.map || hashBytes(JSON.stringify(checked.snapshot.map)) !== candidate.mapHash) throw Error('Invalid candidate map');
const after = checked.snapshot;
if (publicContentFingerprint(before.snapshot) !== publicContentFingerprint(after)) throw Error('Public content changed');
const terrain = buildMapTerrain(after);
if (publicFingerprint(terrain) !== publicFingerprint(candidate.terrain)) throw Error('Candidate terrain is not reproducible');
for (const label of after.map!.labels) {
    const members = new Set(after.highlights.filter(h => h.tagIds.includes(label.tagId)).map(h => h.id));
    if (!after.map!.points.some(p => members.has(p.highlightId) && p.x === label.x && p.y === label.y)) throw Error('Label is not a real member');
}
const manifest = {
    schemaVersion: 1, release: 'release-c-2026-10-26', method: 'exact-cosine-48-v1', seed: 1296126005,
    sourceSnapshotHash: candidate.sourceSnapshotHash, implementationHash: candidate.implementationHash, parameters: PUBLIC_MAP_PARAMETERS,
    contentHash: publicContentFingerprint(after), mapHash: publicFingerprint(after.map), terrainHash: publicFingerprint(terrain),
    mapVersion: after.map!.version, highlights: after.highlights.length, books: after.books.length, fitScope: 'approved-public-only',
};
verifyPublicMapRelease(after, terrain, manifest);
const backup = '.private/review/release-c/before';
await mkdir(backup, { recursive: true });
await writeFile(`${backup}/public-snapshot.json`, bytes, { flag: 'wx' });
await writeFile(`${backup}/public-map-terrain.json`, await readFile('src/data/public-map-terrain.json'), { flag: 'wx' });
// All validation precedes writes. Existing originals and their publication decisions stay byte-for-byte equivalent.
await writeFile(sourcePath, JSON.stringify(after, null, 2) + '\n');
await writeFile('src/data/public-map-terrain.json', JSON.stringify(terrain) + '\n');
await writeFile('scripts/public-map-release.json', JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(`Promoted public-only map: ${after.books.length} books / ${after.highlights.length} unchanged originals; ${after.map!.version}`);
