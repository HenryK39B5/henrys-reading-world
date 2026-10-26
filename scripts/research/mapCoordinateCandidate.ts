import type { Snapshot } from '../../src/domain/types.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { buildMapTerrain, matchesMapTerrain } from '../embeddings/mapTerrainArtifact.ts';
import { COORDINATE_METHOD, SEEDS, hashBytes } from './mapCoordinatePolish.ts';

/** Read-only local candidate; original content and the publication decision never come from this file. */
export function readCoordinateCandidate(raw:string,source:string):{snapshot:Snapshot;terrain:ReturnType<typeof buildMapTerrain>}{
    const input:unknown=JSON.parse(raw);
    if(typeof input!=='object'||input===null||Array.isArray(input))throw Error('Invalid coordinate candidate');
    const c=input as Record<string,unknown>;
    const keys=['schemaVersion','scope','sourceSnapshotHash','sourceVectorHash','implementationHash','method','seed','mapHash','map','terrain'];
    if(Object.keys(c).length!==keys.length||Object.keys(c).some(k=>!keys.includes(k))||c.schemaVersion!==1||c.scope!=='local'||c.method!=='exact'||c.seed!==SEEDS[0])throw Error('Invalid coordinate candidate');
    if(c.sourceSnapshotHash!==hashBytes(source)||![c.sourceVectorHash,c.implementationHash,c.mapHash].every(h=>typeof h==='string'&&/^[0-9a-f]{64}$/.test(h)))throw Error('Stale coordinate candidate');
    const base=validateSnapshot(JSON.parse(source) as unknown,{expectedVisibility:'local-only'});if(!base.ok)throw Error('Invalid base snapshot');
    const candidate=validateSnapshot({...base.snapshot,map:c.map},{expectedVisibility:'local-only'});
    if(!candidate.ok||!candidate.snapshot.map)throw Error('Invalid candidate map');
    const map=candidate.snapshot.map;
    if(!map.version.startsWith(`${COORDINATE_METHOD}-local-exact-${SEEDS[0]}-`)||hashBytes(JSON.stringify(map))!==c.mapHash)throw Error('Invalid candidate map hash');
    // Reject accidental vectors/metadata rather than returning unknown JSON properties from validation.
    const cleanMap={version:map.version,points:map.points.map(p=>({highlightId:p.highlightId,x:p.x,y:p.y})),labels:map.labels.map(l=>({tagId:l.tagId,x:l.x,y:l.y})),density:{columns:map.density.columns,rows:map.density.rows,values:map.density.values},contours:map.contours.map(c=>({level:c.level,segments:c.segments}))};
    if(hashBytes(JSON.stringify(cleanMap))!==c.mapHash)throw Error('Unexpected candidate map fields');
    const terrain=buildMapTerrain(candidate.snapshot);
    if(!matchesMapTerrain(c.terrain,candidate.snapshot)||hashBytes(JSON.stringify(terrain))!==hashBytes(JSON.stringify(c.terrain)))throw Error('Stale or altered candidate terrain');
    return {snapshot:candidate.snapshot,terrain};
}
