import type { TextFlowMode } from '../../domain/textFlow.ts';
export type ReadingPoint={x:number;y:number};
/** Bounded decorative travel; never changes the selected ID or the content scope. */
export function readingTransfer(mode:TextFlowMode,from:ReadingPoint,to:ReadingPoint,progress:number):ReadingPoint{
    if(![from.x,from.y,to.x,to.y,progress].every(Number.isFinite))throw Error('Invalid reading transfer');
    const t=Math.max(0,Math.min(1,progress)),u=1-t;
    const dx=to.x-from.x,dy=to.y-from.y;
    const bend=Math.min(48,Math.hypot(dx,dy)*.16);
    const a=mode==='river'?{x:from.x+dx*.12,y:from.y+dy*.5+bend}:{x:from.x+dx*.6,y:from.y};
    const b=mode==='river'?{x:to.x-dx*.16,y:to.y-bend}:{x:to.x-dx*.12,y:to.y};
    return {x:u*u*u*from.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*to.x,y:u*u*u*from.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*to.y};
}
export function readingOverflow(scrollTop:number,clientHeight:number,scrollHeight:number){
    return {above:scrollTop>3,below:scrollHeight-clientHeight-scrollTop>3};
}
