import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Snapshot} from '../src/domain/types.ts';
import {readCoordinateCandidate} from '../scripts/research/mapCoordinateCandidate.ts';
import {buildMapTerrain} from '../scripts/embeddings/mapTerrainArtifact.ts';
import {COORDINATE_METHOD,SEEDS,hashBytes} from '../scripts/research/mapCoordinatePolish.ts';
const publicSnapshot=JSON.parse(readFileSync('src/data/public-snapshot.json','utf8')) as Snapshot;
// Contract tests use real approved originals and existing points; no invented passages or research cache required.
const base={...publicSnapshot,visibility:'local-only'};
const source=JSON.stringify(base);
const map={...publicSnapshot.map!,version:`${COORDINATE_METHOD}-local-exact-${SEEDS[0]}-contract`};
const terrain=buildMapTerrain({...publicSnapshot,map});
const candidate={schemaVersion:1,scope:'local',sourceSnapshotHash:hashBytes(source),sourceVectorHash:'a'.repeat(64),implementationHash:'b'.repeat(64),method:'exact',seed:SEEDS[0],mapHash:hashBytes(JSON.stringify(map)),map,terrain};
describe('local coordinate candidate boundary',()=>{
 it('substitutes map only, retaining every real original and tag',()=>{
  const result=readCoordinateCandidate(JSON.stringify(candidate),source);expect(result.snapshot.highlights).toEqual(publicSnapshot.highlights);expect(result.snapshot.books).toEqual(publicSnapshot.books);expect(result.snapshot.tags).toEqual(publicSnapshot.tags);expect(result.snapshot.map).toEqual(map);expect(result.terrain).toEqual(terrain);
 });
 it('rejects stale snapshot identity and public scope',()=>{
  expect(()=>readCoordinateCandidate(JSON.stringify(candidate),source+' ')).toThrow('Stale');expect(()=>readCoordinateCandidate(JSON.stringify({...candidate,scope:'public'}),source)).toThrow();
 });
 it('rejects accidentally attached vectors and altered coordinate payload',()=>{
  expect(()=>readCoordinateCandidate(JSON.stringify({...candidate,vectors:[]}),source)).toThrow();const extra={...map,vectors:[]};expect(()=>readCoordinateCandidate(JSON.stringify({...candidate,map:extra,mapHash:hashBytes(JSON.stringify(extra))}),source)).toThrow('Invalid candidate map');expect(()=>readCoordinateCandidate(JSON.stringify({...candidate,map:{...map,points:map.points.slice(1)}}),source)).toThrow();
 });
 it('rejects a terrain with a correct header but corrupted density',()=>{
  const bad=structuredClone(candidate);bad.terrain.density.values[0]=999;expect(()=>readCoordinateCandidate(JSON.stringify(bad),source)).toThrow('terrain');
 });
});
