import { useEffect,useRef,useState } from 'react';
import { prepareWithSegments,layoutWithLines,clearCache,type LayoutLinesResult } from '@chenglou/pretext';
import { flowExcerpt,stepFlowClock,textFlowPose,type TextFlowMode,type TextFlowPose } from '../../domain/textFlow.ts';
import { tidePlacement,tideArrival } from './tideComposition.ts';
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
        const family=getComputedStyle(root).fontFamily;const compact=()=>width<1000;
        const schedule=()=>{if(disposed||frame!==null)return;frame=requestAnimationFrame(paint);};
        requestDraw.current=schedule;
        const resize=()=>{const box=root.getBoundingClientRect();width=box.width;height=box.height;
            const dpr=Math.min(devicePixelRatio||1,1.5);element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);
            element.style.width=width+'px';element.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);cache.clear();schedule();};
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
            const tide=state.mode==='tide';const narrow=tide?width<760:compact(),count=Math.min(state.items.length,narrow?4:7);const held=state.heldId!==null;
            const currentIds=new Set(state.items.map(i=>i.id));for(const id of displayed.keys())if(!currentIds.has(id))displayed.delete(id);
            const background=ctx.createLinearGradient(0,0,width*.6,height);
            if(tide){background.addColorStop(0,'#10292b');background.addColorStop(.55,'#173d3e');background.addColorStop(1,'#375454');}
            else{background.addColorStop(0,'#10232e');background.addColorStop(.5,'#162d38');background.addColorStop(1,'#263e43');}
            ctx.globalAlpha=1;ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
            // Broad ink-wash sweep is authored composition, not corpus geography or a relationship.
            if(tide){
                const shore=tideArrival(time,0,state.reduced).shore;const sway=state.reduced?0:shore*height*.025;
                const wash=ctx.createLinearGradient(width*.15,height*.8,width,height*.25);
                wash.addColorStop(0,'rgba(162,167,141,0)');wash.addColorStop(.63,'rgba(162,167,141,.05)');wash.addColorStop(1,'rgba(204,186,139,.20)');
                for(let ribbon=0;ribbon<12;ribbon++){
                    const offset=ribbon*7+sway;ctx.beginPath();ctx.moveTo(width,height*.15+offset);
                    ctx.bezierCurveTo(width*.62,height*.25+offset,width*.78,height*.67+offset,width*.32,height*.83+offset);
                    ctx.bezierCurveTo(width*.18,height*.89+offset,width*.08,height*.92+offset,0,height*.94+offset);
                    ctx.lineTo(0,height);ctx.lineTo(width,height);ctx.closePath();ctx.fillStyle=wash;ctx.globalAlpha=.12;ctx.fill();
                }
                ctx.globalAlpha=1;
                const light=ctx.createRadialGradient(width*.92,height*.22,0,width*.92,height*.22,width*.55);
                light.addColorStop(0,'rgba(206,181,127,.10)');light.addColorStop(1,'rgba(206,181,127,0)');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
            }
            ctx.lineWidth=1;
            for(let line=0;line<(tide?0:5);line++){
                ctx.strokeStyle=`rgba(169,195,188,${.025+line*.008})`;ctx.beginPath();
                for(let x=0;x<=width;x+=12){const y=height*(state.mode==='tide'?.79:.43)+line*13+Math.sin(x/width*5+time/9500+line*.25)*(state.mode==='tide'?15:36);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
            }
            const labels=new Map(Array.from(root.querySelectorAll<HTMLButtonElement>('.text-flow-hit')).map(b=>[b.dataset.highlightId,b]));
            labels.forEach(button=>{button.style.visibility='hidden';});
            const reader=root.parentElement?.parentElement?.querySelector<HTMLElement>('.play-original');
            const rb=held&&reader!==null&&reader!==undefined&&!reader.hidden?reader.getBoundingClientRect():null;const box=root.getBoundingClientRect();
            ctx.save();if(rb!==null){ctx.beginPath();ctx.rect(0,0,width,height);ctx.rect(rb.x-box.x-10,rb.y-box.y-10,rb.width+20,rb.height+20);ctx.clip('evenodd');}
            let visible=0;let tideCycle=-1;
            try{for(let index=0;index<count;index++){
                const item=state.items[index];if(item===undefined)continue;
                const arrival=tideArrival(time,index,state.reduced);
                const live=tide?{x:arrival.x,phase:0,opacity:arrival.opacity,drift:arrival.y,cycle:arrival.cycle}:textFlowPose(state.mode,time,index,count,narrow);tideCycle=live.cycle;
                const underPointer=hovered.current===item.id;const phase=underPointer?(displayed.get(item.id)??live):live;displayed.set(item.id,phase);
                const previous=cycles.get(index);cycles.set(index,phase.cycle);
                if(previous!==undefined&&previous!==phase.cycle&&running&&!underPointer&&item.id!==state.heldId){
                    if(state.mode==='river'){state.onAdvance(index);batches++;}
                }
                if(item.id===state.heldId)continue;
                const sideSpace=rb===null?width*.25:Math.max(100,rb.x-box.x-38);
                const placement=tidePlacement(index,width,height,held);
                const textWidth=tide?width*placement.width:narrow?width-70:held?Math.min(width*.25,sideSpace):width*.25;
                const text=layout(item,index,textWidth,tide?placement.fontSize:undefined,tide?placement.lines:undefined);
                const top=90,bottom=height-90;const textHeight=text.result.height+30;
                const travel=Math.max(120,bottom-top);
                const column=index%3;
                const x=tide?width*placement.x+phase.x:(held&&!narrow&&column!==1?(column===0?18:width-textWidth-18):width*phase.x-textWidth/2);
                const y=tide?height*placement.y+phase.drift:top+phase.phase*travel-textHeight/2+phase.drift;
                const alpha=state.reduced?.94:Math.max(.04,phase.opacity);
                ctx.globalAlpha=alpha*(held?.50:1);ctx.font=text.font;ctx.textBaseline='top';
                ctx.fillStyle=hovered.current===item.id?'#ffe2ae':tide?(index===0||index===3?'#f2dbb3':'#d5e0d8'):index===0?'#f3dfb5':'#e5e5d7';
                text.result.lines.forEach((line,i)=>ctx.fillText(line.text,x,y+i*text.lineHeight));
                if(tide&&underPointer){ctx.strokeStyle='#dfc79a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-13);ctx.lineTo(x+24,y-13);ctx.stroke();}
                ctx.font=`11px ${family}`;ctx.fillStyle='#a8bbb6';ctx.fillText('— '+text.source,x,y+text.result.height+7);
                const hiddenByReader=rb!==null&&x+textWidth>rb.x-box.x-10&&x<rb.right-box.x+10&&y+textHeight>rb.y-box.y-10&&y<rb.bottom-box.y+10;
                if(alpha>.15&&!hiddenByReader){visible++;const button=labels.get(item.id);if(button!==undefined){
                    button.style.left=(x-10)+'px';button.style.top=(y-10)+'px';button.style.width=(textWidth+20)+'px';button.style.height=Math.max(44,textHeight+15)+'px';button.style.visibility='visible';
                }}
            }}catch{setFailed(true);disposed=true;}
            ctx.restore();ctx.globalAlpha=1;
            if(state.mode==='tide'&&tideCycle>=0){const old=cycles.get(-1);const inspecting=hovered.current!==null&&hovered.current!==state.heldId;
                if(old===undefined||!inspecting)cycles.set(-1,tideCycle);if(old!==undefined&&old!==tideCycle&&running&&!inspecting){state.onAdvance(null);batches++;}}
            root.dataset.flowState='ready';root.dataset.flowFrames=String(Number(root.dataset.flowFrames??'0')+1);
            root.dataset.flowTime=Math.round(time).toString();root.dataset.flowVisible=String(visible);root.dataset.flowCount=String(count);
            root.dataset.flowPrepares=String(prepares);root.dataset.flowBatches=String(batches);root.dataset.flowIds=state.items.map(i=>i.id).join(',');
            root.dataset.flowEdition=tide?'shore-2':'river-1';root.dataset.flowHeld=state.heldId??'';root.dataset.flowReduced=String(state.reduced);root.dataset.flowPaused=String(state.paused||document.hidden||!inView||focusTarget);
            if(running&&!disposed)schedule();
        }
        const observer=new ResizeObserver(resize);observer.observe(root);
        const intersection=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;last=performance.now();if(inView)schedule();});intersection.observe(root);
        const visibility=()=>{last=performance.now();if(!document.hidden)schedule();};document.addEventListener('visibilitychange',visibility);
        void document.fonts.ready.then(()=>{if(disposed)return;clearCache();cache.clear();schedule();});resize();
        return()=>{disposed=true;if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);cache.clear();requestDraw.current=()=>{};};
    },[props.mode]);
    return <div className={`play-stage text-flow-${props.mode}`} ref={host} data-testid="text-flow" data-flow-mode={props.mode} data-flow-state={failed?'fallback':undefined}
        onPointerDownCapture={e=>{pointer.current={x:e.clientX,y:e.clientY,distance:0};}}
        onPointerMoveCapture={e=>{const p=pointer.current;if(p!==null)p.distance=Math.max(p.distance,Math.hypot(e.clientX-p.x,e.clientY-p.y));}}
        onClickCapture={e=>{if(e.detail!==0&&(pointer.current?.distance??0)>7&&!(e.target instanceof HTMLInputElement)){e.preventDefault();e.stopPropagation();}}}>
        <canvas ref={canvas} aria-hidden="true"/>
        <div className="text-flow-caption"><span>{props.mode==='tide'?'A SHORE OF WORDS':'LET WORDS PASS BY'}</span>{props.mode==='tide'?<h2>字有潮汐</h2>:null}<p>{props.mode==='tide'?'遇见。留住。再放手。':'文字经过，喜欢的留一下。'}</p></div>
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
