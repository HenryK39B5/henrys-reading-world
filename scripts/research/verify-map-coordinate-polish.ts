import {readFile,writeFile} from 'node:fs/promises';
import type {Snapshot,MapPoint} from '../../src/domain/types.ts';
import type {EmbeddingCache} from '../embeddings/core.ts';
import {exactDistances,rankedRow,pointNeighbors,mean,median,hashBytes} from './mapCoordinatePolish.ts';
const root='.private/research/map/coordinate-polish/';
const cache=JSON.parse(await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json','utf8')) as EmbeddingCache;
const reports=[];
for(const scope of ['public','local']){
 const snapshot=JSON.parse(await readFile(scope==='public'?'src/data/public-snapshot.json':'.private/local-snapshot.json','utf8')) as Snapshot;
 const report=JSON.parse(await readFile(root+scope+'-first/report.json','utf8')) as {sourceSnapshotHash:string;results:{method:string;seed:number;mapHash:string}[];baseline:{perQuery:{id:string}[]}};
 const hs=[...snapshot.highlights].sort((a,b)=>a.id.localeCompare(b.id)),n=hs.length,matrix=exactDistances(hs.map(h=>cache.vectors[h.id]!.values));
 const queries=report.baseline.perQuery.map(q=>hs.findIndex(h=>h.id===q.id));if(queries.some(i=>i<0))throw Error('Unknown query');
 const ref=new Map(queries.map(i=>[i,rankedRow(matrix,n,i)]));
 const ordered=(points:MapPoint[])=>{const byId=new Map(points.map(p=>[p.highlightId,p]));return hs.map(h=>byId.get(h.id)!);};
 const evaluate=(points:MapPoint[])=>{
  const recalls=queries.map(i=>{const different=(j:number)=>hs[j]!.bookId!==hs[i]!.bookId;const high=new Set(ref.get(i)!.filter(different).slice(0,30));return pointNeighbors(points,i).filter(different).slice(0,30).filter(j=>high.has(j)).length/30;});
  return {mean:mean(recalls),median:median(recalls)};
 };
 const results=[];
 for(const r of report.results){const artifact=JSON.parse(await readFile(`${root}${scope}-first/${r.method}-${r.seed}.json`,'utf8')) as {map:{points:MapPoint[]}};results.push({method:r.method,seed:r.seed,crossBookRecall30:evaluate(ordered(artifact.map.points))});}
 reports.push({scope,queries:queries.length,originalSpaceSameBookMean:mean(queries.map(i=>ref.get(i)!.slice(0,30).filter(j=>hs[j]!.bookId===hs[i]!.bookId).length/30)),baseline:evaluate(ordered(snapshot.map!.points)),results});
}
const first=JSON.parse(await readFile(root+'public-first/exact-1296126005.json','utf8')) as {mapHash:string;map:unknown;terrain:unknown};
const repeat=JSON.parse(await readFile(root+'public-repro/exact-1296126005.json','utf8')) as typeof first;
const reproducible=first.mapHash===repeat.mapHash&&hashBytes(JSON.stringify(first.terrain))===hashBytes(JSON.stringify(repeat.terrain));if(!reproducible)throw Error('Reference seed is not reproducible');
await writeFile(root+'cross-book-verification.json',JSON.stringify({reproducible,reports,note:'Post-first-run book-control diagnostic, same frozen algorithms and queries; no refit or parameter tuning.'},null,2),{flag:'wx'});
console.log(JSON.stringify({reproducible,reports},null,2));
