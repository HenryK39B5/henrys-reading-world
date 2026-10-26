import { createHash } from 'node:crypto';
import type { Highlight, MapPoint, MapLabel } from '../../src/domain/types.ts';
import type { RawMapPoint } from '../embeddings/mapLayout.ts';

export const COORDINATE_METHOD = 'exact-cosine-48-v1';
export const NEIGHBORS = 48;
export const CANDIDATE_NEIGHBORS = 96;
export const TAG_WEIGHT = .08;
export const SEEDS = [1296126005, 1296126006, 1296126007];
export const hashBytes = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex');
export function heldBooks(highlights: readonly Highlight[]): Set<string> {
    return new Set([...new Set(highlights.map(h => h.bookId))]
        .sort((a,b) => hashBytes(a).localeCompare(hashBytes(b))).filter((_,i) => i % 5 === 0));
}
export function exactDistances(rows: readonly (readonly number[])[]): Float64Array {
    const n=rows.length,d=rows[0]?.length??0;
    if(n<2||d===0||rows.some(r=>r.length!==d||r.some(v=>!Number.isFinite(v))))throw Error('Invalid vectors');
    const flat=new Float64Array(n*d);
    rows.forEach((row,i)=>{const norm=Math.hypot(...row);if(norm===0)throw Error('Zero vector');row.forEach((v,j)=>{flat[i*d+j]=v/norm;});});
    const result=new Float64Array(n*n);
    for(let i=0;i<n;i++)for(let j=0;j<i;j++){
        let dot=0;const a=i*d,b=j*d;for(let k=0;k<d;k++)dot+=flat[a+k]!*flat[b+k]!;
        result[i*n+j]=result[j*n+i]=Math.max(0,Math.min(2,1-dot));
    }
    return result;
}
export function rankedRow(matrix:Float64Array,n:number,i:number):number[]{
    if(matrix.length!==n*n||i<0||i>=n)throw Error('Invalid distance matrix');
    return Array.from({length:n},(_,j)=>j).filter(j=>j!==i).sort((a,b)=>matrix[i*n+a]!-matrix[i*n+b]!||a-b);
}
export function tagDistance(distance:number,a:readonly string[],b:readonly string[],weight=TAG_WEIGHT):number{
    if(!Number.isFinite(distance)||distance<0||weight<0||weight>=1)throw Error('Invalid label distance');
    const shared=a.filter(id=>b.includes(id)).length;
    return shared===0?distance:distance*(1-weight*shared/new Set([...a,...b]).size);
}
export function makeExactKnn(matrix:Float64Array,highlights:readonly Highlight[],weak:boolean){
    const n=highlights.length,holdout=heldBooks(highlights),k=Math.min(NEIGHBORS,n-1);
    const tags=highlights.map(h=>holdout.has(h.bookId)?[]:h.tagIds);
    const indices:number[][]=[],distances:number[][]=[];
    for(let i=0;i<n;i++){
        const candidates=rankedRow(matrix,n,i).slice(0,CANDIDATE_NEIGHBORS);
        const scored=candidates.map(j=>({j,d:weak?tagDistance(matrix[i*n+j]!,tags[i]!,tags[j]!):matrix[i*n+j]!}));
        scored.sort((a,b)=>a.d-b.d||a.j-b.j);
        indices.push([i,...scored.slice(0,k-1).map(p=>p.j)]);
        distances.push([0,...scored.slice(0,k-1).map(p=>p.d)]);
    }
    return {indices,distances,holdout:[...holdout]};
}
/** Similarity transform only; no independent axis scaling or clipping. */
export function uniformMapPoints(raw:readonly RawMapPoint[]):MapPoint[]{
    if(raw.length===0)return [];
    if(raw.some(p=>!Number.isFinite(p.x+p.y))||new Set(raw.map(p=>p.highlightId)).size!==raw.length)throw Error('Invalid raw map');
    const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=9300/Math.max(maxX-minX,maxY-minY,1e-12),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    return raw.map(p=>({highlightId:p.highlightId,x:Math.round(5000+(p.x-cx)*scale),y:Math.round(5000+(p.y-cy)*scale)}));
}
/** A name is placed on an actual member with the strongest local member evidence, not an empty median. */
export function supportedLabels(highlights:readonly Highlight[],points:readonly MapPoint[]):MapLabel[]{
    const byId=new Map(points.map(p=>[p.highlightId,p]));
    const tags=[...new Set(highlights.flatMap(h=>h.tagIds))].sort();
    return tags.map(tagId=>{
        const members=highlights.filter(h=>h.tagIds.includes(tagId)).map(h=>byId.get(h.id)).filter(p=>p!==undefined);
        if(members.length===0)throw Error('Missing label members');
        const ranked=members.map(p=>({p,score:members.reduce((s,q)=>{const d=(p.x-q.x)**2+(p.y-q.y)**2;return s+(p.highlightId!==q.highlightId&&d<=600**2?Math.exp(-d/(2*300**2)):0);},0)}));
        ranked.sort((a,b)=>b.score-a.score||a.p.highlightId.localeCompare(b.p.highlightId));
        const p=ranked[0]!.p;return {tagId,x:p.x,y:p.y};
    });
}
export function mean(values:readonly number[]):number|null{return values.length===0?null:values.reduce((s,v)=>s+v,0)/values.length;}
export function median(values:readonly number[]):number|null{
    if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),m=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[m]!:(sorted[m-1]!+sorted[m]!)/2;
}
export function ranks(values:readonly number[]):number[]{
    const result=new Array<number>(values.length),sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v||a.i-b.i);
    for(let i=0;i<sorted.length;){let end=i+1;while(end<sorted.length&&sorted[end]!.v===sorted[i]!.v)end++;for(let j=i;j<end;j++)result[sorted[j]!.i]=(i+end-1)/2;i=end;}return result;
}
export function rankCorrelation(a:readonly number[],b:readonly number[]):number|null{
    if(a.length!==b.length||a.length<2)return null;const x=ranks(a),y=ranks(b),mx=mean(x)!,my=mean(y)!;
    let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){const dx=x[i]!-mx,dy=y[i]!-my;xy+=dx*dy;xx+=dx*dx;yy+=dy*dy;}return xx*yy===0?null:xy/Math.sqrt(xx*yy);
}
export function pointNeighbors(points:readonly MapPoint[],i:number):number[]{
    const p=points[i]!;return points.map((q,j)=>({j,d:(p.x-q.x)**2+(p.y-q.y)**2})).filter(q=>q.j!==i).sort((a,b)=>a.d-b.d||a.j-b.j).map(q=>q.j);
}
