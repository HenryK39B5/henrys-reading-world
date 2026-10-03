import { describe, it, expect } from 'vitest';
import { filmPoint, filmPose, filmSeed, filmStep } from '../src/features/play/filmGeometry.ts';
describe('decorative virtual membranes, independent of corpus or semantic coordinates',()=>{
    it('stable IDs produce repeatable display variation, not shared Book/Tag colours',()=>{
        expect(filmSeed('h-3501')).toBe(filmSeed('h-3501'));
        expect(filmSeed('h-3501')).not.toBe(filmSeed('h-3502'));
        for(let i=0;i<100;i++)expect(filmSeed(String(i))).toBeGreaterThanOrEqual(0);
    });
    it('bounded surfaces stay finite and unfold as one sheet rather than a book pair',()=>{
        for(const open of [-3,0,.5,1,8])for(let i=0;i<=24;i++)for(let j=0;j<=18;j++){
            const point=filmPoint(i/24,j/18,open,.3);expect(point.every(Number.isFinite)).toBe(true);
            expect(Math.abs(point[0])).toBeLessThan(1.5);expect(Math.abs(point[1])).toBeLessThan(1.5);expect(Math.abs(point[2])).toBeLessThan(1);
        }
        expect(filmPoint(1,.5,1,.2)[0]-filmPoint(0,.5,1,.2)[0]).toBeGreaterThan(filmPoint(1,.5,0,.2)[0]-filmPoint(0,.5,0,.2)[0]);
        expect(()=>filmPoint(NaN,0,0,0)).toThrow('Non-finite');
    });
    it('motion settles exactly, cannot overshoot, and stops driving frames',()=>{
        let current=0;for(let i=0;i<180;i++){current=filmStep(current,1,1/60);expect(current).toBeLessThanOrEqual(1);}
        expect(current).toBe(1);expect(filmStep(current,1,1/60)).toBe(1);
        for(let i=0;i<180;i++)current=filmStep(current,0,1/60);expect(current).toBe(0);
        expect(filmStep(0,1,-1)).toBe(0);expect(()=>filmStep(0,1,NaN)).toThrow('Non-finite');
    });
    it('poses are explicit finite display slots, with phone focus at one stable place',()=>{
        expect(filmPose(0,true)).toEqual(filmPose(0,true));
        for(let i=0;i<7;i++)expect(filmPose(i,false).every(Number.isFinite)).toBe(true);
        expect(filmPose(100,false)).toEqual([0,0,-1]);
    });
});
