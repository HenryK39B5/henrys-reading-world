export type GardenPoint = [number,number,number];
/** An original stage composition, not a projection of corpus relationships or production terrain. */
export const GARDEN_ENTRANCES:readonly GardenPoint[]=[
    [0,2.15,0.55],[-3.3,1.60,-1.25],[3.0,1.05,1.25],[-2.5,0.75,3.15],[3.4,2.50,-2.05],[-4.15,1.0,0.9],[1.8,0.85,3.2],
];
export function gardenEntrance(index:number,compact:boolean):GardenPoint {
    const slot=compact?[0,3,4][index]:index;
    return GARDEN_ENTRANCES[slot??0]??[0,2.15,.55];
}
export function gardenSun(value:number):GardenPoint {
    if(!Number.isFinite(value))throw Error('Invalid light direction');
    const t=Math.max(0,Math.min(1,value));return [-5.5+11*t,4.4+Math.sin(t*Math.PI)*.6,-5];
}
export function gardenEase(current:number,target:number,seconds:number):number {
    if(![current,target,seconds].every(Number.isFinite))throw Error('Invalid garden response');
    const next=target+(current-target)*Math.exp(-11*Math.max(0,Math.min(seconds,.1)));
    return Math.abs(next-target)<.002?target:next;
}
export function gardenSky(value:number):{top:string;bottom:string} {
    const t=Math.max(0,Math.min(1,value));
    // Decorative daylight mixing only. Neither colours nor light directions encode Tags.
    const blend=(a:number[],b:number[])=>`rgb(${a.map((n,i)=>Math.round(n+((b[i]??n)-n)*t)).join(',')})`;
    return {top:blend([103,125,155],[78,101,142]),bottom:blend([228,172,149],[233,182,151])};
}
