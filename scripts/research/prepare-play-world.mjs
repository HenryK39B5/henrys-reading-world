import fs from 'node:fs';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Matrix, EigenvalueDecomposition } from 'ml-matrix';
import { highlightTextHash } from '../embeddings/core.ts';
import { playSnapshotIdentity, parsePlayWorldData, PLAY_WORLD_VERSION } from '../../src/domain/playWorld.ts';

const output = process.argv[2] ?? '.private/play-world-exact-v2.json';
if (!output.replaceAll('\\', '/').startsWith('.private/')) throw Error('Research output must stay in .private');
if (fs.existsSync(output)) throw Error('Existing artifact: keep it, or choose a new version before regenerating.');
const start = performance.now();
const snapshot = JSON.parse(fs.readFileSync('.private/local-snapshot.json', 'utf8'));
const cacheFile = '.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json';
const cacheBytes = fs.readFileSync(cacheFile);
const cache = JSON.parse(cacheBytes);
const ids = snapshot.highlights.map(h => h.id).sort();
const highlights = new Map(snapshot.highlights.map(h => [h.id, h]));
const n = ids.length, d = cache.dimensions, k = 24;
const vectors = new Float32Array(n * d);
let seed = 0x72ab19;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
const projection = new Float32Array(d * k);
for (let i = 0; i < projection.length; i++) projection[i] = (random() < 0.5 ? -1 : 1) / Math.sqrt(k);
const sketch = new Float64Array(n * k);
for (let i = 0; i < n; i++) {
    const entry = cache.vectors[ids[i]];
    if (!entry || entry.textHash !== highlightTextHash(highlights.get(ids[i])) || entry.values.length !== d || entry.values.some(v => !Number.isFinite(v))) throw Error(`Missing/stale vector: ${ids[i]}`);
    const norm = Math.hypot(...entry.values);
    if (!(norm > 0)) throw Error('Zero vector');
    for (let a = 0; a < d; a++) {
        const v = entry.values[a] / norm; vectors[i*d+a] = v;
        for (let b = 0; b < k; b++) sketch[i*k+b] += v * projection[a*k+b];
    }
}
console.log(JSON.stringify({stage:'validated-projected',count:n,seconds:(performance.now()-start)/1000}));
const mean = Array(k).fill(0);
for (let i=0;i<n;i++) for(let a=0;a<k;a++) mean[a]+=sketch[i*k+a]/n;
const covariance = Matrix.zeros(k,k);
for(let a=0;a<k;a++) for(let b=a;b<k;b++) {
    let sum=0; for(let i=0;i<n;i++) sum+=(sketch[i*k+a]-mean[a])*(sketch[i*k+b]-mean[b]);
    covariance.set(a,b,sum/n); covariance.set(b,a,sum/n);
}
const eigen = new EigenvalueDecomposition(covariance,{assumeSymmetric:true});
const axes=eigen.realEigenvalues.map((value,i)=>({value,i})).sort((a,b)=>b.value-a.value).slice(0,3);
const basis=axes.map(({i})=>{const axis=eigen.eigenvectorMatrix.getColumn(i); const strongest=axis.reduce((best,v,j)=>Math.abs(v)>Math.abs(axis[best])?j:best,0);return axis.map(v=>v*(axis[strongest]<0?-1:1));});
const positions=ids.map((_,i)=>basis.map(axis=>Number(axis.reduce((sum,v,a)=>sum+(sketch[i*k+a]-mean[a])*v,0).toFixed(7))));
const cosine=(i,j)=>{let sum=0;for(let a=0;a<d;a++)sum+=vectors[i*d+a]*vectors[j*d+a];return sum;};
const topIds = new Int32Array(n * 16).fill(-1);
const topScores = new Float64Array(n * 16).fill(-Infinity);
function insert(i, j, score) {
    const base=i*16;
    if(score < topScores[base+15] || (score === topScores[base+15] && j >= topIds[base+15])) return;
    let rank=15;
    while(rank>0 && (score>topScores[base+rank-1] || (score===topScores[base+rank-1] && j<topIds[base+rank-1]))) {
        topIds[base+rank]=topIds[base+rank-1];topScores[base+rank]=topScores[base+rank-1];rank--;
    }
    topIds[base+rank]=j;topScores[base+rank]=score;
}
for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) { const score=cosine(i,j); insert(i,j,score); insert(j,i,score); }
const neighbours=ids.map((_,i)=>Array.from(topIds.subarray(i*16,i*16+16)).filter(j=>j>=0));
const norms=ids.map(id=>Math.hypot(...cache.vectors[id].values));
const audits=[];
for(let i=0;i<n;i+=Math.max(1,Math.floor(n/12))) {
    const a=cache.vectors[ids[i]].values;
    const exact=ids.flatMap((id,j)=>{if(i===j)return [];const b=cache.vectors[id].values;let sum=0;for(let axis=0;axis<d;axis++)sum+=a[axis]*b[axis];return [{j,cos:sum/(norms[i]*norms[j])}];}).sort((a,b)=>b.cos-a.cos||a.j-b.j).slice(0,16);
    audits.push({id:ids[i],recall16:exact.filter(({j})=>neighbours[i].includes(j)).length/16,firstCosine:topScores[i*16],exactFirstCosine:exact[0]?.cos});
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const artifact={version:PLAY_WORLD_VERSION,snapshotHash:hash(playSnapshotIdentity(snapshot)),ids,positions,neighbours};
parsePlayWorldData(artifact,snapshot);
fs.mkdirSync('.private/research/play-world',{recursive:true});
fs.writeFileSync(output,JSON.stringify(artifact));
fs.writeFileSync(`${output}.study.json`,JSON.stringify({version:PLAY_WORLD_VERSION,cacheHash:hash(cacheBytes),artifactHash:hash(JSON.stringify(artifact)),count:n,books:snapshot.books.length,seed:'0x72ab19',sketchDimensions:k,search:'all unordered pairs; normalized Float32 vectors, Float64 accumulation; stable-ID ties',pairs:n*(n-1)/2,neighbours:16,axesEigenvalues:axes.map(a=>a.value),audits,meanRecall16:audits.reduce((s,a)=>s+a.recall16,0)/audits.length,seconds:(performance.now()-start)/1000,peakRss:process.resourceUsage().maxRSS,limits:'Exhaustive cosine candidates in Float32; sampled against original Float64 cosine. Display axes are a lossy sketch/PCA. Not semantic validation or causality.'},null,2));
console.log(JSON.stringify({stage:'ready',count:n,bytes:fs.statSync(output).size,seconds:(performance.now()-start)/1000,auditRecall:audits.reduce((s,a)=>s+a.recall16,0)/audits.length}));
