import {describe,it,expect} from 'vitest';
import {GARDEN_ENTRANCES,gardenEase,gardenSky,gardenSun} from '../src/features/play/gardenDesign.ts';
describe('original decorative garden composition',()=>{
    it('has seven finite, distinct bounded entrances unrelated to corpus coordinates',()=>{
        expect(GARDEN_ENTRANCES).toHaveLength(7);expect(new Set(GARDEN_ENTRANCES.map(p=>p.join(','))).size).toBe(7);
        for(const p of GARDEN_ENTRANCES)expect(p.every(n=>Number.isFinite(n)&&Math.abs(n)<6)).toBe(true);
    });
    it('bounds sunlight and is deterministic without any highlight or vector input',()=>{
        expect(gardenSun(-10)).toEqual(gardenSun(0));expect(gardenSun(10)).toEqual(gardenSun(1));
        expect(gardenSun(.3)).toEqual(gardenSun(.3));expect(gardenSun(0)[0]).toBeLessThan(gardenSun(1)[0]);
        expect(()=>gardenSun(NaN)).toThrow('Invalid light direction');
    });
    it('settles exactly and clamps frame gaps instead of perpetual movement',()=>{
        let position=0;for(let i=0;i<150;i++)position=gardenEase(position,1,1/60);
        expect(position).toBe(1);expect(gardenEase(0,1,100)).toBe(gardenEase(0,1,.1));
        expect(gardenEase(.4,.8,-1)).toBe(.4);expect(()=>gardenEase(0,Infinity,.01)).toThrow();
    });
    it('keeps decorative sky colours bounded at both range endpoints',()=>{
        expect(gardenSky(-1)).toEqual(gardenSky(0));expect(gardenSky(2)).toEqual(gardenSky(1));
        expect(gardenSky(0)).not.toEqual(gardenSky(1));
    });
});
