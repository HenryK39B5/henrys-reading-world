import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Snapshot} from '../src/domain/types.ts';
import {exactDistances,rankedRow,uniformMapPoints,tagDistance,heldBooks,supportedLabels,rankCorrelation,makeExactKnn} from '../scripts/research/mapCoordinatePolish.ts';
const snapshot=JSON.parse(readFileSync('src/data/public-snapshot.json','utf8')) as Snapshot;
describe('map coordinate polish numerical contracts',()=>{
 it('computes symmetric original-space cosine without approximate search',()=>{
  const d=exactDistances([[1,0],[0,2],[1,1],[-1,0]]);expect(d[0]).toBe(0);expect(d[1]).toBe(1);expect(d[3]).toBe(2);expect(d[2]).toBeCloseTo(1-1/Math.sqrt(2));expect(d[8]).toBe(d[2]);expect(rankedRow(d,4,0)).toEqual([2,1,3]);expect(()=>exactDistances([[0,0],[1,1]])).toThrow();
 });
 it('preserves aspect ratio and every extreme rather than clipping',()=>{
  const p=uniformMapPoints([{highlightId:'a',x:0,y:0},{highlightId:'b',x:2,y:1},{highlightId:'c',x:200,y:100}]);
  expect(p.every(q=>q.x>=350&&q.x<=9650&&q.y>=350&&q.y<=9650)).toBe(true);expect((p[2]!.x-p[0]!.x)/(p[2]!.y-p[0]!.y)).toBeCloseTo(2,2);expect(p[1]!.x).toBeLessThan(p[2]!.x);expect(()=>uniformMapPoints([{highlightId:'a',x:NaN,y:0}])).toThrow();
 });
 it('uses positive shared tags only, no penalty for unknown or different tags',()=>{
  expect(tagDistance(.5,[],['tag-001'])).toBe(.5);expect(tagDistance(.5,['tag-002'],['tag-001'])).toBe(.5);expect(tagDistance(.5,['tag-001'],['tag-001'])).toBeCloseTo(.46);expect(tagDistance(.5,['tag-001','tag-002'],['tag-001'])).toBeCloseTo(.48);
 });
 it('holds out whole books deterministically independent of input order',()=>{
  expect([...heldBooks(snapshot.highlights)]).toEqual([...heldBooks([...snapshot.highlights].reverse())]);const held=heldBooks(snapshot.highlights);expect(held.size).toBeGreaterThan(0);expect(held.size).toBeLessThan(snapshot.books.length);
 });
 it('anchors each real tag on one of its own real member points',()=>{
  const map=snapshot.map!;const labels=supportedLabels(snapshot.highlights,map.points);expect(labels).toHaveLength(map.labels.length);
  for(const l of labels){const ids=new Set(snapshot.highlights.filter(h=>h.tagIds.includes(l.tagId)).map(h=>h.id));expect(map.points.some(p=>ids.has(p.highlightId)&&p.x===l.x&&p.y===l.y)).toBe(true);}
 });
 it('includes zero-distance self first in precomputed UMAP neighborhoods',()=>{
  const highlights=snapshot.highlights.slice(0,60);const d=exactDistances(highlights.map((_,i)=>[1,i/60]));const knn=makeExactKnn(d,highlights,false);
  knn.indices.forEach((row,i)=>{expect(row[0]).toBe(i);expect(knn.distances[i]![0]).toBe(0);expect(row).toHaveLength(48);expect(new Set(row).size).toBe(48);expect(knn.distances[i]).toEqual([...knn.distances[i]!].sort((a,b)=>a-b));});
 });
 it('rank correlation handles tied distances explicitly',()=>{expect(rankCorrelation([1,2,2,4],[2,4,4,8])).toBeCloseTo(1);expect(rankCorrelation([1,2,3],[3,2,1])).toBeCloseTo(-1);expect(rankCorrelation([1,1],[2,3])).toBeNull();});
});
