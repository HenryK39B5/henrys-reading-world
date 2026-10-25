import {describe,it,expect} from 'vitest';
import {readingTransfer,readingOverflow} from '../src/features/play/readingMotion.ts';
describe('water reading continuity',()=>{
 const from={x:40,y:200},to={x:500,y:450};
 it('both paths start and finish at the exact original coordinates',()=>{for(const mode of ['tide','river'] as const){expect(readingTransfer(mode,from,to,0)).toEqual(from);expect(readingTransfer(mode,from,to,1)).toEqual(to);expect(readingTransfer(mode,from,to,-1)).toEqual(from);expect(readingTransfer(mode,from,to,2)).toEqual(to);}});
 it('river release curves downstream rather than using the tidal path',()=>{expect(readingTransfer('river',from,to,.5).y).toBeGreaterThan(readingTransfer('tide',from,to,.5).y);});
 it('a stationary point is stable and finite through all stages',()=>{for(let i=0;i<=100;i++){expect(readingTransfer('river',from,from,i/100).x).toBeCloseTo(from.x);const p=readingTransfer('tide',from,to,i/100);expect(p.x).toBeGreaterThanOrEqual(from.x);expect(p.x).toBeLessThanOrEqual(to.x);}});
 it('rejects non-finite geometry instead of hiding it in an animation',()=>{expect(()=>readingTransfer('river',from,{x:NaN,y:2},.5)).toThrow();expect(()=>readingTransfer('tide',from,to,Infinity)).toThrow();});
 it('short originals have no false continuation indicator',()=>{expect(readingOverflow(0,400,400)).toEqual({above:false,below:false});expect(readingOverflow(0,400,402)).toEqual({above:false,below:false});});
 it('long originals distinguish beginning, middle and real end',()=>{expect(readingOverflow(0,400,900)).toEqual({above:false,below:true});expect(readingOverflow(200,400,900)).toEqual({above:true,below:true});expect(readingOverflow(500,400,900)).toEqual({above:true,below:false});});
});
