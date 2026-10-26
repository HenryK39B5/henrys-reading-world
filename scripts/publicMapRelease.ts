import { createHash } from 'node:crypto';
import type { Snapshot } from '../src/domain/types.ts';
import { matchesMapTerrain } from './embeddings/mapTerrainArtifact.ts';

export function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
}
export const publicFingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
/** Everything approved for readers, including IDs, originals, tags and cover paths; map alone may change. */
export function publicContentFingerprint(snapshot: Snapshot): string {
    const { map: _map, ...content } = snapshot;
    void _map;
    return publicFingerprint(content);
}
export const PUBLIC_MAP_PARAMETERS = {
    model: 'Xenova/bge-large-zh-v1.5@a48549b-q8-cls', dimensions: 1024, umapVersion: '1.4.0',
    neighborsIncludingSelf: 48, distance: 'exact-float64-cosine', minDist: 0.14, spread: 1.25, epochs: 350,
    scaling: 'uniform-350-9650', tagForce: false,
} as const;
export type PublicMapRelease = {
    schemaVersion: 1; release: string; method: 'exact-cosine-48-v1'; seed: number;
    contentHash: string; mapHash: string; terrainHash: string; mapVersion: string;
    highlights: number; books: number; fitScope: 'approved-public-only';
    sourceSnapshotHash: string; implementationHash: string; parameters: typeof PUBLIC_MAP_PARAMETERS;
};
export function verifyPublicMapRelease(snapshot: Snapshot, terrain: unknown, raw: unknown): PublicMapRelease {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw Error('Invalid public map release');
    const r = raw as PublicMapRelease;
    if (Object.keys(r).sort().join(',') !== ['schemaVersion','release','method','seed','contentHash','mapHash','terrainHash','mapVersion','highlights','books','fitScope','sourceSnapshotHash','implementationHash','parameters'].sort().join(',') ||
        r.schemaVersion !== 1 || r.method !== 'exact-cosine-48-v1' || r.fitScope !== 'approved-public-only' || r.seed !== 1296126005 ||
        typeof r.release !== 'string' || r.release.length === 0 || snapshot.visibility !== 'public' || !snapshot.map ||
        !/^[a-f0-9]{64}$/u.test(r.sourceSnapshotHash) || !/^[a-f0-9]{64}$/u.test(r.implementationHash) ||
        publicFingerprint(r.parameters) !== publicFingerprint(PUBLIC_MAP_PARAMETERS) ||
        r.highlights !== snapshot.highlights.length || r.books !== snapshot.books.length ||
        r.contentHash !== publicContentFingerprint(snapshot) || r.mapHash !== publicFingerprint(snapshot.map) ||
        r.mapVersion !== snapshot.map.version || !r.mapVersion.startsWith('exact-cosine-48-v1-public-exact-1296126005-') ||
        !r.mapVersion.endsWith(r.sourceSnapshotHash.slice(0, 10)) ||
        r.terrainHash !== publicFingerprint(terrain) || !matchesMapTerrain(terrain, snapshot)) throw Error('Public map release does not match approved content, map and terrain');
    return r;
}
