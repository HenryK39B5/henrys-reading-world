import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, PlaneGeometry, SRGBColorSpace, Vector3, type Group, type ShaderMaterial } from 'three';
import { useReducedMotion } from '../encounter/useReducedMotion.ts';
import { filmPoint, filmPose, filmSeed, filmStep } from './filmGeometry.ts';

export type ScenePage = { id: string; title: string; preview: string; kind: string };
type Props = { pages: ScenePage[]; selectedId: string | null; onSelect: (id: string) => void };

const vertex = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const membrane = `varying vec2 vUv;
uniform vec3 uColour;uniform float uActive;uniform float uArrival;uniform float uSeed;
float rounded(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;}
void main(){
    vec2 p=vUv-0.5;
    float d=rounded(p,vec2(0.493,0.49),0.12);
    float mask=1.0-smoothstep(-0.006,0.006,d);
    float rim=exp(-abs(d+0.009)*135.0);
    float wave=sin(vUv.x*9.0+vUv.y*6.0+uSeed*6.0)*0.5+0.5;
    float band=exp(-pow((vUv.x-vUv.y*0.40-0.16-uSeed*0.18)*4.8,2.0));
    vec3 ink=mix(vec3(0.025,0.045,0.13),uColour,0.22+wave*0.18+band*0.16);
    ink+=rim*mix(uColour,vec3(0.92,0.96,1.0),uActive*0.6)*(0.55+uActive*0.65);
    ink+=band*vec3(0.13,0.19,0.30)*(0.3+uActive*0.35);
    float grain=fract(sin(dot(vUv*900.0,vec2(12.9898,78.233)))*43758.5453);
    ink+=(grain-0.5)*0.012;
    gl_FragColor=vec4(ink,mask*(0.70+uActive*0.25)*uArrival);
    #include <colorspace_fragment>
}`;
const aura = `varying vec2 vUv;uniform vec3 uColour;uniform float uArrival;uniform float uActive;
void main(){vec2 p=(vUv-0.5)*vec2(1.0,0.9);float a=exp(-dot(p,p)*13.0)*(0.09+uActive*0.09)*uArrival;
 gl_FragColor=vec4(uColour,a);#include <colorspace_fragment>}`.replace(';#include',';\n#include');
const palette=['#69d7e7','#a38df5','#efafbd','#8eafee','#a6e3ca'];

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
    override state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    override componentDidCatch() { this.props.onFailure(); }
    override render() { return this.state.failed ? null : this.props.children; }
}

/** Only this exact original's excerpt is rasterised; full text and provenance remain normal DOM. */
function excerptTexture(preview:string,title:string):CanvasTexture {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
    const context=canvas.getContext('2d');
    if(context!==null){
        context.fillStyle='#eaf2f7';context.font='80px "Songti SC",serif';
        const characters=Array.from(preview).slice(0,24);let x=95,y=290;
        for(const char of characters){
            const width=context.measureText(char).width;
            if(char==='\n'||x+width>675){x=95;y+=132;if(char==='\n')continue;}
            context.fillText(char,x,y);x+=width;
        }
        if(Array.from(preview).length>24)context.fillText('…',x,y);
        context.fillStyle='#c9d8e9';context.font='25px sans-serif';
        context.fillText(Array.from(title).slice(0,22).join(''),95,910);
    }
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
function updateSurface(geometry:PlaneGeometry,open:number,seed:number):void {
    const uv=geometry.getAttribute('uv');const positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
        const point=filmPoint(uv.getX(i),uv.getY(i),open,seed);
        positions.setXYZ(i,point[0],point[1],point[2]);
    }
    positions.needsUpdate=true;geometry.computeBoundingSphere();
}

function Film({ page, position, selected, reduced, epoch, onSelect }: {
    page:ScenePage;position:[number,number,number];selected:boolean;reduced:boolean;epoch:string;onSelect:(id:string)=>void;
}) {
    const group=useRef<Group>(null);const text=useRef<ShaderMaterial>(null);
    const [hovered,setHovered]=useState(false);
    const {invalidate,gl}=useThree();const seed=filmSeed(page.id);
    const geometry=useMemo(()=>new PlaneGeometry(1,1,24,18),[]);
    const texture=useMemo(()=>excerptTexture(page.preview,page.title),[page.preview,page.title]);
    const uniforms=useMemo(()=>({uColour:{value:new Color(palette[Math.floor(seed*palette.length)] ?? palette[0])},
        uActive:{value:0},uArrival:{value:1},uSeed:{value:seed}}),[seed]);
    const textUniforms=useMemo(()=>({uText:{value:texture},uActive:{value:0},uArrival:{value:1}}),[texture]);
    const motion=useRef({open:0,arrival:0,hover:0});
    useEffect(()=>{motion.current.arrival=reduced?1:0;invalidate();},[epoch,reduced,invalidate]);
    useEffect(()=>{invalidate();},[selected,hovered,reduced,invalidate]);
    useEffect(()=>()=>{geometry.dispose();texture.dispose();},[geometry,texture]);
    useFrame((_,delta)=>{
        const m=motion.current;const target=selected?1:0;
        m.open=reduced?target:filmStep(m.open,target,delta);
        m.arrival=reduced?1:filmStep(m.arrival,1,delta);
        m.hover=reduced?0:filmStep(m.hover,hovered?1:0,delta);
        updateSurface(geometry,reduced?0.65:m.open,seed);
        uniforms.uActive.value=m.open;uniforms.uArrival.value=m.arrival;
        textUniforms.uActive.value=m.open;textUniforms.uArrival.value=m.arrival;
        if(group.current!==null){
            group.current.rotation.set(reduced?0:(seed-0.5)*0.12+m.hover*0.035,reduced?0:(seed-0.5)*0.30,(seed-0.5)*0.18);
            group.current.position.y=position[1]+(reduced?0:m.hover*0.10);
        }
        if(m.open!==target||m.arrival!==1||m.hover!==(reduced?0:hovered?1:0))invalidate();
    });
    const choose=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(event.delta<=7)onSelect(page.id);};
    return <group ref={group} position={position}>
        <mesh position={[0,0,-0.10]}>
            <planeGeometry args={[4.4,4.7]}/><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={aura} transparent depthWrite={false} toneMapped={false}/>
        </mesh>
        <mesh geometry={geometry} onClick={choose} onPointerOver={event=>{event.stopPropagation();setHovered(true);gl.domElement.style.cursor='pointer';}}
            onPointerOut={()=>{setHovered(false);gl.domElement.style.cursor='auto';}}>
            <shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={membrane} transparent depthWrite={false} side={DoubleSide} toneMapped={false}/>
        </mesh>
        <mesh geometry={geometry} position={[0,0,0.018]} raycast={()=>null}>
            <shaderMaterial ref={text} uniforms={textUniforms} vertexShader={vertex} transparent depthWrite={false} side={DoubleSide} toneMapped={false}
                fragmentShader={`varying vec2 vUv;uniform sampler2D uText;uniform float uActive;uniform float uArrival;
                void main(){vec4 t=texture2D(uText,vUv);gl_FragColor=vec4(t.rgb,t.a*(0.66+uActive*0.34)*uArrival);
                #include <colorspace_fragment>}`}/>
        </mesh>
    </group>;
}

function Stage({ pages, selectedId, onSelect, host, onLost, onRestore }: Props & {
    host:HTMLDivElement|null;onLost:()=>void;onRestore:()=>void;
}) {
    const reduced=useReducedMotion();const {camera,size,gl,invalidate}=useThree();
    const compact=size.width<600;const focused=pages.find(p=>p.id===selectedId)??pages[0];
    const displayed=compact&&focused!==undefined?[focused,...pages.filter(p=>p.id!==focused.id).slice(0,2)]:pages;
    const epoch=pages.map(p=>p.id).join('|');
    useEffect(()=>{
        camera.position.set(0,0,12);camera.lookAt(0,0,0);camera.zoom=size.width/(compact?7.2:11.8);
        camera.updateProjectionMatrix();camera.updateMatrixWorld();invalidate();
    },[camera,size.width,compact,invalidate]);
    useEffect(()=>{
        const canvas=gl.domElement;const lost=(event:Event)=>{event.preventDefault();onLost();};
        canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',onRestore);
        const visible=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',visible);
        return ()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',onRestore);document.removeEventListener('visibilitychange',visible);};
    },[gl,onLost,onRestore,invalidate]);
    useFrame(()=>{
        if(host===null)return;
        if(gl.getContext().isContextLost()){host.dataset.playContext='lost';return;}
        host.dataset.playContext='ready';host.dataset.playRenders=String(Number(host.dataset.playRenders??'0')+1);
        host.dataset.playDrawCalls=String(gl.info.render.calls);host.dataset.playGeometries=String(gl.info.memory.geometries);
        host.dataset.playTextures=String(gl.info.memory.textures);host.dataset.playPrograms=String(gl.info.programs?.length??0);
        host.dataset.playCamera=camera.position.toArray().map(n=>n.toFixed(3)).join(',');host.dataset.playForm='membrane';
        host.dataset.playReduced=String(reduced);host.dataset.playSheetCount=String(displayed.length);
        const labels=new Map(Array.from(host.querySelectorAll<HTMLButtonElement>('.play-film-label')).map(label=>[label.dataset.pageId,label]));
        labels.forEach(label=>{label.style.visibility='hidden';});
        displayed.forEach((page,index)=>{
            const label=labels.get(page.id);if(label===undefined)return;const slot=filmPose(index,compact);
            const point=new Vector3(slot[0],slot[1]-1.52,slot[2]+0.02).project(camera);
            label.style.transform=`translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px) translate(-50%,-50%)`;
            label.style.visibility='visible';
        });
    });
    return <>{displayed.map((page,index)=><Film key={page.id} page={page} position={filmPose(index,compact)} selected={page.id===selectedId}
        reduced={reduced} epoch={epoch} onSelect={onSelect}/>)}</>;
}

export function ReadingScene(props:Props) {
    const [host,setHost]=useState<HTMLDivElement|null>(null);const [failed,setFailed]=useState(false);
    const [lost,setLost]=useState(false);const [generation,setGeneration]=useState(0);
    const pointer=useRef<{x:number;y:number;distance:number}|null>(null);
    const supported=useMemo(()=>{const context=document.createElement('canvas').getContext('webgl2');
        context?.getExtension('WEBGL_lose_context')?.loseContext();return context!==null;},[]);
    const lostCallback=useMemo(()=>()=>{setLost(true);if(host!==null)host.dataset.playContext='lost';},[host]);
    const restoreCallback=useMemo(()=>()=>{setLost(false);setGeneration(n=>n+1);},[]);
    return <div className="play-stage" ref={setHost} data-testid="reading-scene" data-play-context={!supported||failed?'fallback':lost?'lost':undefined}
        onPointerDownCapture={event=>{pointer.current={x:event.clientX,y:event.clientY,distance:0};}}
        onPointerMoveCapture={event=>{const start=pointer.current;if(start!==null)start.distance=Math.max(start.distance,Math.hypot(event.clientX-start.x,event.clientY-start.y));}}
        onClickCapture={event=>{if(event.detail!==0&&(pointer.current?.distance??0)>7){event.preventDefault();event.stopPropagation();}}}>
        {!supported||failed?<p className="play-scene-fallback">3D暂时不可用，文字仍可在下方选择，原文可以完整阅读。</p>:
            <SceneBoundary onFailure={()=>setFailed(true)}><Canvas key={generation} orthographic frameloop="demand" dpr={[1,1.5]}
                camera={{position:[0,0,12],zoom:50,near:0.1,far:60}} gl={{antialias:true,alpha:true}}
                fallback={<p>3D暂时不可用，请使用原文列表。</p>}>
                <Stage {...props} host={host} onLost={lostCallback} onRestore={restoreCallback}/>
            </Canvas></SceneBoundary>}
        <div className="play-scene-labels">{props.pages.map(page=><button key={page.id} className="play-film-label" type="button"
            aria-pressed={page.id===props.selectedId} data-page-id={page.id} aria-label={`读《${page.title}》里的划线：${page.preview.slice(0,16)}`}
            onClick={()=>props.onSelect(page.id)}><span aria-hidden="true">{page.id===props.selectedId?'正在读':'读这一处'} <i>↗</i></span></button>)}</div>
        {lost?<p className="play-scene-fallback">3D暂时中断，原文与文字列表仍可用。</p>:null}
        <span className="play-scene-signature" aria-hidden="true">WORDS IN SUSPENSION · HENRY’S READING WORLD</span>
    </div>;
}
