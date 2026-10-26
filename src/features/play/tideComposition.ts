export type TidePlacement={x:number;y:number;width:number;fontSize:number;lines:number};
/** Authored typographic composition, never semantic coordinates. Positions are fractions of the stage. */
export function tidePlacement(index:number,width:number,height:number,_held:boolean):TidePlacement{
    // Keep the legacy call shape; selection no longer participates in placement.
    void _held;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||index<0||index>6)throw Error('Invalid tide composition');
    if(width<760){
        const slots=[{x:.10,y:.25,width:.72,fontSize:19,lines:2},{x:.24,y:.43,width:.65,fontSize:18,lines:2},{x:.10,y:.62,width:.69,fontSize:18,lines:2},{x:.28,y:.79,width:.61,fontSize:18,lines:2}];
        const slot=slots[index%4] as TidePlacement;
        return {...slot,fontSize:Math.max(17,slot.fontSize-(width<300?1:0))};
    }
    // Reading can obscure the world, but must never rearrange it.
    const slots:TidePlacement[]=[
        {x:.09,y:.25,width:.23,fontSize:21,lines:2},
        {x:.51,y:.17,width:.23,fontSize:19,lines:2},
        {x:.79,y:.36,width:.17,fontSize:18,lines:2},
        {x:.37,y:.46,width:.24,fontSize:20,lines:2},
        {x:.12,y:.68,width:.21,fontSize:19,lines:2},
        {x:.49,y:.77,width:.22,fontSize:18,lines:2},
        {x:.78,y:.73,width:.18,fontSize:18,lines:2},
    ];
    const slot=slots[index] as TidePlacement;
    return {...slot,fontSize:width<1000?Math.max(18,slot.fontSize-1):slot.fontSize};
}
export const TIDE_REDESIGN_PERIOD=36000;
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function tideArrival(time:number,index:number,reduced=false){
    if(!Number.isFinite(time)||time<0||index<0||index>6)throw Error('Invalid tide time');
    const cycle=Math.floor(time/TIDE_REDESIGN_PERIOD),local=time%TIDE_REDESIGN_PERIOD;
    const arrive=ease((local-index*270)/4200),depart=ease((local-28000-index*220)/5800);
    return {cycle,opacity:reduced?1:arrive*(1-depart),x:reduced?0:-(1-arrive)*70+depart*80,y:reduced?0:(1-arrive)*32-depart*38,shore:Math.sin(local/TIDE_REDESIGN_PERIOD*Math.PI*2)};
}
