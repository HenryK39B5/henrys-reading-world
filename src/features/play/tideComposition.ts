export type TidePlacement={x:number;y:number;width:number;fontSize:number;lines:number};
/** Authored typographic composition, never semantic coordinates. Positions are fractions of the stage. */
export function tidePlacement(index:number,width:number,height:number,held:boolean):TidePlacement{
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||index<0||index>6)throw Error('Invalid tide composition');
    if(width<760){
        const slots=[{x:.08,y:.23,width:.79,fontSize:23,lines:3},{x:.22,y:.43,width:.70,fontSize:18,lines:3},{x:.08,y:.62,width:.74,fontSize:21,lines:2},{x:.27,y:.79,width:.64,fontSize:18,lines:2}];
        const slot=slots[index%4] as TidePlacement;
        return {...slot,fontSize:width<300?slot.fontSize-2:slot.fontSize};
    }
    if(held){return {x:index%2===0?.035:.79,y:.15+Math.floor(index/2)*.20,width:.18,fontSize:18,lines:3};}
    const slots:TidePlacement[]=[
        {x:.055,y:.235,width:.29,fontSize:32,lines:3},
        {x:.53,y:.14,width:.24,fontSize:21,lines:3},
        {x:.79,y:.37,width:.175,fontSize:19,lines:3},
        {x:.39,y:.43,width:.29,fontSize:25,lines:3},
        {x:.085,y:.68,width:.22,fontSize:21,lines:3},
        {x:.49,y:.76,width:.23,fontSize:20,lines:3},
        {x:.80,y:.76,width:.16,fontSize:18,lines:3},
    ];
    const slot=slots[index] as TidePlacement;
    return {...slot,fontSize:width<1000?Math.round(slot.fontSize*.85):slot.fontSize};
}
export const TIDE_REDESIGN_PERIOD=36000;
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function tideArrival(time:number,index:number,reduced=false){
    if(!Number.isFinite(time)||time<0||index<0||index>6)throw Error('Invalid tide time');
    const cycle=Math.floor(time/TIDE_REDESIGN_PERIOD),local=time%TIDE_REDESIGN_PERIOD;
    const arrive=ease((local-index*270)/4200),depart=ease((local-28000-index*220)/5800);
    return {cycle,opacity:reduced?1:arrive*(1-depart),x:reduced?0:-(1-arrive)*70+depart*80,y:reduced?0:(1-arrive)*32-depart*38,shore:Math.sin(local/TIDE_REDESIGN_PERIOD*Math.PI*2)};
}
