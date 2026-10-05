import type { Highlight } from './types.ts';
import { playfulEncounter } from './playWorld.ts';
export type TextFlowMode='river'|'tide';
export const TIDE_DURATION=34000;
export const RIVER_DURATION=42000;
export function flowBatch(members:readonly Highlight[],count:number,rng:()=>number,avoid:ReadonlySet<string>=new Set(),firstId:string|null=null):Highlight[]{
    const chosen:Highlight[]=[];const seen=new Set(avoid);const first=members.find(h=>h.id===firstId);
    if(first!==undefined&&count>0){chosen.push(first);seen.add(first.id);}
    while(chosen.length<count){
        const occupied=new Set(chosen.map(h=>h.bookId));const unusedBooks=members.filter(h=>!occupied.has(h.bookId));
        let id=playfulEncounter(unusedBooks.length>0?unusedBooks:members,seen,rng);
        if(id===null)id=playfulEncounter(members,new Set(chosen.map(h=>h.id)),rng);
        const next=members.find(h=>h.id===id);if(next===undefined)break;
        chosen.push(next);seen.add(next.id);
    }return chosen;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
export type TextFlowPose={x:number;phase:number;opacity:number;drift:number;cycle:number};
/** Temporal composition only; no positions encode semantics or production map coordinates. */
export function textFlowPose(mode:TextFlowMode,time:number,index:number,count:number,compact:boolean):TextFlowPose{
    if(!Number.isFinite(time)||time<0||index<0||index>=count)throw Error('Invalid text-flow phase');
    const columns=compact?1:3;const column=index%columns;const row=Math.floor(index/columns);
    const rows=Math.ceil((count-column)/columns);const base=(row+.5)/rows;
    const x=compact?.5:[.18,.50,.82][column]??.5;
    if(mode==='river'){
        const travel=time/RIVER_DURATION+base;const phase=travel-Math.floor(travel);
        return {x:x+Math.sin(phase*Math.PI*2)*.014,phase,opacity:Math.min(smooth(phase/.07),smooth((1-phase)/.07)),drift:0,cycle:Math.floor(travel)};
    }
    const cycle=Math.floor(time/TIDE_DURATION);const local=time%TIDE_DURATION;
    const arrival=smooth((local-250-index*210)/4500);const leaving=smooth((local-25500-index*210)/7000);
    return {x,phase:base,opacity:arrival*(1-leaving),drift:(1-arrival)*28-leaving*25,cycle};
}
export function stepFlowClock(time:number,delta:number,active:boolean):number{
    if(!Number.isFinite(time)||!Number.isFinite(delta))throw Error('Invalid text-flow clock');
    return active?time+Math.max(0,Math.min(delta,80)):time;
}
/** Preview remains an exact prefix. Original text is never overwritten or reassembled. */
export function flowExcerpt(text:string,limit:number):string{
    const chars=Array.from(text);return chars.length<=limit?text:chars.slice(0,Math.max(0,limit)).join('')+'…';
}
