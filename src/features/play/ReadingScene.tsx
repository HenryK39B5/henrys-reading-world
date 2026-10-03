import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox, useCursor } from '@react-three/drei';
import { ACESFilmicToneMapping, CanvasTexture, MathUtils, SRGBColorSpace, TextureLoader, Vector3, type Group, type Texture } from 'three';
import { useReducedMotion } from '../encounter/useReducedMotion.ts';

export type ScenePage = { id: string; title: string; preview: string; cover: string | undefined; kind: string };
type Props = { pages: ScenePage[]; selectedId: string | null; onSelect: (id: string) => void };
type CoverEntry = { refs: number; texture: Texture | null; promise: Promise<Texture | null> };
const covers = new Map<string, CoverEntry>();
function acquireCover(url: string): CoverEntry {
    const previous = covers.get(url); if (previous !== undefined) { previous.refs += 1; return previous; }
    const entry: CoverEntry = { refs: 1, texture: null, promise: Promise.resolve(null) };
    covers.set(url, entry);
    entry.promise = new Promise(resolve => {
        new TextureLoader().load(url, texture => {
            texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4; entry.texture = texture;
            if (entry.refs === 0) { texture.dispose(); if (covers.get(url) === entry) covers.delete(url); resolve(null); } else resolve(texture);
        }, undefined, () => resolve(null));
    });
    return entry;
}
function releaseCover(url: string, entry: CoverEntry): void {
    entry.refs -= 1;
    queueMicrotask(() => { if (entry.refs === 0 && covers.get(url) === entry) { entry.texture?.dispose(); covers.delete(url); } });
}
function useBookCover(url: string | undefined): Texture | null {
    const [loaded, setLoaded] = useState<{ url: string; texture: Texture | null } | null>(null);
    useEffect(() => {
        if (url === undefined) return;
        let active = true; const entry = acquireCover(url);
        void entry.promise.then(texture => { if (active) setLoaded({ url, texture }); });
        return () => { active = false; releaseCover(url, entry); };
    }, [url]);
    return loaded !== null && loaded.url === url ? loaded.texture : null;
}

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
    override state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    override componentDidCatch() { this.props.onFailure(); }
    override render() { return this.state.failed ? null : this.props.children; }
}

function OpenLeaves({ page }: { page: ScenePage }) {
    const textures = useMemo(() => {
        const characters = Array.from(page.preview).slice(0,220);
        const middle = Math.ceil(characters.length / 2);
        return [characters.slice(0,middle),characters.slice(middle)].map((part,index) => {
            const canvas=document.createElement('canvas');canvas.width=640;canvas.height=900;
            const context=canvas.getContext('2d');
            if(context!==null){
                context.fillStyle='#e9dfc8';context.fillRect(0,0,640,900);
                const shade=context.createLinearGradient(index===0?640:0,0,index===0?490:150,0);shade.addColorStop(0,'#b7a781');shade.addColorStop(1,'#e9dfc8');context.fillStyle=shade;context.fillRect(0,0,640,900);
                context.fillStyle='#8a7853';context.font='22px serif';context.fillText(Array.from(page.title).slice(0,18).join(''),55,68);
                context.fillStyle='#293238';context.font='34px "Songti SC",serif';
                let x=55,y=145;for(const character of part){if(character==='\n'||x>545){x=55;y+=58;if(character==='\n')continue;}context.fillText(character,x,y);x+=context.measureText(character).width;}
                if(index===1&&Array.from(page.preview).length>220)context.fillText('…',x,y);
            }
            const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
        });
    },[page.preview,page.title]);
    useEffect(()=>()=>{textures.forEach(texture=>texture.dispose());},[textures]);
    return <group position={[0,0.1,0.2]}>
        {[-1,1].map((side,index)=><group key={side} position={[side*0.59,0,0]} rotation={[0,side*0.17,side*0.035]}>
            <RoundedBox args={[1.18,1.65,0.11]} radius={0.028} castShadow><meshStandardMaterial color="#d4c6a8" roughness={0.88}/></RoundedBox>
            <mesh position={[0,0,0.066]}><planeGeometry args={[1.14,1.60]}/><meshBasicMaterial map={textures[index] ?? null} toneMapped={false}/></mesh>
        </group>)}
        <mesh position={[0,0,0.10]}><boxGeometry args={[0.055,1.62,0.03]}/><meshStandardMaterial color="#a89670" roughness={0.9}/></mesh>
    </group>;
}

function Book({ page, position, selected, reduced, onSelect }: {
    page: ScenePage; position: [number, number, number]; selected: boolean; reduced: boolean; onSelect: (id: string) => void;
}) {
    const group = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);
    useCursor(hovered);
    const texture = useBookCover(page.cover);
    const invalidate = useThree(state => state.invalidate);
    const target = reduced ? 0 : selected ? 0.20 : hovered ? 0.10 : 0;
    useEffect(() => { invalidate(); }, [target, texture, invalidate]);
    useFrame((_, delta) => {
        if (group.current === null) return;
        const y = position[1] + target;
        group.current.position.y = reduced ? y : MathUtils.damp(group.current.position.y, y, 12, Math.min(delta, 0.05));
        if (Math.abs(group.current.position.y - y) > 0.001) invalidate();
    });
    const choose = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta <= 7) onSelect(page.id); };
    return <group position={position}>
        <RoundedBox args={[1.78, 0.14, 1.28]} radius={0.07} position={[0,-0.78,0.04]} receiveShadow>
            <meshStandardMaterial color={selected ? '#bc9854' : '#293b4d'} roughness={0.62} metalness={0.30} />
        </RoundedBox>
        <group ref={group} position={[0, position[1], 0]} rotation={[-0.10, -position[0] * 0.045, 0]}>
            <group onClick={choose} onPointerOver={event => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
                <group visible={!selected}>
                <RoundedBox args={[1.10, 1.58, 0.20]} radius={0.035} smoothness={3} castShadow>
                    <meshStandardMaterial color="#172a39" roughness={0.70} />
                </RoundedBox>
                <RoundedBox args={[1.02, 1.49, 0.15]} radius={0.025} position={[0.015,0,-0.025]}>
                    <meshStandardMaterial color="#d7c8a4" roughness={0.85} />
                </RoundedBox>
                <mesh position={[0,0,0.111]}>
                    <planeGeometry args={[1.08,1.56]} />
                    {texture === null ? <meshStandardMaterial color="#31556a" roughness={0.7} /> : <meshBasicMaterial map={texture} toneMapped={false} />}
                </mesh>
                <mesh position={[-0.50,0,0.12]}><boxGeometry args={[0.025,1.56,0.012]} /><meshStandardMaterial color="#ad8a52" metalness={0.65} roughness={0.4} /></mesh>
                </group>
                {selected ? <OpenLeaves page={page}/> : null}
            </group>

        </group>
    </group>;
}

function Stage({ pages, selectedId, onSelect, host, onLost, onRestore }: Props & {
    host: HTMLDivElement | null; onLost: () => void; onRestore: () => void;
}) {
    const reduced = useReducedMotion();
    const { camera, size, gl, invalidate } = useThree();
    const compact = size.width < 600;
    const focused = pages.find(page => page.id === selectedId) ?? pages[0];
    const displayed = compact && focused !== undefined ? [focused,...pages.filter(page => page.id !== focused.id).slice(0,2)] : pages;
    const slots: [number,number,number][] = compact ? [[0,0,1.2],[-2.3,0,-0.7],[2.3,0,-0.7]] :
        [[0,0,1.4],[-3.8,0,-0.8],[-2.6,0,-3.0],[0,0,-3.8],[2.6,0,-3.0],[3.8,0,-0.8],[3.4,0,2.2]];
    useEffect(() => {
        camera.position.set(0,4.8,10); camera.lookAt(0,-0.1,-0.5);
        camera.zoom = size.width / (compact ? 7.3 : 10.9); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); invalidate();
    }, [camera,size.width,compact,invalidate]);
    useEffect(() => {
        const canvas = gl.domElement;
        const lost = (event: Event) => { event.preventDefault(); onLost(); };
        canvas.addEventListener('webglcontextlost',lost); canvas.addEventListener('webglcontextrestored',onRestore);
        return () => { canvas.removeEventListener('webglcontextlost',lost); canvas.removeEventListener('webglcontextrestored',onRestore); };
    }, [gl,onLost,onRestore]);
    useFrame(() => {
        if (host === null) return;
        if (gl.getContext().isContextLost()) { host.dataset.playContext = 'lost'; return; }
        host.dataset.playContext = 'ready'; host.dataset.playRenders = String(Number(host.dataset.playRenders ?? '0') + 1);
        host.dataset.playDrawCalls = String(gl.info.render.calls); host.dataset.playGeometries = String(gl.info.memory.geometries);
        host.dataset.playTextures = String(gl.info.memory.textures); host.dataset.playPrograms = String(gl.info.programs?.length ?? 0);
        host.dataset.playCamera = camera.position.toArray().map(n => n.toFixed(3)).join(',');
        const labels = new Map(Array.from(host.querySelectorAll<HTMLButtonElement>('.play-book-label')).map(label => [label.dataset.pageId,label]));
        labels.forEach(label => { label.style.visibility = 'hidden'; });
        displayed.forEach((page,index) => {
            const label = labels.get(page.id); const slot = slots[index];
            if (label === undefined || slot === undefined) return;
            const point = new Vector3(slot[0],-1.06,slot[2]+0.25).project(camera);
            label.style.transform = `translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px) translate(-50%,-50%)`;
            label.style.visibility = 'visible';
        });
    });
    return <>
        <ambientLight intensity={0.5} />
        <directionalLight position={[-5,7,4]} intensity={3.1} color="#ffe3b6" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.001} />
        <directionalLight position={[5,3,-3]} intensity={1.4} color="#94bacf" />
        <Environment resolution={128} frames={1}>
            <Lightformer form="rect" position={[-3,4,2]} scale={[5,5,1]} intensity={3} color="#fff0d5" />
            <Lightformer form="rect" position={[4,1,-2]} rotation={[0,-Math.PI/2,0]} scale={[3,5,1]} intensity={2} color="#a6c3d3" />
        </Environment>
        <mesh position={[0,-0.90,-0.3]} scale={[compact ? 0.66 : 1,1,0.73]} receiveShadow>
            <cylinderGeometry args={[5.4,5.6,0.28,96]}/><meshStandardMaterial color="#142739" metalness={0.12} roughness={0.72}/>
        </mesh>
        <mesh position={[0,-1.06,-0.3]} scale={[compact ? 0.66 : 1,1,0.73]}>
            <cylinderGeometry args={[5.60,5.62,0.035,96]}/><meshStandardMaterial color="#a9864c" metalness={0.65} roughness={0.4}/>
        </mesh>
        {displayed.map((page,i) => <Book key={page.id} page={page} position={slots[i] ?? [0,0,0]} selected={page.id === selectedId} reduced={reduced} onSelect={onSelect} />)}
    </>;
}

export function ReadingScene(props: Props) {
    const [host,setHost] = useState<HTMLDivElement | null>(null);
    const [failed,setFailed] = useState(false);
    const [lost,setLost] = useState(false);
    const [generation,setGeneration] = useState(0);
    const pointer = useRef<{ x:number; y:number; distance:number } | null>(null);
    const supported = useMemo(() => {
        const canvas = document.createElement('canvas'); const context = canvas.getContext('webgl2');
        context?.getExtension('WEBGL_lose_context')?.loseContext(); return context !== null;
    }, []);
    const lostCallback = useMemo(() => () => { setLost(true); if(host!==null)host.dataset.playContext='lost'; },[host]);
    const restoreCallback = useMemo(() => () => { setLost(false); setGeneration(n=>n+1); },[]);
    return <div className="play-stage" ref={setHost} data-testid="reading-scene" data-play-context={!supported||failed?'fallback':lost?'lost':undefined}
        onPointerDownCapture={event => { pointer.current={x:event.clientX,y:event.clientY,distance:0}; }}
        onPointerMoveCapture={event => { const start=pointer.current;if(start!==null)start.distance=Math.max(start.distance,Math.hypot(event.clientX-start.x,event.clientY-start.y)); }}
        onClickCapture={event => { if(event.detail!==0&&(pointer.current?.distance??0)>7){event.preventDefault();event.stopPropagation();} }}>
        {!supported || failed ? <p className="play-scene-fallback">3D暂时不可用，书页仍可在下方选择，原文可以完整阅读。</p> :
            <SceneBoundary onFailure={() => setFailed(true)}><Canvas key={generation} orthographic shadows frameloop="demand" dpr={[1,1.5]}
                camera={{position:[0,4.8,10],zoom:50,near:0.1,far:60}}
                gl={{antialias:true,alpha:true,toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.1}}
                fallback={<p>3D暂时不可用，请使用书页列表。</p>}>
                <Stage {...props} host={host} onLost={lostCallback} onRestore={restoreCallback} />
            </Canvas></SceneBoundary>}
        <div className="play-scene-labels">
            {props.pages.map(page => <button key={page.id} className="play-book-label" type="button" aria-pressed={page.id===props.selectedId} data-page-id={page.id}
                aria-label={`读《${page.title}》里的划线：${page.preview.slice(0,16)}`} onClick={() => props.onSelect(page.id)}>
                <small>{page.id===props.selectedId?'正在读':'读这一页'}</small><span>{page.title}</span>
            </button>)}
        </div>
        {lost ? <p className="play-scene-fallback">3D暂时中断，原文与书页列表仍可用。</p> : null}
        <span className="play-scene-signature" aria-hidden="true">HENRY’S READING WORLD</span>
    </div>;
}
