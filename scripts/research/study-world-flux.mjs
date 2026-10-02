import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const start=performance.now(),out=process.argv[2]??'.private/research/world-mining/flux-v3';
if(!out.startsWith('.private/research/world-mining/')||existsSync(out))throw new Error('Require a new in-study output directory');
const sb=readFileSync('src/data/public-snapshot.json'),gb=readFileSync('.private/research/map/graph-islands/study.json');
const snapshot=JSON.parse(sb),previous=JSON.parse(gb),g=previous.graphs['16'];
if(sha(sb)!=='ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c'||previous.snapshotSha256!==sha(sb)||previous.embeddingCacheSha256!=='49dbdbb49d2f660608bd4a3c0f2cc7c9eba8c430fb7fcdf9baceeec95514431e')throw new Error('Frozen graph/snapshot mismatch');
const idToHighlight=new Map(snapshot.highlights.map(h=>[h.id,h]));
if(g.ids.length!==snapshot.highlights.length||new Set(g.ids).size!==g.ids.length)throw new Error('Graph ID mismatch');
const ids=[...g.ids].sort(),position=new Map(ids.map((id,i)=>[id,i]));
for(const id of ids)if(!idToHighlight.has(id)||g.books[id]!==idToHighlight.get(id).bookId)throw new Error('Graph not approved public corpus');
const adjacent=ids.map(()=>[]),degree=new Float64Array(ids.length),edges=[];
for(const e of g.edges){
 const i=position.get(e.source),j=position.get(e.target);if(i===undefined||j===undefined||i===j||!(e.score>0)||!Number.isFinite(e.score))throw new Error('Invalid positive symmetric graph edge');
 const w=e.score**4;edges.push({i,j,w});adjacent[i].push({j,w});adjacent[j].push({j:i,w});degree[i]+=w;degree[j]+=w;
}
for(const list of adjacent)list.sort((a,b)=>a.j-b.j);
const component=new Int32Array(ids.length).fill(-1),components=[];
for(let seed=0;seed<ids.length;seed++)if(component[seed]<0){
 const index=components.length,queue=[seed];component[seed]=index;
 for(let p=0;p<queue.length;p++)for(const e of adjacent[queue[p]])if(component[e.j]<0){component[e.j]=index;queue.push(e.j);}
 components.push(queue);
}
const Z=degree.reduce((a,b)=>a+b,0);
const cohort=JSON.parse(readFileSync('.private/research/world-mining/transport-v3/canonical.json','utf8')).selectedBooks;
const tolerance=1e-12,maxIterations=30000;
function solve(leftBookId,rightBookId){
 const A=new Set(ids.flatMap((id,i)=>g.books[id]===leftBookId?[i]:[])),B=new Set(ids.flatMap((id,i)=>g.books[id]===rightBookId?[i]:[]));
 if(!A.size||!B.size||leftBookId===rightBookId)throw new Error('Invalid boundary books');
 const q=new Float64Array(ids.length).fill(NaN),interior=[];let relevantComponents=0;
 for(const vertices of components){
  const hasA=vertices.some(i=>A.has(i)),hasB=vertices.some(i=>B.has(i));
  if(hasA&&hasB){relevantComponents++;for(const i of vertices){q[i]=A.has(i)?0:B.has(i)?1:0.5;if(!A.has(i)&&!B.has(i))interior.push(i);}}
  else if(hasA||hasB)for(const i of vertices)q[i]=hasB?1:0;
 }
 interior.sort((a,b)=>a-b);
 let iteration=0,delta=0;
 for(;iteration<maxIterations;iteration++){
  delta=0;
  for(const i of interior){let next=0;for(const e of adjacent[i])next+=e.w*q[e.j];next/=degree[i];delta=Math.max(delta,Math.abs(next-q[i]));q[i]=next;}
  if(delta<=tolerance){iteration++;break;}
 }
 if(delta>tolerance)throw new Error(`Committor iteration limit for ${leftBookId}/${rightBookId}`);
 const outgoing=new Float64Array(ids.length),incoming=new Float64Array(ids.length),currents=[];let residual=0;
 for(const i of interior){let next=0;for(const e of adjacent[i])next+=e.w*q[e.j];residual=Math.max(residual,Math.abs(q[i]-next/degree[i]));}
 for(const{i,j,w}of edges){if(!Number.isFinite(q[i])||!Number.isFinite(q[j]))continue;const current=w/Z*(q[j]-q[i]);if(current===0)continue;
  const from=current>0?i:j,to=current>0?j:i,value=Math.abs(current);outgoing[from]+=value;incoming[to]+=value;currents.push({sourceId:ids[from],targetId:ids[to],current:value});
 }
 const sourceFlux=[...A].reduce((s,i)=>s+outgoing[i]-incoming[i],0),targetFlux=[...B].reduce((s,i)=>s+incoming[i]-outgoing[i],0);
 const balanceGap=Math.abs(sourceFlux-targetFlux),balanceRelativeGap=sourceFlux>0?balanceGap/sourceFlux:0;
 const conservationError=interior.reduce((m,i)=>Math.max(m,Math.abs(outgoing[i]-incoming[i])),0);
 if(residual>1e-10||conservationError>1e-10||balanceRelativeGap>1e-7||q.some(v=>Number.isFinite(v)&&(v<0||v>1)))throw new Error('Harmonic/current conservation check failed');
 const strongest=interior.map(i=>({id:ids[i],bookId:g.books[ids[i]],potential:q[i],throughCurrent:(incoming[i]+outgoing[i])/2})).sort((a,b)=>b.throughCurrent-a.throughCurrent||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,12);
 currents.sort((a,b)=>b.current-a.current||(a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:a.targetId<b.targetId?-1:a.targetId>b.targetId?1:0));
 return {leftBookId,rightBookId,sourceCount:A.size,targetCount:B.size,relevantComponents,definedVertices:q.filter(v=>Number.isFinite(v)).length,unanchoredVertices:q.filter(v=>!Number.isFinite(v)).length,sourceFlux,targetFlux,balanceGap,balanceRelativeGap,harmonicResidual:residual,maxInteriorCurrentDivergence:conservationError,iterations:iteration,potentials:Array.from(q,v=>Number.isFinite(v)?v:null),strongestInterior:strongest,strongestEdges:currents.slice(0,30)};
}
const results=[];
for(let i=0;i<cohort.length;i++)for(let j=i+1;j<cohort.length;j++)results.push(solve(cohort[i].id,cohort[j].id));
const reverse=solve(cohort[1].id,cohort[0].id),forward=results[0];let complementError=0;
for(let i=0;i<ids.length;i++){if((reverse.potentials[i]===null)!==(forward.potentials[i]===null))throw new Error('Reverse domain differs');if(forward.potentials[i]!==null)complementError=Math.max(complementError,Math.abs(forward.potentials[i]+reverse.potentials[i]-1));}
if(complementError>1e-9)throw new Error('Reverse committor complement failed');
const canonical={schemaVersion:1,date:'2026-10-02',purpose:'Numerical conditional network mining only; q/current are not semantic progress, author intention or causality.',inputs:{snapshotSha256:sha(sb),graphCacheSha256:sha(gb),originalVectorCacheSha256:previous.embeddingCacheSha256,implementationSha256:sha(readFileSync(new URL(import.meta.url)))},parameters:{graph:'Existing R4-E public exact mutual top16 cosine graph, no new links or 2D coordinates',edgeWeight:'positive cached cosine ** 4; symmetric',stationaryMeasure:'weighted degree / total weighted degree, fixed mixture on components',cohortSelection:'Same four book-count quantiles as transport pilot, no content/title selection',tolerance,maxIterations,iterationOrder:'Ascending stable highlight ID',node:process.version},graph:{vertices:ids.length,edges:edges.length,components:components.length,isolatedVertices:degree.filter(d=>d===0).length},ids,cohort,reverseComplementError:complementError,results};
mkdirSync(out,{recursive:true});const text=JSON.stringify(canonical,null,2)+'\n';writeFileSync(`${out}/canonical.json`,text);const run={canonicalSha256:sha(text),milliseconds:Math.round(performance.now()-start),maxRssKiB:process.resourceUsage().maxRSS,node:process.version};writeFileSync(`${out}/run.json`,JSON.stringify(run,null,2));
console.log(JSON.stringify({output:out,...run,graph:canonical.graph,reverseComplementError:complementError,results:results.map(r=>({...Object.fromEntries(Object.entries(r).filter(([key])=>!['potentials','strongestEdges','strongestInterior'].includes(key))),strongestInteriorBookCount:new Set(r.strongestInterior.map(s=>s.bookId)).size}))},null,2));
