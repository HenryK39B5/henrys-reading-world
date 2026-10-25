import {describe,it,expect} from 'vitest';
import {tidePlacement,tideArrival,TIDE_REDESIGN_PERIOD} from '../src/features/play/tideComposition.ts';
describe('second tide is an authored, bounded composition',()=>{
 it('wide composition is not a three-column grid and stays within the stage',()=>{
  const slots=Array.from({length:7},(_,i)=>tidePlacement(i,1064,800,false));expect(new Set(slots.map(p=>p.x)).size).toBe(7);
  for(const p of slots){expect(p.x).toBeGreaterThan(0);expect(p.x+p.width).toBeLessThan(1);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(.9);expect(p.fontSize).toBeGreaterThanOrEqual(18);}
 });
 it('small-screen four paragraphs stay separate at their maximum layout heights',()=>{
  for(const w of [244,316,646]){const slots=Array.from({length:4},(_,i)=>tidePlacement(i,w,800,false));for(let i=0;i<3;i++){const a=slots[i],b=slots[i+1];if(a===undefined||b===undefined)throw Error('Missing slot');expect(a.y*800+a.lines*a.fontSize*1.57+45).toBeLessThan(b.y*800);}}
 });
 it('floating previews stay small, two-line and distinct from full reading typography',()=>{for(const w of [244,316,1064])for(let i=0;i<(w<760?4:7);i++){const p=tidePlacement(i,w,820,false);expect(p.lines).toBe(2);expect(p.fontSize).toBeGreaterThanOrEqual(17);expect(p.fontSize).toBeLessThanOrEqual(w<760?19:21);}});
 it('held side previews retain legible sizes rather than miniature labels',()=>{for(let i=0;i<7;i++){const p=tidePlacement(i,1064,820,true);expect(p.fontSize).toBe(18);expect(p.lines).toBe(2);}});
 it('arrival/departure and still dwell share a continuous finite cycle',()=>{
  for(let t=0;t<80000;t+=137)for(let i=0;i<7;i++){const p=tideArrival(t,i);expect(p.opacity).toBeGreaterThanOrEqual(0);expect(p.opacity).toBeLessThanOrEqual(1);expect(Number.isFinite(p.x+p.y+p.shore)).toBe(true);}
  expect(tideArrival(10000,6).opacity).toBe(1);expect(tideArrival(10000,6).x).toBe(0);expect(tideArrival(TIDE_REDESIGN_PERIOD+10000,6).cycle).toBe(1);
 });
 it('reduced motion cancels displacement and keeps all text legible',()=>{for(let i=0;i<7;i++){const p=tideArrival(35500,i,true);expect(p.opacity).toBe(1);expect(p.x).toBe(0);expect(p.y).toBe(0);}});
 it('rejects nonfinite inputs, no arbitrary data or semantic coordinates',()=>{expect(()=>tidePlacement(0,NaN,800,false)).toThrow();expect(()=>tideArrival(-1,0)).toThrow();});
});
