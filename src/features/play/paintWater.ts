import type { TextFlowMode } from '../../domain/textFlow.ts';
import { riverCentre,shoreline,waterTide } from './waterWorld.ts';
/** Original Canvas art, no textures/CDN/semantic data. Same time and water field as passage movement. */
export function paintWater(ctx:CanvasRenderingContext2D,w:number,h:number,time:number,mode:TextFlowMode,reduced:boolean){
    const t=reduced?10000:time;const seconds=t/1000;
    ctx.globalAlpha=1;
    const bank=ctx.createLinearGradient(0,0,w,h);bank.addColorStop(0,'#253c3b');bank.addColorStop(.45,'#5c685b');bank.addColorStop(1,'#9b9475');ctx.fillStyle=bank;ctx.fillRect(0,0,w,h);
    const tide=waterTide(t,reduced);const edge=(y:number)=>shoreline(y,tide.surge)*w;
    const left=(y:number)=>(riverCentre(y)-.485)*w,right=(y:number)=>(riverCentre(y)+.485)*w;
    const boundary=(offset=0)=>{
        ctx.beginPath();if(mode==='tide'){
            ctx.moveTo(edge(0)+offset,0);for(let j=1;j<=100;j++){const y=j/100;ctx.lineTo(edge(y)+offset,h*y);}ctx.lineTo(w,h);ctx.lineTo(w,0);
        }else{
            ctx.moveTo(left(0)+offset,0);for(let j=1;j<=100;j++){const y=j/100;ctx.lineTo(left(y)+offset,h*y);}for(let j=100;j>=0;j--){const y=j/100;ctx.lineTo(right(y)-offset,h*y);}
        }ctx.closePath();
    };
    // Damp margin remains behind the leading wash; translucent shallows meet the deeper channel.
    boundary(-26);ctx.fillStyle='rgba(16,53,52,.30)';ctx.fill();
    boundary();const water=ctx.createLinearGradient(mode==='tide'?w*.1:0,0,w,h*.3);
    water.addColorStop(0,'#527c74');water.addColorStop(.24,'#2d6664');water.addColorStop(.62,'#124b55');water.addColorStop(1,'#092f40');ctx.fillStyle=water;ctx.fill();
    ctx.save();ctx.clip();
    const light=ctx.createRadialGradient(w*.74,h*.20,0,w*.74,h*.20,w*.67);light.addColorStop(0,'rgba(190,204,168,.19)');light.addColorStop(.5,'rgba(103,169,159,.07)');light.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    // Moving streaks follow the channel, not independent decorative particles.
    if(mode==='river')for(let lane=0;lane<15;lane++){
        const lateral=(lane-7)*.063;ctx.beginPath();
        for(let j=0;j<=70;j++){const y=j/70;const x=(riverCentre(y)+lateral+Math.sin(y*16+seconds*.25+lane)*.003)*w;if(j===0)ctx.moveTo(x,y*h);else ctx.lineTo(x,y*h);}
        ctx.lineWidth=lane%4===0?1.1:.6;ctx.strokeStyle=`rgba(175,212,192,${lane%4===0?.10:.035})`;ctx.stroke();
    }
    for(let n=0;n<64;n++){
        const seed=Math.sin(n*147.31)*43758.5453;const u=seed-Math.floor(seed);
        const y=((n*.047+seconds*(mode==='river'?.022:.003))%1+1)%1;
        const x=mode==='river'?(riverCentre(y)+(u-.5)*.88)*w:(.20+u*.85)*w;
        const length=(4+Math.pow(Math.sin(n*3.3+seconds*.3),2)*24)*(w<760?.65:1);
        ctx.strokeStyle=`rgba(197,220,196,${.025+Math.pow(Math.sin(n+seconds*.4),8)*.09})`;ctx.lineWidth=.6;
        ctx.beginPath();ctx.moveTo(x,y*h);ctx.quadraticCurveTo(x+length*.5,y*h-1.5,x+length,y*h);ctx.stroke();
    }
    // Shallow-water caustics: stretched, broken filaments, never text-shaped noise.
    for(let strand=0;strand<14;strand++){
        ctx.beginPath();const base=(strand+.5)/14;
        for(let j=0;j<=32;j++){const v=j/32;const y=(v+.018*Math.sin(seconds*.22+strand)) *h;
            const x=(mode==='tide'?shoreline(v,tide.surge)+base*.75:riverCentre(v)+(base-.5)*.88)*w+Math.sin(v*22+strand*1.7+seconds*.35)*7;
            if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.setLineDash([8+strand%5,15+strand%11]);ctx.lineDashOffset=-seconds*4;ctx.lineWidth=.65;ctx.strokeStyle=`rgba(189,221,194,${.022+(strand%4)*.009})`;ctx.stroke();
    }ctx.setLineDash([]);ctx.lineDashOffset=0;
    // Tide fronts are parallel to the same shoreline that carries the text onto the shallows.
    if(mode==='tide')for(let wave=0;wave<5;wave++){
        const offset=wave*34+Math.sin(seconds*.5+wave)*5;
        ctx.beginPath();for(let j=0;j<=100;j++){const y=j/100;const x=edge(y)+offset+Math.sin(y*35+seconds*.7+wave)*2;if(j===0)ctx.moveTo(x,0);else ctx.lineTo(x,y*h);}
        ctx.strokeStyle=`rgba(218,231,209,${wave===0?.48:.12-wave*.019})`;ctx.lineWidth=wave===0?1.7:.8;ctx.stroke();
    }
    ctx.restore();
    // A quiet near bank frames the reading foreground. Soft vignette is not a modal panel.
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(8,27,31,.65)');shade.addColorStop(.24,'rgba(8,27,31,0)');shade.addColorStop(.85,'rgba(8,27,31,0)');shade.addColorStop(1,'rgba(8,27,31,.65)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    if(mode==='river'){
        ctx.strokeStyle='rgba(201,192,147,.32)';ctx.lineWidth=1;ctx.beginPath();for(let j=0;j<=80;j++){const y=j/80;if(j===0)ctx.moveTo(left(y),0);else ctx.lineTo(left(y),y*h);}ctx.stroke();
    }
}
