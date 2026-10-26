import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { UMAP } from 'umap-js';
import { validateSnapshot } from '../../src/domain/validate.ts';
import type { MapLayout, MapPoint } from '../../src/domain/types.ts';
import { highlightTextHash, type EmbeddingCache } from '../embeddings/core.ts';
import { assembleMapLayout, projectForMap, cosineDistance, mulberry32, normalizeMapPoints } from '../embeddings/mapLayout.ts';
import { buildMapTerrain } from '../embeddings/mapTerrainArtifact.ts';
import { COORDINATE_METHOD, NEIGHBORS, TAG_WEIGHT, SEEDS, hashBytes, heldBooks, exactDistances, rankedRow, makeExactKnn, uniformMapPoints, supportedLabels, mean, median, rankCorrelation, pointNeighbors } from './mapCoordinatePolish.ts';

const arg=(key:string)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.split('=').slice(1).join('=');
const scope=arg('scope')??'public';if(scope!=='public'&&scope!=='local')throw Error('Invalid scope');
const out=arg('out');if(!out)throw Error('--out required; outputs refuse overwrite');
const rel=relative(resolve('.private/research/map/coordinate-polish'),resolve(out));if(rel===''||rel.startsWith('..')||isAbsolute(rel))throw Error('Research output must stay in .private/research/map/coordinate-polish');
const methods=(arg('methods')??'legacy,exact,weak').split(',');if(methods.some(m=>!['legacy','exact','weak'].includes(m)))throw Error('Invalid methods');
const seeds=(arg('seeds')??SEEDS.join(',')).split(',').map(Number);if(seeds.some(s=>!SEEDS.includes(s)))throw Error('Invalid seeds');
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'started.json'),JSON.stringify({scope,methods,seeds,date:new Date().toISOString()}),{flag:'wx'});
const start=performance.now();
const source=scope==='public'?'src/data/public-snapshot.json':'.private/local-snapshot.json';
const sourceBytes=await readFile(source);
const checked=validateSnapshot(JSON.parse(sourceBytes.toString('utf8')) as unknown,{expectedVisibility:scope==='public'?'public':'local-only'});
if(!checked.ok)throw Error(checked.errors.join('; '));
const snapshot=checked.snapshot;if(!snapshot.map)throw Error('Baseline map required');
const highlights=[...snapshot.highlights].sort((a,b)=>a.id.localeCompare(b.id));
const cacheBytes=await readFile('.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json');
const cache=JSON.parse(cacheBytes.toString('utf8')) as EmbeddingCache;
if(cache.provider!=='local'||cache.dimensions!==1024||cache.model!=='Xenova/bge-large-zh-v1.5@a48549b-q8-cls')throw Error('Unexpected cache');
const rows=highlights.map(h=>{const e=cache.vectors[h.id];if(!e||e.textHash!==highlightTextHash(h)||e.values.length!==1024||e.values.some(v=>!Number.isFinite(v)))throw Error('Missing/stale vector '+h.id);return e.values;});
const sourceHash=hashBytes(sourceBytes),vectorHash=hashBytes(cacheBytes);
const sourceFiles=['scripts/research/mapCoordinatePolish.ts','scripts/research/study-map-coordinate-polish.ts'];
const implementationHash=hashBytes((await Promise.all(sourceFiles.map(p=>readFile(p,'utf8')))).join('\n'));
console.log(`${scope}: ${highlights.length} real highlights; computing exact Float64 cosine`);
const n=highlights.length,matrix=exactDistances(rows),holdout=heldBooks(highlights);
const byBook=new Map<string,number[]>();highlights.forEach((h,i)=>{const list=byBook.get(h.bookId)??[];list.push(i);byBook.set(h.bookId,list);});
const fixedCases=['h-3501','h-898','h-2288','h-4504','h-1754'];
const queries=[...new Set([...byBook.values()].map(list=>[...list].sort((a,b)=>hashBytes('map-polish-query:'+highlights[a]!.id).localeCompare(hashBytes('map-polish-query:'+highlights[b]!.id)))[0]!).concat(fixedCases.map(id=>highlights.findIndex(h=>h.id===id)).filter(i=>i>=0)))];
const reference=new Map(queries.map(i=>[i,rankedRow(matrix,n,i)]));
const taggedQueries=highlights.map((h,i)=>({h,i})).filter(({h})=>h.tagIds.length>0);
const orderedPoints=(map:MapLayout):MapPoint[]=>{const m=new Map(map.points.map(p=>[p.highlightId,p]));return highlights.map(h=>{const p=m.get(h.id);if(!p)throw Error('Missing point '+h.id);return p;});};
function evaluate(points:MapPoint[]){
    const perQuery=queries.map(i=>{
        const high=reference.get(i)!,low=pointNeighbors(points,i);
        const recalls=[15,30,60].map(k=>{const set=new Set(high.slice(0,k));return low.slice(0,k).filter(j=>set.has(j)).length/k;});
        const boundary=matrix[i*n+high[Math.ceil((n-1)*.1)-1]!]!;
        return {id:highlights[i]!.id,recalls,farShare:low.slice(0,30).filter(j=>matrix[i*n+j]!>boundary).length/30,sameBook:low.slice(0,30).filter(j=>highlights[j]!.bookId===highlights[i]!.bookId).length/30,neighbors:low.slice(0,6).map(j=>highlights[j]!.id)};
    });
    const group=(held:boolean)=>{const entries=taggedQueries.filter(({h})=>holdout.has(h.bookId)===held).map(({h,i})=>{
        const nearest=pointNeighbors(points,i).slice(0,30).map(j=>highlights[j]!);const known=nearest.filter(q=>q.tagIds.length>0);
        return {id:h.id,bookId:h.bookId,known:known.length,supported:known.filter(q=>q.tagIds.some(t=>h.tagIds.includes(t))).length};
    });
        const books=[...new Set(entries.map(e=>e.bookId))];
        return {queries:entries.length,knownNeighborMean:mean(entries.map(e=>e.known)),noKnownNeighbors:entries.filter(e=>!e.known).length,
            meanSupportAmongKnown:mean(entries.filter(e=>e.known).map(e=>e.supported/e.known)),
            bookEqualSupport:mean(books.flatMap(book=>{const value=mean(entries.filter(e=>e.bookId===book&&e.known>0).map(e=>e.supported/e.known));return value===null?[]:[value];}))};
    };
    const rng=mulberry32(20261026),highPairs:number[]=[],lowPairs:number[]=[];
    for(let t=0;t<3000;t++){const i=Math.floor(rng()*n),j=Math.floor(rng()*n);if(i===j)continue;highPairs.push(matrix[i*n+j]!);lowPairs.push(Math.hypot(points[i]!.x-points[j]!.x,points[i]!.y-points[j]!.y));}
    return {queryCount:queries.length,recallMedian:[0,1,2].map(k=>median(perQuery.map(q=>q.recalls[k]!))),recallMean:[0,1,2].map(k=>mean(perQuery.map(q=>q.recalls[k]!))),farShareMedian:median(perQuery.map(q=>q.farShare)),sameBookMean:mean(perQuery.map(q=>q.sameBook)),globalRankCorrelation:rankCorrelation(highPairs,lowPairs),trainingTags:group(false),heldBookTags:group(true),perQuery};
}
function labelAudit(map:MapLayout){const points=new Map(map.points.map(p=>[p.highlightId,p]));return map.labels.map(label=>{
    const members=highlights.filter(h=>h.tagIds.includes(label.tagId));const support=(r:number)=>members.filter(h=>{const p=points.get(h.id)!;return Math.hypot(p.x-label.x,p.y-label.y)<=r;});
    const near=support(600),wide=support(900);return {tagId:label.tagId,members:members.length,near600:near.length,wide900:wide.length,books600:new Set(near.map(h=>h.bookId)).size,largestBookShare:near.length?Math.max(...[...new Set(near.map(h=>h.bookId))].map(b=>near.filter(h=>h.bookId===b).length))/near.length:null};
});}
const baseline=evaluate(orderedPoints(snapshot.map));
await writeFile(resolve(out,'baseline.json'),JSON.stringify({metrics:baseline,labels:labelAudit(snapshot.map)},null,2),{flag:'wx'});
console.log('Baseline',JSON.stringify({recall:baseline.recallMedian,global:baseline.globalRankCorrelation}));
const results:{method:string;seed:number;metrics:ReturnType<typeof evaluate>;mapHash:string;seconds:number}[]=[];
const firstPoints=new Map<string,MapPoint[]>(),stability:{method:string;seed:number;recall30Median:number|null}[]=[];
for(const method of methods){
    const precomputed=method==='legacy'?null:makeExactKnn(matrix,highlights,method==='weak');
    const input=method==='legacy'?rows.map(row=>projectForMap(row)):rows;
    for(const seed of seeds){
        const began=performance.now();console.log('Fit',method,seed);
        const umap=new UMAP({nComponents:2,nNeighbors:method==='legacy'?24:NEIGHBORS,minDist:.14,spread:1.25,nEpochs:350,distanceFn:cosineDistance,random:mulberry32(seed)});
        if(precomputed)umap.setPrecomputedKNN(precomputed.indices,precomputed.distances);
        const embedded=await umap.fitAsync(input);
        const raw=highlights.map((h,i)=>({highlightId:h.id,x:embedded[i]![0]!,y:embedded[i]![1]!}));
        const points=method==='legacy'?normalizeMapPoints(raw):uniformMapPoints(raw);
        const map=assembleMapLayout(snapshot,`${COORDINATE_METHOD}-${scope}-${method}-${seed}-${sourceHash.slice(0,10)}`,points);
        if(method!=='legacy')map.labels=supportedLabels(highlights,points);
        const metrics=evaluate(points),mapHash=hashBytes(JSON.stringify(map)),seconds=(performance.now()-began)/1000;
        const initial=firstPoints.get(method);if(initial){stability.push({method,seed,recall30Median:median(queries.map(i=>{const set=new Set(pointNeighbors(initial,i).slice(0,30));return pointNeighbors(points,i).slice(0,30).filter(j=>set.has(j)).length/30;}))});}else firstPoints.set(method,points);
        const terrain=buildMapTerrain({...snapshot,map});
        const artifact={schemaVersion:1,scope,sourceSnapshotHash:sourceHash,sourceVectorHash:vectorHash,implementationHash,method,seed,mapHash,map,terrain};
        await writeFile(resolve(out,`${method}-${seed}.json`),JSON.stringify(artifact),{flag:'wx'});
        await writeFile(resolve(out,`${method}-${seed}-metrics.json`),JSON.stringify({metrics,labels:labelAudit(map),seconds},null,2),{flag:'wx'});
        results.push({method,seed,metrics,mapHash,seconds});
        console.log(JSON.stringify({method,seed,recall:metrics.recallMedian,far:metrics.farShareMedian,global:metrics.globalRankCorrelation,heldSupport:metrics.heldBookTags.bookEqualSupport,seconds}));
        if(seed===SEEDS[0]){
            const diffs=metrics.perQuery.map(q=>({q,gain:q.recalls[1]!-baseline.perQuery.find(b=>b.id===q.id)!.recalls[1]!})).sort((a,b)=>a.gain-b.gain||a.q.id.localeCompare(b.q.id));
            const caseIds=[...new Set([...fixedCases,...diffs.slice(0,2).map(d=>d.q.id),...diffs.slice(-2).map(d=>d.q.id)])];
            const review=caseIds.map(id=>{const i=highlights.findIndex(h=>h.id===id);if(i<0)return null;const resolveText=(j:number)=>({id:highlights[j]!.id,bookId:highlights[j]!.bookId,title:snapshot.books.find(b=>b.id===highlights[j]!.bookId)?.title,tags:highlights[j]!.tagIds,text:highlights[j]!.text});return {anchor:resolveText(i),original:rankedRow(matrix,n,i).slice(0,5).map(resolveText),baseline:pointNeighbors(orderedPoints(snapshot.map!),i).slice(0,5).map(resolveText),candidate:pointNeighbors(points,i).slice(0,5).map(resolveText)};});
            await writeFile(resolve(out,`${method}-review.json`),JSON.stringify(review,null,2),{flag:'wx'});
        }
    }
}
await writeFile(resolve(out,'report.json'),JSON.stringify({scope,sourceSnapshotHash:sourceHash,sourceVectorHash:vectorHash,implementationHash,parameters:{neighbors:NEIGHBORS,minDist:.14,spread:1.25,epochs:350,tagWeight:TAG_WEIGHT,seeds},count:n,books:byBook.size,heldBooks:[...holdout],baseline,results,stability,seconds:(performance.now()-start)/1000,peakRss:process.resourceUsage().maxRSS,limits:'Model geometry is not semantic truth. Label holdout is transductive. Label anchors are optimized in-sample. Published baseline was fit on the full local corpus. No parameter grid or winner seed.'},null,2),{flag:'wx'});
console.log('Completed',out);
