export type FilmPoint = [number, number, number];

/** These poses and colours are composition, not semantic coordinates or Tag categories. */
export function filmPose(index: number, compact: boolean): FilmPoint {
    const poses: FilmPoint[] = compact
        ? [[0,-0.45,1],[-2.25,1.55,-1],[2.25,1.15,-1]]
        : [[0,-0.1,1],[-3.6,1.9,-0.4],[-3.7,-1.25,-0.7],[0.1,2.85,-1],[3.6,1.75,-0.6],[3.7,-1.4,-0.3],[0.1,-2.95,-0.8]];
    return poses[index] ?? [0,0,-1];
}
export function filmSeed(id: string): number {
    let value=2166136261;
    for (const char of id) value=Math.imul(value^char.charCodeAt(0),16777619)>>>0;
    return value / 4294967296;
}
export function filmStep(value:number,target:number,seconds:number):number {
    if (![value,target,seconds].every(Number.isFinite)) throw Error('Non-finite film motion');
    const result=target+(value-target)*Math.exp(-13*Math.max(0,Math.min(seconds,0.1)));
    return Math.abs(result-target)<0.002 ? target : result;
}
/** A single asymmetrical membrane, never two book leaves or a simulated book spine. */
export function filmPoint(u:number,v:number,open:number,seed:number):FilmPoint {
    if (![u,v,open,seed].every(Number.isFinite)) throw Error('Non-finite membrane');
    const spread=Math.max(0,Math.min(1,open));
    const x=(u-0.5)*(1.65+spread*0.95)+0.15*Math.sin(v*Math.PI);
    const y=(v-0.5)*(2.10+spread*0.45)+0.09*Math.sin(u*Math.PI*2+seed*2);
    const z=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*(0.36-spread*0.22)
        +Math.sin(v*Math.PI*1.5+seed)*(u-0.5)*(0.42-spread*0.18);
    return [x,y,z];
}
