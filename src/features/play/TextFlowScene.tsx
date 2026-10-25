import { useEffect,useRef,useState } from 'react';
import { prepareWithSegments,layoutWithLines,clearCache,type LayoutLinesResult } from '@chenglou/pretext';
import { flowExcerpt,stepFlowClock,type TextFlowMode,type TextFlowPose } from '../../domain/textFlow.ts';
import { tidePlacement } from './tideComposition.ts';
import { paintWater } from './paintWater.ts';
import { readingTransfer } from './readingMotion.ts';
import { waterPassage,waterTide,returnProgress } from './waterWorld.ts';
import { useReducedMotion } from '../encounter/useReducedMotion.ts';
export type FlowText={id:string;text:string;title:string};
type Props={items:FlowText[];mode:TextFlowMode;heldId:string|null;onCatch:(id:string)=>void;onAdvance:(slot:number|null)=>void;onPrevious:()=>void;previousAvailable:boolean};
type Layout={result:LayoutLinesResult;font:string;lineHeight:number;source:string;size:number};
export function TextFlowScene(props:Props){
    const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
    const reduced=useReducedMotion();const [paused,setPaused]=useState(false),[failed,setFailed]=useState(false);
    const latest=useRef({...props,reduced,paused});const requestDraw=useRef<()=>void>(()=>{});
    const hovered=useRef<string|null>(null);const pointer=useRef<{x:number;y:number;distance:number}|null>(null);
    useEffect(()=>{latest.current={...props,reduced,paused};requestDraw.current();},[props,reduced,paused]);
    useEffect(()=>{
        const root=host.current,element=canvas.current;if(root===null||element===null)return;
        const ctx=element.getContext('2d',{alpha:false});if(ctx===null){setFailed(true);return;}
        let frame:number|null=null,disposed=false,inView=true,last=performance.now(),lastPaint=0,time=props.mode==='tide'?6500:0;
        let width=0,height=0,prepares=0,batches=0;const cycles=new Map<number,number>();const cache=new Map<string,Layout>();const displayed=new Map<string,TextFlowPose>();
        const waterLayer=document.createElement('canvas');const waterContext=waterLayer.getContext('2d',{alpha:false});let paintedWaterTime=-Infinity;let paintedReduced=latest.current.reduced;
        const previews=new Map<string,{x:number;y:number;text:Layout}>();let pickup:{id:string;start:number;x:number;y:number;text:Layout}|null=null;
        let priorHeld=latest.current.heldId;let lastReader:{x:number;y:number}|null=null;let returning:{id:string;start:number;x:number;y:number}|null=null;
        const family=getComputedStyle(root).fontFamily;const compact=()=>width<1000;
        const schedule=()=>{if(disposed||frame!==null)return;frame=requestAnimationFrame(paint);};
        requestDraw.current=schedule;
        const resize=()=>{const box=root.getBoundingClientRect();width=box.width;height=box.height;
            const dpr=Math.min(devicePixelRatio||1,1.5);element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);
            element.style.width=width+'px';element.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);waterLayer.width=Math.min(640,Math.round(width));waterLayer.height=Math.round(height*waterLayer.width/width);paintedWaterTime=-Infinity;cache.clear();schedule();};
        const layout=(item:FlowText,index:number,availableWidth:number,displaySize?:number,maxLines?:number):Layout=>{
            const narrow=compact();const size=displaySize??(narrow?18:index===0?23:19);const lineHeight=size*1.57;
            const maxWidth=availableWidth;
            const font=`400 ${size}px ${family}`;const key=`${item.id}|${font}|${maxWidth}|${maxLines??0}`;
            const saved=cache.get(key);if(saved!==undefined)return saved;
            if(cache.size>=128){cache.clear();clearCache();}
            const ceiling=displaySize===undefined?(narrow?30:index===0?36:48):64;
            let low=1,high=Math.min(Array.from(item.text).length,ceiling);let result:LayoutLinesResult={lines:[],lineCount:0,height:0};
            while(low<=high){const limit=Math.floor((low+high)/2);const prepared=prepareWithSegments(flowExcerpt(item.text,limit),font,{whiteSpace:'pre-wrap'});prepares++;
                const candidate=layoutWithLines(prepared,maxWidth,lineHeight);
                if(candidate.lineCount<=(maxLines??(narrow?3:4))){result=candidate;low=limit+1;}else high=limit-1;
            }
            let sourceLimit=Math.min(Array.from(item.title).length,narrow?17:22);let source=flowExcerpt(item.title,sourceLimit);
            ctx.save();ctx.font=`11px ${family}`;while(sourceLimit>1&&ctx.measureText('— '+source).width>maxWidth){source=flowExcerpt(item.title,--sourceLimit);}ctx.restore();
            const value={result,font,lineHeight,source,size};cache.set(key,value);return value;
        };
        const paint=(now:number)=>{
            frame=null;if(disposed)return;const state=latest.current;const focusTarget=state.heldId===null&&document.activeElement instanceof HTMLElement&&document.activeElement.classList.contains('text-flow-hit');const running=!state.paused&&!state.reduced&&!document.hidden&&inView&&!focusTarget;
            const delta=now-last;last=now;time=stepFlowClock(time,delta,running);
            if(now-lastPaint<32&&running){schedule();return;}lastPaint=now;
            if(width<=0||height<=0)return;
            const tide=state.mode==='tide';const narrow=width<760,count=Math.min(state.items.length,narrow?4:7);const held=state.heldId!==null;
            const currentIds=new Set(state.items.map(i=>i.id));for(const id of displayed.keys())if(!currentIds.has(id))displayed.delete(id);
            if(waterContext!==null){if(Math.abs(time-paintedWaterTime)>=80||paintedReduced!==state.reduced){paintedReduced=state.reduced;paintWater(waterContext,waterLayer.width,waterLayer.height,time,state.mode,state.reduced);paintedWaterTime=time;}ctx.drawImage(waterLayer,0,0,width,height);}else paintWater(ctx,width,height,time,state.mode,state.reduced);
            const labels=new Map(Array.from(root.querySelectorAll<HTMLButtonElement>('.text-flow-hit')).map(b=>[b.dataset.highlightId,b]));
            labels.forEach(button=>{button.style.visibility='hidden';});
            const reader=root.parentElement?.parentElement?.querySelector<HTMLElement>('.play-original');
            const rb=held&&reader!==null&&reader!==undefined&&!reader.hidden?reader.getBoundingClientRect():null;const box=root.getBoundingClientRect();
            if(priorHeld!==null&&state.heldId===null&&lastReader!==null)returning={id:priorHeld,start:now,...lastReader};
            const paragraph=rb===null?null:reader?.querySelector('blockquote > p')?.getBoundingClientRect();
            const readingBody=rb===null?null:reader?.querySelector('.play-reading-body')?.getBoundingClientRect();
            if(priorHeld!==state.heldId){const preview=state.heldId===null?undefined:previews.get(state.heldId);pickup=preview===undefined||state.reduced?null:{id:state.heldId as string,start:now,...preview};}
            priorHeld=state.heldId;if(rb!==null)lastReader={x:(paragraph?.x??rb.x+24)-box.x,y:Math.max(paragraph?.y??rb.y+100,readingBody?.y??rb.y)-box.y};
            previews.clear();if(pickup!==null&&(now-pickup.start>=460||state.reduced||pickup.id!==state.heldId))pickup=null;
            if(returning!==null&&returnProgress(now-returning.start,state.reduced)===1)returning=null;
            if(rb!==null){const calm=ctx.createRadialGradient(rb.x-box.x+rb.width*.5,rb.y-box.y+rb.height*.5,0,rb.x-box.x+rb.width*.5,rb.y-box.y+rb.height*.5,Math.max(rb.width,rb.height)*.8);calm.addColorStop(0,'rgba(12,36,38,.90)');calm.addColorStop(.55,'rgba(12,36,38,.74)');calm.addColorStop(1,'rgba(12,36,38,0)');ctx.fillStyle=calm;ctx.fillRect(0,0,width,height);}
            ctx.save();if(rb!==null){ctx.beginPath();ctx.rect(0,0,width,height);ctx.rect(rb.x-box.x-10,rb.y-box.y-10,rb.width+20,rb.height+20);ctx.clip('evenodd');}
            let visible=0;let tideCycle=-1;
            try{for(let index=0;index<count;index++){
                const item=state.items[index];if(item===undefined)continue;
                const water=waterPassage(state.mode,time,index,count,narrow,state.reduced);
                const live={x:tide?water.offsetX*width:water.x,phase:water.progress,opacity:water.alpha,drift:water.offsetY*height,cycle:water.cycle};tideCycle=live.cycle;
                const underPointer=hovered.current===item.id;const phase=underPointer?(displayed.get(item.id)??live):live;displayed.set(item.id,phase);
                const previous=cycles.get(index);cycles.set(index,phase.cycle);
                if(previous!==undefined&&previous!==phase.cycle&&running&&!underPointer&&item.id!==state.heldId&&item.id!==returning?.id){
                    if(state.mode==='river'){state.onAdvance(index);batches++;}
                }
                if(item.id===state.heldId)continue;
                const placement=tidePlacement(index,width,height,held);
                const textWidth=tide?width*placement.width:narrow?width-70:width*.235;
                const text=layout(item,index,textWidth,tide?placement.fontSize:undefined,tide?placement.lines:3);
                const top=190,bottom=height-90;const textHeight=text.result.height+30;
                const travel=Math.max(120,bottom-top);
                let x=tide?width*placement.x+phase.x:width*phase.x-textWidth/2;
                let y=tide?height*placement.y+phase.drift:top+phase.phase*travel-textHeight/2+phase.drift;
                const release=returning?.id===item.id?returnProgress(now-returning.start,state.reduced):null;
                if(returning!==null&&release!==null){const position=readingTransfer(state.mode,returning,{x,y},release);x=position.x;y=position.y;}
                const alpha=state.reduced?.94:Math.max(phase.opacity,release===null?0:.94*(1-release));
                const hiddenByReader=rb!==null&&x+textWidth>rb.x-box.x-10&&x<rb.right-box.x+10&&y+textHeight>rb.y-box.y-10&&y<rb.bottom-box.y+10;
                // Keep whole passages outside the reading bank; never leave clipped stray lines at its edge.
                if(hiddenByReader)continue;
                if(alpha>.1){ctx.globalAlpha=alpha*.18;ctx.strokeStyle='#d9dfc3';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x+textWidth*.5,y+textHeight+9,textWidth*.48,5,0,0,Math.PI);ctx.stroke();}
                ctx.globalAlpha=alpha*(held?.50:1);ctx.font=text.font;ctx.textBaseline='top';
                ctx.fillStyle=hovered.current===item.id?'#ffe2ae':tide?(index===0||index===3?'#f2dbb3':'#d5e0d8'):index===0?'#f3dfb5':'#e5e5d7';
                text.result.lines.forEach((line,i)=>ctx.fillText(line.text,x,y+i*text.lineHeight));
                if(tide&&underPointer){ctx.strokeStyle='#dfc79a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-13);ctx.lineTo(x+24,y-13);ctx.stroke();}
                ctx.font=`11px ${family}`;ctx.fillStyle='#a8bbb6';ctx.fillText('— '+text.source,x,y+text.result.height+7);
                if(alpha>.15){previews.set(item.id,{x,y,text});visible++;const button=labels.get(item.id);if(button!==undefined){
                    button.style.left=(x-10)+'px';button.style.top=(y-10)+'px';button.style.width=(textWidth+20)+'px';button.style.height=Math.max(44,textHeight+15)+'px';button.style.visibility='visible';
                }}
            }}catch{setFailed(true);disposed=true;}
            ctx.restore();ctx.globalAlpha=1;
            if(pickup!==null&&lastReader!==null){const t=Math.min(1,(now-pickup.start)/460);const position=readingTransfer(state.mode,pickup,lastReader,1-Math.pow(1-t,3));ctx.save();ctx.globalAlpha=.85*Math.pow(1-t,2);ctx.font=pickup.text.font;ctx.fillStyle='#f2dfb9';ctx.textBaseline='top';const movingText=pickup.text;movingText.result.lines.forEach((line,i)=>ctx.fillText(line.text,position.x,position.y+i*movingText.lineHeight));ctx.restore();}
            if(state.mode==='tide'&&tideCycle>=0){const old=cycles.get(-1);const inspecting=(hovered.current!==null&&hovered.current!==state.heldId)||returning!==null;
                if(old===undefined||!inspecting)cycles.set(-1,tideCycle);if(old!==undefined&&old!==tideCycle&&running&&!inspecting){state.onAdvance(null);batches++;}}
            root.dataset.flowState='ready';root.dataset.flowFrames=String(Number(root.dataset.flowFrames??'0')+1);
            root.dataset.flowTime=Math.round(time).toString();root.dataset.flowVisible=String(visible);root.dataset.flowCount=String(count);
            root.dataset.flowPrepares=String(prepares);root.dataset.flowBatches=String(batches);root.dataset.flowIds=state.items.map(i=>i.id).join(',');
            root.dataset.flowEdition=tide?'water-shore-3':'water-river-2';root.dataset.waterSurge=waterTide(time,state.reduced).surge.toFixed(4);root.dataset.waterPhase=waterTide(time,state.reduced).phase;root.dataset.flowPickup=pickup?.id??'';root.dataset.flowReturning=returning?.id??'';root.dataset.flowHeld=state.heldId??'';root.dataset.flowReduced=String(state.reduced);root.dataset.flowPaused=String(state.paused||document.hidden||!inView||focusTarget);
            if((running||returning!==null||pickup!==null)&&!disposed)schedule();
        }
        const observer=new ResizeObserver(resize);observer.observe(root);
        const intersection=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;last=performance.now();if(inView)schedule();});intersection.observe(root);
        const visibility=()=>{last=performance.now();if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visibility);
        void document.fonts.ready.then(()=>{if(disposed)return;clearCache();cache.clear();paintedWaterTime=-Infinity;schedule();});resize();
        return()=>{disposed=true;if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);cache.clear();requestDraw.current=()=>{};};
    },[props.mode]);
    return <div className={`play-stage text-flow-${props.mode}`} ref={host} data-testid="text-flow" data-flow-mode={props.mode} data-flow-state={failed?'fallback':undefined}
        onPointerDownCapture={e=>{pointer.current={x:e.clientX,y:e.clientY,distance:0};}}
        onPointerMoveCapture={e=>{const p=pointer.current;if(p!==null)p.distance=Math.max(p.distance,Math.hypot(e.clientX-p.x,e.clientY-p.y));}}
        onClickCapture={e=>{if(e.detail!==0&&(pointer.current?.distance??0)>7&&!(e.target instanceof HTMLInputElement)){e.preventDefault();e.stopPropagation();}}}>
        <canvas ref={canvas} aria-hidden="true"/>
        <div className="text-flow-caption"><span>{props.mode==='tide'?'WHAT THE TIDE BRINGS':'BY THE RIVER, WORDS PASS'}</span><h2>{props.mode==='tide'?'潮来拾句':'临流读字'}</h2><p>{props.mode==='tide'?'水把文字带来，喜欢的留在身边。':'在这里坐一会儿，让文字经过。'}</p></div>
        <div className="text-flow-targets">{props.items.map(item=><button type="button" key={item.id} className="text-flow-hit" data-highlight-id={item.id}
            aria-label={`留住《${item.title}》的划线：${flowExcerpt(item.text,24)}`} onClick={()=>props.onCatch(item.id)}
            onFocus={()=>{hovered.current=item.id;requestDraw.current();}} onBlur={()=>{hovered.current=null;requestDraw.current();}}
            onPointerEnter={()=>{hovered.current=item.id;requestDraw.current();}} onPointerLeave={()=>{hovered.current=null;requestDraw.current();}}>
            <span className="text-flow-sr">{item.text}</span></button>)}</div>
        <div className="text-flow-controls"><button type="button" onClick={()=>setPaused(v=>!v)} aria-pressed={paused}>{paused?'继续流动':'暂停流动'}</button>
            <button type="button" onClick={props.onPrevious} disabled={!props.previousAvailable}>回看刚才</button><span>{reduced?'减少动态 · 静态字景':props.mode==='tide'?'一批到来，一批退去':'多处文字，持续经过'}</span></div>
        {failed?<p className="play-scene-fallback" role="status">文字场暂时不可用；可以从文字目录留住一处，完整原文仍然可读。</p>:null}
    </div>;
}
