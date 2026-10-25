import type { TextFlowMode } from '../../domain/textFlow.ts';
import { riverCentre,shoreline,waterTide } from './waterWorld.ts';
export type WaterArt={bank:HTMLCanvasElement|null;bed:HTMLCanvasElement|null;detail:HTMLCanvasElement|null;water:Path2D;wet:Path2D[];fronts:Path2D[];shallows:Path2D[];streams:Path2D;shade:CanvasGradient};
/** Cache only paint and fixed geometry, never the moving coastline. Rebuilt on actual resize/mode change. */
export function createWaterArt(ctx:CanvasRenderingContext2D,w:number,h:number,mode:TextFlowMode):WaterArt{
    const layer=(paint:(c:CanvasRenderingContext2D)=>void)=>{const canvas=document.createElement('canvas');const scale=Math.min(1,768/w);canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const c=canvas.getContext('2d');if(c===null)return null;c.scale(scale,scale);paint(c);return canvas;};
    const edge=(y:number)=>shoreline(y,1)*w,left=(y:number)=>(riverCentre(y)-.485)*w,right=(y:number)=>(riverCentre(y)+.485)*w;
    const boundary=(offset=0)=>{const path=new Path2D();path.moveTo((mode==='tide'?edge(0):left(0))+offset,0);for(let j=1;j<=80;j++){const y=j/80;path.lineTo((mode==='tide'?edge(y):left(y))+offset,h*y);}if(mode==='tide'){path.lineTo(w*2,h);path.lineTo(w*2,0);}else for(let j=80;j>=0;j--){const y=j/80;path.lineTo(right(y)-offset,h*y);}path.closePath();return path;};
    const line=(offset:number)=>{const path=new Path2D();for(let j=0;j<=80;j++){const y=j/80,x=(mode==='tide'?edge(y):left(y))+offset;if(j===0)path.moveTo(x,0);else path.lineTo(x,y*h);}return path;};
    const bank=layer(c=>{const gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#253c3b');gradient.addColorStop(.45,'#5c685b');gradient.addColorStop(1,'#9b9475');c.fillStyle=gradient;c.fillRect(0,0,w,h);for(let n=0;n<48;n++){const x=Math.abs((Math.sin(n*71.7)*9187.1)%1)*w,y=Math.abs((Math.sin(n*39.2)*3711.4)%1)*h;c.strokeStyle=n%3===0?'rgba(211,202,160,.10)':'rgba(17,46,43,.12)';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+5,y-2,x+9+n%7,y-1);c.stroke();}});
    const bed=layer(c=>{const gradient=c.createLinearGradient(mode==='tide'?w*.1:0,0,w,h*.3);gradient.addColorStop(0,'#527c74');gradient.addColorStop(.24,'#2d6664');gradient.addColorStop(.62,'#124b55');gradient.addColorStop(1,'#092f40');c.fillStyle=gradient;c.fillRect(0,0,w,h);const light=c.createRadialGradient(w*.74,h*.20,0,w*.74,h*.20,w*.67);light.addColorStop(0,'rgba(190,204,168,.19)');light.addColorStop(.5,'rgba(103,169,159,.07)');light.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=light;c.fillRect(0,0,w,h);});
    const detail=layer(c=>{for(let strand=0;strand<12;strand++){const base=(strand+.5)/12;c.beginPath();for(let j=0;j<=32;j++){const v=j/32,x=(mode==='tide'?shoreline(v,1)+base*.75:riverCentre(v)+(base-.5)*.88)*w+Math.sin(v*22+strand*1.7)*7;if(j===0)c.moveTo(x,0);else c.lineTo(x,v*h);}c.setLineDash([8+strand%5,15+strand%11]);c.lineWidth=.65;c.strokeStyle=`rgba(189,221,194,${.022+(strand%4)*.009})`;c.stroke();}});
    const streams=new Path2D();if(mode==='river')for(let lane=0;lane<11;lane++){const lateral=(lane-5)*.088;for(let j=0;j<=48;j++){const y=j/48,x=(riverCentre(y)+lateral)*w;if(j===0)streams.moveTo(x,0);else streams.lineTo(x,y*h);}}
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(8,27,31,.65)');shade.addColorStop(.24,'rgba(8,27,31,0)');shade.addColorStop(.85,'rgba(8,27,31,0)');shade.addColorStop(1,'rgba(8,27,31,.65)');
    return {bank,bed,detail,water:boundary(),wet:[boundary(-30),boundary(-18),boundary(-7)],fronts:[line(0),line(34),line(68)],shallows:[line(8),line(18),line(28)],streams,shade};
}
/** Coast, water and letters are submitted on the same animation frame and the same elapsed time. */
export function paintWater(ctx:CanvasRenderingContext2D,w:number,h:number,time:number,mode:TextFlowMode,reduced:boolean,art:WaterArt){
    const t=reduced?10000:time,seconds=t/1000,shift=mode==='tide'?(1-waterTide(t,reduced).surge)*.58*w:0;
    ctx.globalAlpha=1;if(art.bank!==null)ctx.drawImage(art.bank,0,0,w,h);else{ctx.fillStyle='#425b50';ctx.fillRect(0,0,w,h);}
    ctx.save();ctx.translate(shift,0);
    art.wet.forEach((path,i)=>{ctx.fillStyle=['rgba(29,66,59,.16)','rgba(16,53,52,.20)','rgba(13,48,48,.24)'][i]??'#183638';ctx.fill(path);});
    ctx.save();ctx.clip(art.water);if(art.bed!==null)ctx.drawImage(art.bed,-shift,0,w,h);else{ctx.fillStyle='#164b52';ctx.fillRect(-shift,0,w,h);}
    if(art.detail!==null)ctx.drawImage(art.detail,Math.sin(seconds*.22)*2,Math.sin(seconds*.19)*2,w,h);
    art.shallows.forEach((path,i)=>{ctx.lineWidth=12-i*3;ctx.strokeStyle=`rgba(166,192,154,${.07-i*.018})`;ctx.stroke(path);});
    if(mode==='river'){ctx.lineWidth=.8;ctx.strokeStyle='rgba(175,212,192,.065)';ctx.stroke(art.streams);}
    // A small bounded number of glints follows the same field, rather than regenerating all the texture.
    for(let n=0;n<12;n++){const seed=Math.sin(n*147.31)*43758.5453,u=seed-Math.floor(seed),y=((n*.083+seconds*(mode==='river'?.022:.003))%1+1)%1;const x=(mode==='river'?riverCentre(y)+(u-.5)*.88:.20+u*.85)*w;const length=5+Math.pow(Math.sin(n*3.3+seconds*.3),2)*17;ctx.lineWidth=.6;ctx.strokeStyle=`rgba(197,220,196,${.025+Math.pow(Math.sin(n+seconds*.4),8)*.07})`;ctx.beginPath();ctx.moveTo(x,y*h);ctx.quadraticCurveTo(x+length*.5,y*h-1.5,x+length,y*h);ctx.stroke();}
    if(mode==='tide')art.fronts.forEach((path,i)=>{ctx.save();ctx.translate(Math.sin(seconds*.5+i)*2,0);ctx.strokeStyle=`rgba(218,231,209,${i===0?.28:.08-i*.018})`;ctx.lineWidth=i===0?1.2:.7;ctx.stroke(path);ctx.restore();});
    ctx.restore();if(mode==='river'){ctx.strokeStyle='rgba(201,192,147,.25)';ctx.lineWidth=.8;const edge=art.fronts[0];if(edge!==undefined)ctx.stroke(edge);}ctx.restore();
    ctx.fillStyle=art.shade;ctx.fillRect(0,0,w,h);
}
