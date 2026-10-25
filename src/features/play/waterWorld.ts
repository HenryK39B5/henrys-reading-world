import type { TextFlowMode } from '../../domain/textFlow.ts';
export const WATER_TIDE_PERIOD=36000;
export const WATER_RIVER_PERIOD=44000;
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export function waterTide(time:number,reduced=false){
    if(!Number.isFinite(time)||time<0)throw Error('Invalid water time');
    const local=reduced?10000:time%WATER_TIDE_PERIOD;
    const incoming=smooth(local/6200),outgoing=smooth((local-25500)/10000);
    return {surge:incoming*(1-outgoing),cycle:Math.floor(time/WATER_TIDE_PERIOD),phase:local<6200?'incoming':local<25500?'resting':'outgoing'};
}
/** One shoreline controls both the wet edge and passage displacement. No corpus-derived geography. */
export function shoreline(y:number,surge:number){return .16+.58*(1-surge)+.065*Math.sin(y*5.2-.9)+.024*Math.sin(y*10)+.003*Math.sin(y*51)+.0015*Math.sin(y*113+1);}
export function riverCentre(progress:number){return .5+.075*Math.sin(progress*5.8-.8);}
export function waterPassage(mode:TextFlowMode,time:number,index:number,count:number,compact:boolean,reduced=false){
    if(!Number.isFinite(time)||time<0||!Number.isInteger(index)||index<0||index>=count)throw Error('Invalid water passage');
    if(mode==='tide'){
        const tide=waterTide(time,reduced);
        return {offsetX:(1-tide.surge)*.58,offsetY:-(1-tide.surge)*.10,alpha:smooth(tide.surge*1.8),cycle:tide.cycle,progress:tide.surge,x:0};
    }
    const columns=compact?1:3,column=index%columns,rows=Math.ceil((count-column)/columns),base=(Math.floor(index/columns)+.5)/rows;
    const travelled=(reduced?0:time/WATER_RIVER_PERIOD)+base;
    const progress=travelled-Math.floor(travelled),lane=compact?0:column-1;
    return {offsetX:0,offsetY:0,alpha:Math.min(smooth(progress/.055),smooth((1-progress)/.055)),cycle:Math.floor(travelled),progress,x:riverCentre(progress)+lane*.295};
}
export function returnProgress(elapsed:number,reduced=false){if(!Number.isFinite(elapsed))throw Error('Invalid return time');return reduced?1:smooth(elapsed/1100);}
