import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { highlightTextHash } from '../embeddings/core.ts';
import { coupling, summarize } from './distributionTransport.ts';

const start=performance.now();
const sha=b=>createHash('sha256').update(b).digest('hex');
const out=process.argv[2]??'.private/research/world-mining/transport-v3';
if(!out.startsWith('.private/research/world-mining/')||existsSync(out))throw new Error('Output must be a new directory inside this study');
const snapshotBytes=readFileSync('src/data/public-snapshot.json');
const vectorBytes=readFileSync('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json');
if(sha(snapshotBytes)!=='ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c'||sha(vectorBytes)!=='49dbdbb49d2f660608bd4a3c0f2cc7c9eba8c430fb7fcdf9baceeec95514431e')throw new Error('Frozen input drift');
const snapshot=JSON.parse(snapshotBytes),cache=JSON.parse(vectorBytes);
if(snapshot.visibility!=='public'||cache.provider!=='local'||cache.dimensions!==1024||cache.model!=='Xenova/bge-large-zh-v1.5@a48549b-q8-cls')throw new Error('Unexpected input contract');
const byBook=new Map(snapshot.books.map(b=>[b.id,[]]));
for(const h of snapshot.highlights){
 const c=cache.vectors[h.id];
 if(!c||c.textHash!==highlightTextHash(h)||c.values.length!==1024||c.values.some(v=>!Number.isFinite(v)))throw new Error(`Invalid public vector ${h.id}`);
 const rows=byBook.get(h.bookId);if(!rows)throw new Error('Unknown book');rows.push(h);
}
for(const rows of byBook.values())rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const ranked=snapshot.books.filter(b=>byBook.get(b.id).length).sort((a,b)=>byBook.get(a.id).length-byBook.get(b.id).length||(a.id<b.id?-1:a.id>b.id?1:0));
const quantiles=[0.2,0.4,0.6,0.8];
const selected=quantiles.map(q=>ranked[Math.floor(q*(ranked.length-1))]);
if(new Set(selected.map(b=>b.id)).size!==4)throw new Error('Quantiles did not select four distinct books');
const normalized=new Map();
for(const b of selected)for(const h of byBook.get(b.id)){
 const raw=cache.vectors[h.id].values;const norm=Math.sqrt(raw.reduce((s,x)=>s+x*x,0));if(!(norm>0))throw new Error('Zero vector');
 normalized.set(h.id,Float64Array.from(raw,x=>x/norm));
}
function costs(left,right){
 const C=new Float64Array(left.length*right.length);
 for(let i=0;i<left.length;i++)for(let j=0;j<right.length;j++){
  const a=normalized.get(left[i].id),b=normalized.get(right[j].id);let dot=0;for(let k=0;k<a.length;k++)dot+=a[k]*b[k];
  C[i*right.length+j]=1-Math.max(-1,Math.min(1,dot));
 }
 return C;
}
const controls=[];
function near(name,actual,expected,tolerance){if(!Number.isFinite(actual)||Math.abs(actual-expected)>tolerance)throw new Error(`${name}: ${actual} != ${expected}`);controls.push({name,actual,expected,tolerance});}
const constant=new Float64Array(6).fill(0.7);
const balanced=coupling(constant,2,3,{epsilon:0.04});
near('numeric constant cost balanced mass',balanced.mass,1,1e-11);
near('numeric constant cost independent plan',Math.max(...balanced.plan.map(p=>Math.abs(p-1/6))),0,1e-11);
const unbalanced=coupling(constant,2,3,{epsilon:0.04,rho:0.3});
near('numeric constant cost UOT analytic mass',unbalanced.mass,Math.exp(-0.7/(0.04+2*0.3)),1e-10);
const zero=coupling(new Float64Array(6),2,3,{epsilon:0.04,rho:0.3});near('numeric zero cost UOT mass',zero.mass,1,1e-11);

const epsilonGrid=[0.02,0.04,0.08],rhoGrid=[0.1,0.3];
const results=[];
for(let bi=0;bi<selected.length;bi++)for(let bj=bi+1;bj<selected.length;bj++){
 const left=byBook.get(selected[bi].id),right=byBook.get(selected[bj].id),n=left.length,m=right.length,C=costs(left,right);
 const row={leftBookId:selected[bi].id,rightBookId:selected[bj].id,n,m,sourceIds:left.map(h=>h.id),targetIds:right.map(h=>h.id),sweep:[]};
 for(const epsilon of epsilonGrid){
  for(const rho of [null,...rhoGrid]){
   const result=coupling(C,n,m,{epsilon,rho});
   const s=summarize(result,C,n,m,right.map(h=>h.id));
   row.sweep.push({epsilon,rho,...s,strongest:epsilon===0.04&&(rho===null||rho===0.3)?s.strongest.map(v=>({...v,sourceId:left[v.sourceRow].id})):undefined});
   if(epsilon===0.04&&rho===0.3)row.examplePlan=Array.from(result.plan);
  }
 }
 if(results.length===0){
  const base=coupling(C,n,m,{epsilon:0.04,rho:0.3});
  const reversed=new Float64Array(C.length);for(let i=0;i<n;i++)for(let j=0;j<m;j++)reversed[i*m+j]=C[(n-1-i)*m+(m-1-j)];
  const r=coupling(reversed,n,m,{epsilon:0.04,rho:0.3});let permError=0;for(let i=0;i<n;i++)for(let j=0;j<m;j++)permError=Math.max(permError,Math.abs(base.plan[i*m+j]-r.plan[(n-1-i)*m+(m-1-j)]));near('real pair permutation equivariance',permError,0,1e-10);
  const duplicate=new Float64Array(C.length*2);for(let i=0;i<n;i++)for(let j=0;j<m;j++){duplicate[(2*i)*m+j]=C[i*m+j];duplicate[(2*i+1)*m+j]=C[i*m+j];}
  const d=coupling(duplicate,2*n,m,{epsilon:0.04,rho:0.3});let dupError=0;for(let i=0;i<n;i++)for(let j=0;j<m;j++)dupError=Math.max(dupError,Math.abs(base.plan[i*m+j]-d.plan[(2*i)*m+j]-d.plan[(2*i+1)*m+j]));near('real pair measure-preserving duplication',dupError,0,1e-10);near('real pair duplication total mass',d.mass,base.mass,1e-10);
 }
 results.push(row);
}
const implementationSha256=sha(Buffer.concat([readFileSync(new URL('./distributionTransport.ts',import.meta.url)),readFileSync(new URL(import.meta.url)),readFileSync('scripts/embeddings/core.ts')]));
const canonical={schemaVersion:1,date:'2026-10-02',purpose:'Deterministic numerical feasibility only. No labels, questions, explanations, analogies or semantic validity inferred.',
 inputs:{snapshotSha256:sha(snapshotBytes),vectorCacheSha256:sha(vectorBytes),implementationSha256,publicBooks:snapshot.books.length,publicHighlights:snapshot.highlights.length,model:cache.model,dimensions:cache.dimensions},
 parameters:{selection:'All approved books sorted by highlight count ascending, then ASCII stable book ID; floor(q*(N-1)) at q=0.2,0.4,0.6,0.8. No title/content/manual case selection.',quantiles,epsilonGrid,rhoGrid,cost:'1 - cosine, Float64 normalized cached vectors',weights:'Every selected book is normalized to total mass 1; equal mass per actual highlight.',regularizer:'epsilon * generalized KL(P || a outer b); UOT adds rho * KL(P1 || a) + rho * KL(P^T1 || b).',maxIterations:2000,tolerance:1e-12,node:process.version},
 selectedBooks:selected.map(b=>({id:b.id,title:b.title,count:byBook.get(b.id).length})),controls,results};
mkdirSync(out,{recursive:true});const text=JSON.stringify(canonical,null,2)+'\n';writeFileSync(`${out}/canonical.json`,text);
const run={canonicalSha256:sha(text),milliseconds:Math.round(performance.now()-start),maxRssKiB:process.resourceUsage().maxRSS,node:process.version};writeFileSync(`${out}/run.json`,JSON.stringify(run,null,2));
console.log(JSON.stringify({output:out,...run,validatedPublicVectors:snapshot.highlights.length,selectedBooks:canonical.selectedBooks,controls:controls.length,realPairs:results.length,realSolves:results.reduce((s,r)=>s+r.sweep.length,0),summary:results.map(r=>({left:r.leftBookId,right:r.rightBookId,n:r.n,m:r.m,base:r.sweep.filter(s=>s.epsilon===0.04).map(s=>Object.fromEntries(Object.entries(s).filter(([key])=>key!=='strongest')))}))},null,2));
