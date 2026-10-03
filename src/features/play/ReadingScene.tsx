import { Component,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { Canvas,useFrame,useThree,type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending,CanvasTexture,DoubleSide,ExtrudeGeometry,Shape,Vector3,type Group,type Mesh,type ShaderMaterial } from 'three';
import { useReducedMotion } from '../encounter/useReducedMotion.ts';
import { gardenEntrance,gardenEase,gardenSky,gardenSun } from './gardenDesign.ts';

export type ScenePage={id:string;title:string;preview:string;kind:string};
type Props={pages:ScenePage[];selectedId:string|null;onSelect:(id:string)=>void;onRead:()=>void;readingOpen:boolean};
const stone='#f0dfc9',shade='#cfb8ab',teal='#30575c',gold='#c88e58';
const vertex=`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const water=`varying vec2 vUv;varying vec3 vWorld;uniform float uLight;uniform float uPulse;
void main(){vec2 p=vUv;float bands=sin(p.x*47.+p.y*70.+uPulse*2.)*.5+.5;
float small=sin(p.y*150.-p.x*92.)*.5+.5;vec3 c=mix(vec3(.035,.13,.20),vec3(.08,.23,.27),p.y);
float path=exp(-pow((p.x-.49-(uLight-.5)*.26)*7.,2.));c+=vec3(.20,.12,.065)*path*pow(bands,12.)*.65;
c+=vec3(.11,.16,.17)*pow(small,24.)*.12;float haze=1.-smoothstep(6.,23.,length(vWorld.xz));gl_FragColor=vec4(c,haze);
#include <colorspace_fragment>
}`;
function archShape(radius:number,leg:number,thickness:number):Shape {
    const inner=radius-thickness;const s=new Shape();s.moveTo(-radius,0);s.lineTo(-radius,leg);
    s.absarc(0,leg,radius,Math.PI,0,true);s.lineTo(radius,0);s.lineTo(inner,0);s.lineTo(inner,leg);
    s.absarc(0,leg,inner,0,Math.PI,false);s.lineTo(-inner,0);s.closePath();return s;
}
function plateauShape():Shape {
    const points=[[-4.8,-1.8],[-3,-3],[1.3,-2.6],[4.6,-1.8],[4.85,1.6],[2.4,3.35],[-2.6,3.1],[-4.7,1.0]];
    const shape=new Shape();points.forEach((p,i)=>{if(i===0)shape.moveTo(p[0]??0,p[1]??0);else shape.lineTo(p[0]??0,p[1]??0);});shape.closePath();return shape;
}
function glowTexture():CanvasTexture {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
    if(ctx!==null){const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,224,170,.85)');g.addColorStop(.23,'rgba(255,200,125,.40)');g.addColorStop(1,'rgba(255,180,100,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);}
    return new CanvasTexture(canvas);
}
class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
    override state={failed:false};static getDerivedStateFromError(){return {failed:true};}
    override componentDidCatch(){this.props.onFailure();}override render(){return this.state.failed?null:this.props.children;}
}
function Block({position,size,colour=stone,rotation=0}:{position:[number,number,number];size:[number,number,number];colour?:string;rotation?:number}){
    return <mesh position={position} rotation={[0,rotation,0]} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={colour} roughness={.84}/></mesh>;
}
function Stair({count=12}:{count?:number}){
    return <>{Array.from({length:count},(_,i)=><Block key={i} position={[0,i*.052,-i*.26]} size={[1.28,.16,.31]} colour={i%3===0?'#e8d3b8':stone}/>)}</>;
}
function Cypress({position,scale=1}:{position:[number,number,number];scale?:number}){
    return <group position={position} scale={scale}>
        <mesh position={[0,.55,0]} castShadow><cylinderGeometry args={[.065,.09,1.1,8]}/><meshStandardMaterial color="#6f6660"/></mesh>
        {[0,1,2].map(i=><mesh key={i} position={[0,.90+i*.38,0]} castShadow><coneGeometry args={[.42-i*.08,1.25,10]}/><meshStandardMaterial color={i===1?'#3f6a64':teal} roughness={1}/></mesh>)}
    </group>;
}
function Lantern({page,index,compact,selected,onSelect,glow}:{page:ScenePage;index:number;compact:boolean;selected:boolean;onSelect:(id:string)=>void;glow:CanvasTexture}){
    const position=gardenEntrance(index,compact);
    const {gl,invalidate}=useThree();const halo=useRef<Mesh>(null);const [hover,setHover]=useState(false);
    useEffect(()=>{invalidate();},[hover,selected,invalidate]);
    useFrame(()=>{if(halo.current!==null)halo.current.scale.setScalar(selected?1.8:hover?1.4:1);});
    const choose=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta<=7)onSelect(page.id);};
    return <group position={position}>
        <mesh scale={selected?1.25:1} onClick={choose} onPointerOver={e=>{e.stopPropagation();setHover(true);gl.domElement.style.cursor='pointer';}}
            onPointerOut={()=>{setHover(false);gl.domElement.style.cursor='auto';}}>
            <octahedronGeometry args={[.16,0]}/><meshStandardMaterial color="#fff0c4" emissive="#ffc984" emissiveIntensity={selected?2.8:1.2} roughness={.3}/>
        </mesh>
        <sprite ref={halo} scale={1.2} raycast={()=>{}}><spriteMaterial map={glow} transparent blending={AdditiveBlending} depthWrite={false}/></sprite>
        <mesh position={[0,-.21,0]}><cylinderGeometry args={[.17,.19,.06,16]}/><meshStandardMaterial color={gold} metalness={.35} roughness={.5}/></mesh>
    </group>;
}
function Garden({pages,selectedId,onSelect,host,light,lift,onLight,onLift,onLost,onRestore}:{pages:ScenePage[];selectedId:string|null;onSelect:(id:string)=>void;
    host:HTMLDivElement|null;light:number;lift:boolean;onLight:(value:number)=>void;onLift:()=>void;onLost:()=>void;onRestore:()=>void}){
    const reduced=useReducedMotion();const {camera,size,gl,invalidate}=useThree();const compact=size.width<820;
    const bridge=useRef<Group>(null),solar=useRef<Group>(null),waterMat=useRef<ShaderMaterial>(null);
    const response=useRef({light,lift:lift?1:0});
    const report=useRef<number|null>(null);
    useEffect(()=>()=>{if(report.current!==null)cancelAnimationFrame(report.current);},[]);
    const drag=useRef<{x:number;light:number}|null>(null);
    const capture=(event:ThreeEvent<PointerEvent>,release=false):void=>{
        const target=event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};
        if(release)target.releasePointerCapture(event.pointerId);else target.setPointerCapture(event.pointerId);
    };
    const hero=useMemo(()=>new ExtrudeGeometry(archShape(1.55,1.9,.34),{depth:.48,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:32}),[]);
    const arcade=useMemo(()=>new ExtrudeGeometry(archShape(.52,1.0,.16),{depth:.33,bevelEnabled:false,curveSegments:20}),[]);
    const land=useMemo(()=>new ExtrudeGeometry(plateauShape(),{depth:.7,bevelEnabled:false}),[]);
    const glow=useMemo(glowTexture,[]);const uniforms=useMemo(()=>({uLight:{value:.28},uPulse:{value:0}}),[]);
    useEffect(()=>()=>{hero.dispose();arcade.dispose();land.dispose();glow.dispose();},[hero,arcade,land,glow]);
    useEffect(()=>{invalidate();},[light,lift,selectedId,reduced,invalidate]);
    useEffect(()=>{
        camera.position.set(10,8.0,13);camera.lookAt(0,2.15,0);camera.zoom=size.width/(compact?12.0:18.0);
        camera.updateProjectionMatrix();camera.updateMatrixWorld();invalidate();
    },[camera,size.width,compact,invalidate]);
    useEffect(()=>{
        const lost=(e:Event)=>{e.preventDefault();onLost();};const canvas=gl.domElement;
        canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',onRestore);
        const visibility=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',visibility);
        return()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',onRestore);document.removeEventListener('visibilitychange',visibility);};
    },[gl,onLost,onRestore,invalidate]);
    useFrame((_,delta)=>{
        const state=response.current;const target=lift?1:0;
        state.light=reduced?light:gardenEase(state.light,light,delta);state.lift=reduced?target:gardenEase(state.lift,target,delta);
        uniforms.uLight.value=state.light;
        if(bridge.current!==null)bridge.current.position.y=.32+state.lift*.8;
        if(solar.current!==null)solar.current.position.set(...gardenSun(state.light));
        if(state.light!==light||state.lift!==target)invalidate();
        if(host===null)return;if(gl.getContext().isContextLost()){host.dataset.playContext='lost';return;}
        host.dataset.playContext='ready';host.dataset.playForm='garden';host.dataset.playEntrances=String(Math.min(pages.length,compact?3:7));host.dataset.playReduced=String(reduced);
        host.dataset.playRenders=String(Number(host.dataset.playRenders??'0')+1);host.dataset.playCamera=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
        if(report.current!==null)cancelAnimationFrame(report.current);
        report.current=requestAnimationFrame(()=>{report.current=null;
            host.dataset.playDrawCalls=String(gl.info.render.calls);host.dataset.playGeometries=String(gl.info.memory.geometries);
            host.dataset.playTextures=String(gl.info.memory.textures);host.dataset.playPrograms=String(gl.info.programs?.length??0);
        });
        host.dataset.playLight=state.light.toFixed(3);host.dataset.playBridge=state.lift.toFixed(3);
        const sunPoint=new Vector3(...gardenSun(state.light)).project(camera);
        host.dataset.playSunX=((sunPoint.x+1)*size.width/2).toFixed(2);host.dataset.playSunY=((1-sunPoint.y)*size.height/2).toFixed(2);
        const switchPoint=new Vector3(2.7,.78,3.35).project(camera);
        host.dataset.playSwitchX=((switchPoint.x+1)*size.width/2).toFixed(2);host.dataset.playSwitchY=((1-switchPoint.y)*size.height/2).toFixed(2);
        const labels=new Map(Array.from(host.querySelectorAll<HTMLButtonElement>('.play-garden-entrance')).map(label=>[label.dataset.pageId,label]));
        labels.forEach(label=>{label.style.visibility='hidden';});
        pages.slice(0,compact?3:7).forEach((page,index)=>{const label=labels.get(page.id);const pose=gardenEntrance(index,compact);if(label===undefined)return;
            const point=new Vector3(...pose).project(camera);const x=(point.x+1)*size.width/2,y=(1-point.y)*size.height/2;
            label.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;label.style.visibility='visible';
            label.dataset.pickX=x.toFixed(2);label.dataset.pickY=y.toFixed(2);
        });
    });
    return <>
        <hemisphereLight intensity={1.6} color="#ffe9ca" groundColor="#7598af"/>
        <ambientLight intensity={.4} color="#e8c7aa"/>
        <directionalLight position={gardenSun(light)} intensity={3.3} color="#ffe0b2" castShadow shadow-mapSize={[1024,1024]}
            shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-.001}/>
        <directionalLight position={[-6,5,8]} intensity={1.1} color="#93b8cf"/>
        <fog attach="fog" args={['#8cabb6',24,55]}/>
        <group ref={solar} position={gardenSun(light)}>
            <mesh
                onPointerOver={()=>{gl.domElement.style.cursor='grab';}} onPointerOut={()=>{if(drag.current===null)gl.domElement.style.cursor='auto';}}
                onPointerDown={e=>{e.stopPropagation();drag.current={x:e.clientX,light};capture(e);gl.domElement.style.cursor='grabbing';}}
                onPointerMove={e=>{if(drag.current===null)return;e.stopPropagation();onLight(Math.max(0,Math.min(1,drag.current.light+(e.clientX-drag.current.x)/size.width*1.4)));}}
                onPointerUp={e=>{if(drag.current===null)return;e.stopPropagation();capture(e,true);drag.current=null;gl.domElement.style.cursor='grab';}}
                onPointerCancel={()=>{drag.current=null;gl.domElement.style.cursor='auto';}}>
                <sphereGeometry args={[1.22,48,32]}/><meshBasicMaterial color="#ffe1aa" toneMapped={false}/></mesh>
            <sprite scale={5.4} raycast={()=>{}}><spriteMaterial map={glow} transparent opacity={.36} depthWrite={false} blending={AdditiveBlending}/></sprite>
            <mesh rotation={[Math.PI/2,.2,.1]}><torusGeometry args={[1.8,.018,8,96]}/><meshBasicMaterial color="#f6d4a5" toneMapped={false}/></mesh>
        </group>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.72,0]}><planeGeometry args={[120,120]}/><shaderMaterial ref={waterMat} vertexShader={vertex} fragmentShader={water} uniforms={uniforms} side={DoubleSide} transparent depthWrite={false}/></mesh>
        <mesh geometry={land} rotation={[-Math.PI/2,0,0]} position={[0,-.55,0]} receiveShadow castShadow><meshStandardMaterial color="#b38779" roughness={.95}/></mesh>
        <mesh geometry={land} rotation={[-Math.PI/2,0,0]} position={[0,.16,0]} scale={[.99,.99,.05]} receiveShadow><meshStandardMaterial color="#e2cfb9" roughness={.92}/></mesh>
        <Block position={[0,.43,-.1]} size={[4.1,.65,3.5]} colour="#e6d2b9"/>
        <Block position={[0,.82,-.1]} size={[3.7,.13,3.2]} colour={stone}/>
        <mesh geometry={hero} position={[0,.9,-.55]} castShadow receiveShadow><meshStandardMaterial color={stone} roughness={.86}/></mesh>
        <mesh geometry={hero} position={[0,.9,-.05]} scale={[.89,.93,.15]}><meshStandardMaterial color={gold} roughness={.6} metalness={.2}/></mesh>
        <Block position={[0,4.42,-.30]} size={[3.65,.12,.78]} colour={stone}/>
        <mesh position={[0,4.61,-.30]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.25,.025,8,40]}/><meshStandardMaterial color={gold} metalness={.5} roughness={.35}/></mesh>
        {[-1,1].map(side=><group key={side} position={[side*1.82,.95,-.1]}>
            {[0,1,2,3,4,5].map(i=><Block key={i} position={[0,.18,.18+i*.35]} size={[.055,.4,.055]} colour={gold}/>)}
            <Block position={[0,.39,1.05]} size={[.06,.05,2.1]} colour={gold}/>
        </group>)}
        <mesh position={[0,.889,.35]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.58,48]}/><meshStandardMaterial color="#719393" roughness={.25} metalness={.25}/></mesh>
        <group position={[-1.0,.28,3.0]} rotation={[0,-.23,0]}><Stair/></group>
        <group ref={bridge} position={[2.7,.32,1.8]} rotation={[0,-.55,0]}>
            {Array.from({length:7},(_,i)=><Block key={i} position={[i*.22,0,i*.42]} size={[1.35,.12,.4]} colour={i%2?stone:'#d9c1a5'}/>)}
        </group>
        <group position={[-3.4,.15,-1.65]} rotation={[0,.14,0]}>
            {[0,1,2,3,4].map(i=><mesh key={i} geometry={arcade} position={[i*1.05,0,0]} castShadow receiveShadow><meshStandardMaterial color={shade} roughness={.88}/></mesh>)}
            <Block position={[2.1,1.62,.15]} size={[5.3,.14,.64]} colour={stone}/>
        </group>
        <group position={[3.2,.18,-1.6]}>
            <Block position={[0,1.15,0]} size={[1.15,2.3,1.05]} colour="#ba8e7c"/>
            <Block position={[0,2.36,0]} size={[1.36,.18,1.25]} colour={stone}/>
            <mesh position={[0,2.85,0]}><coneGeometry args={[.84,.84,4]}/><meshStandardMaterial color="#497174" roughness={.9}/></mesh>
        </group>
        <group position={[2.45,.45,3.35]} onClick={e=>{e.stopPropagation();if(e.delta<=7)onLift();}}
            onPointerOver={()=>{gl.domElement.style.cursor='pointer';}} onPointerOut={()=>{gl.domElement.style.cursor='auto';}}>
            <Block position={[0,0,0]} size={[.45,.45,.45]} colour="#bfa889"/>
            <mesh position={[0,.33,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.25,.06,12,32]}/><meshStandardMaterial color="#e3b679" metalness={.4} roughness={.4}/></mesh>
        </group>
        <Cypress position={[-3.55,.22,1.4]} scale={1.2}/><Cypress position={[2.5,.3,2.5]} scale={.8}/><Cypress position={[-3.85,.22,-2.35]} scale={.9}/>
        <Cypress position={[4.0,.22,-.6]} scale={1.1}/>
        {[-1,1].map(side=><group key={side} position={[side*2.35,.28,.1]}>
            <Block position={[0,.35,0]} size={[.75,.7,.75]} colour="#d3ba9c"/>
            <mesh position={[0,.85,0]}><sphereGeometry args={[.3,16,12]}/><meshStandardMaterial color="#d1a76b" roughness={.55} metalness={.25}/></mesh>
        </group>)}
        <group position={[-8,-.08,-9]} scale={.65}><mesh geometry={land} rotation={[-Math.PI/2,0,0]}><meshStandardMaterial color="#839da3"/></mesh><mesh geometry={hero} position={[0,.5,0]}><meshStandardMaterial color="#c7b5aa"/></mesh><Cypress position={[2,.3,0]}/></group>
        <group position={[8,-.05,-8]} scale={.40}><mesh geometry={land} rotation={[-Math.PI/2,0,0]}><meshStandardMaterial color="#a0a5a3"/></mesh><Cypress position={[0,.2,0]} scale={1.3}/></group>
        {pages.slice(0,compact?3:7).map((page,index)=><Lantern key={page.id} page={page} index={index} compact={compact} selected={page.id===selectedId} onSelect={onSelect} glow={glow}/>)}
    </>;
}
export function ReadingScene(props:Props){
    const [host,setHost]=useState<HTMLDivElement|null>(null),[failed,setFailed]=useState(false),[lost,setLost]=useState(false),[generation,setGeneration]=useState(0);
    const [light,setLight]=useState(.28),[lift,setLift]=useState(false);const pointer=useRef<{x:number;y:number;distance:number}|null>(null);
    const sky=gardenSky(light);const supported=useMemo(()=>{const context=document.createElement('canvas').getContext('webgl2');context?.getExtension('WEBGL_lose_context')?.loseContext();return context!==null;},[]);
    const lostCallback=useMemo(()=>()=>{setLost(true);if(host!==null)host.dataset.playContext='lost';},[host]);
    const restoreCallback=useMemo(()=>()=>{setLost(false);setGeneration(n=>n+1);},[]);
    return <div className="play-stage" ref={setHost} data-testid="reading-scene" data-play-context={!supported||failed?'fallback':lost?'lost':undefined}
        style={{background:`linear-gradient(180deg,${sky.top} 0%,${sky.bottom} 61%,#405b67 100%)`}}
        onPointerDownCapture={e=>{pointer.current={x:e.clientX,y:e.clientY,distance:0};}}
        onPointerMoveCapture={e=>{const p=pointer.current;if(p!==null)p.distance=Math.max(p.distance,Math.hypot(e.clientX-p.x,e.clientY-p.y));}}
        onClickCapture={e=>{if(e.detail!==0&&(pointer.current?.distance??0)>7&&!(e.target instanceof HTMLInputElement)){e.preventDefault();e.stopPropagation();}}}>
        {!supported||failed?<p className="play-scene-fallback">场景暂时不可用，仍可打开真实原文与文字目录。</p>:
            <SceneBoundary onFailure={()=>setFailed(true)}><Canvas key={generation} orthographic shadows frameloop="demand" dpr={[1,1.5]}
                camera={{position:[10,8,13],zoom:50,near:.1,far:150}} gl={{antialias:true,alpha:true}}>
                <Garden {...props} host={host} light={light} lift={lift} onLight={setLight} onLift={()=>setLift(v=>!v)} onLost={lostCallback} onRestore={restoreCallback}/>
            </Canvas></SceneBoundary>}
        <div className="play-garden-caption" aria-hidden="true"><span>THE TWILIGHT GARDEN</span><p>光停下来的地方。</p></div>
        <div className="play-scene-labels">{props.pages.map((page,index)=><button key={page.id} type="button" className="play-garden-entrance"
            aria-pressed={page.id===props.selectedId} data-page-id={page.id} aria-label={`读《${page.title}》里的划线：${page.preview.slice(0,16)}`}
            onClick={()=>props.onSelect(page.id)}><i aria-hidden="true">{index+1}</i><span>{page.title}<small>{page.preview.slice(0,26)}…</small></span></button>)}</div>
        <div className="play-garden-controls"><label><span>拨动光</span><input type="range" min="0" max="100" value={Math.round(light*100)} aria-label="光的方向" onChange={e=>setLight(Number(e.target.value)/100)}/></label>
            <button type="button" onClick={()=>setLift(v=>!v)} aria-pressed={lift}>{lift?'让桥落下':'让桥浮起'} <span aria-hidden="true">◇</span></button>
            {!props.readingOpen?<button className="play-read-current" type="button" onClick={props.onRead}>读一处 <span aria-hidden="true">↗</span></button>:null}</div>
        {lost?<p className="play-scene-fallback">画面暂时中断，真实阅读和目录仍然可用。</p>:null}
    </div>;
}
