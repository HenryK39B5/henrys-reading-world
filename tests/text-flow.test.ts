import {describe,it,expect} from 'vitest';
import {flowBatch,textFlowPose,stepFlowClock,flowExcerpt,TIDE_DURATION} from '../src/domain/textFlow.ts';
import {pageRandom} from '../src/domain/playExperience.ts';
import type {Highlight} from '../src/domain/types.ts';
import {readFileSync} from 'node:fs';
const real=(JSON.parse(readFileSync(new URL('../src/data/public-snapshot.json',import.meta.url),'utf8')) as {highlights:Highlight[]}).highlights;
describe('text flows use real originals and bounded decorative time',()=>{
 it('reproducible batch is genuine, unique and book-first, including unknown tags',()=>{const batch=flowBatch(real,7,pageRandom('flow'));expect(batch).toEqual(flowBatch(real,7,pageRandom('flow')));expect(new Set(batch.map(h=>h.id)).size).toBe(7);expect(new Set(batch.map(h=>h.bookId)).size).toBe(7);expect(batch.every(h=>real.includes(h))).toBe(true);});
 it('seed original retained; never duplicates even with exhausted avoidance',()=>{const first=real[0];expect(first).toBeDefined();const scope=real.slice(0,3);const batch=flowBatch(scope,7,()=>.5,new Set(scope.map(h=>h.id)),first?.id);expect(batch[0]).toBe(first);expect(new Set(batch.map(h=>h.id)).size).toBe(3);expect(batch.length).toBe(3);expect(flowBatch([],7,()=>.5)).toEqual([]);});
 it('avoids the previous batch when enough input remains',()=>{const old=flowBatch(real,7,pageRandom('old'));const next=flowBatch(real,7,pageRandom('next'),new Set(old.map(h=>h.id)));expect(next.some(h=>old.includes(h))).toBe(false);});
 it('all temporal poses stay finite, bounded and nonsemantic',()=>{for(const mode of ['river','tide'] as const)for(const compact of [true,false])for(let time=0;time<150000;time+=701)for(let i=0;i<7;i++){const p=textFlowPose(mode,time,i,7,compact);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(1);expect(p.opacity).toBeGreaterThanOrEqual(0);expect(p.opacity).toBeLessThanOrEqual(1);expect(p.phase).toBeGreaterThanOrEqual(0);expect(p.phase).toBeLessThan(1);expect(Number.isFinite(p.drift)).toBe(true);}});
 it('tide has shared readable dwell and renews as a batch, unlike continuous river',()=>{expect(textFlowPose('tide',10000,6,7,false).opacity).toBe(1);expect(textFlowPose('tide',33000,0,7,false).opacity).toBe(0);expect(textFlowPose('tide',TIDE_DURATION+10000,6,7,false).cycle).toBe(1);expect(textFlowPose('river',10000,0,7,false).phase).not.toBe(textFlowPose('river',11000,0,7,false).phase);});
 it('hidden/paused clocks do not advance, large scheduling gaps clamp',()=>{expect(stepFlowClock(500,2000,false)).toBe(500);expect(stepFlowClock(500,2000,true)).toBe(580);expect(stepFlowClock(500,-10,true)).toBe(500);expect(()=>stepFlowClock(NaN,10,true)).toThrow();});
 it('preview is a Unicode-safe original prefix, never generated text',()=>{const text=real.find(h=>h.text.length>100)?.text??'';expect(flowExcerpt(text,30)).toBe(Array.from(text).slice(0,30).join('')+'…');expect(flowExcerpt('𠮷字',1)).toBe('𠮷…');expect(flowExcerpt(text,100000)).toBe(text);});
});
