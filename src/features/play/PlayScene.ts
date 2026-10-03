import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PlayForm, PlayParticipation, Point3 } from '../../domain/playWorld.ts';

export type SceneGate = { id: string; title: string; members: string[] };
export type SceneView = { position: Point3; target: Point3 };
const vector = (p: Point3): THREE.Vector3 => new THREE.Vector3(...p);
const clamp = (v: number): number => Math.min(1, Math.max(-1, v));
function sphericalLerp(from:THREE.Vector3,to:THREE.Vector3,t:number):THREE.Vector3 {
    const start=from.clone().normalize(),end=to.clone().normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(start,end);
    return start.applyQuaternion(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(),rotation,t)).multiplyScalar(from.length()*(1-t)+to.length()*t);
}
type GPUResources = { renderer: THREE.WebGLRenderer; environment: THREE.WebGLRenderTarget; pending: Set<THREE.Material> };
const gpuResources = new WeakMap<HTMLElement,GPUResources>();
export function releasePlayGPU(host:HTMLElement):void {
    const resources=gpuResources.get(host);if(resources===undefined)return;
    resources.pending.forEach(material=>material.dispose());resources.environment.dispose();resources.renderer.dispose();resources.renderer.forceContextLoss();resources.renderer.domElement.remove();gpuResources.delete(host);
}

/** One bounded GPU scene. Geometry is a lossy display, never a replacement for stored relationships. */
export class PlayScene {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    private controls: OrbitControls;
    private observer: ResizeObserver;
    private visibility: IntersectionObserver;
    private environment: THREE.WebGLRenderTarget;
    private root = new THREE.Group();
    private links = new THREE.Group();
    private marker = new THREE.Mesh(new THREE.IcosahedronGeometry(0.10, 2), new THREE.MeshStandardMaterial({ color: 0xffdfa0, emissive: 0xb59147, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.24 }));
    private ray = new THREE.Raycaster();
    private points: THREE.Points;
    private renderedIds: string[];
    private location = new Map<string, THREE.Vector3>();
    private gates = new Map<THREE.Object3D, SceneGate>();
    private labels = new Map<HTMLElement, THREE.Vector3>();
    private frame = 0;
    private disposed = false;
    private visible = true;
    private size = { width: 1, height: 1 };
    private density = new Float32Array(48 * 24);
    private animation: { from: THREE.Vector3; to: THREE.Vector3; started: number; cameraFrom: THREE.Vector3; cameraTo: THREE.Vector3 } | null = null;
    private down = { x: 0, y: 0 };
    private reduced: boolean;
    private motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
    private mode: PlayParticipation = 'touch';
    private renders = 0;
    private host: HTMLElement;
    private form: PlayForm;
    private onPick: (id: string) => void;
    private onEnter: (id: string) => void;

    constructor(host: HTMLElement, positions: Map<string, Point3>, form: PlayForm, gates: SceneGate[], onPick: (id: string) => void, onEnter: (id: string) => void, view?: SceneView) {
        this.host = host; this.form = form;
        host.dataset.playRenders='0';host.dataset.playMemberCount=String(positions.size);host.dataset.playContext='building';
        this.onPick = onPick; this.onEnter = onEnter;
        this.reduced = this.motionMedia.matches;
        const cached = gpuResources.get(host);
        if(cached !== undefined){this.renderer=cached.renderer;this.environment=cached.environment;}
        else {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.05;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.domElement.setAttribute('aria-hidden', 'true');
            const pmrem = new THREE.PMREMGenerator(this.renderer); const room = new RoomEnvironment();
            this.environment = pmrem.fromScene(room, 0.04); room.dispose(); pmrem.dispose();
            gpuResources.set(host,{renderer:this.renderer,environment:this.environment,pending:new Set()});
        }
        this.host.append(this.renderer.domElement);
        const initialSize=host.getBoundingClientRect();this.size={width:initialSize.width,height:initialSize.height};
        this.camera.aspect=initialSize.width/Math.max(1,initialSize.height);this.camera.updateProjectionMatrix();
        const oldSize=this.renderer.getSize(new THREE.Vector2());
        if(oldSize.x!==initialSize.width||oldSize.y!==initialSize.height)this.renderer.setSize(initialSize.width,initialSize.height);
        this.scene.environment = this.environment.texture;
        this.scene.environmentIntensity = 0.34;
        this.scene.fog = new THREE.FogExp2(0x081319, 0.016);
        this.scene.add(new THREE.HemisphereLight(0xc5dbd4, 0x091521, 0.7));
        const light = new THREE.DirectionalLight(0xffe2b3, 3); light.position.set(-4, 7, 8); this.scene.add(light);
        const rim = new THREE.DirectionalLight(0x5eabab, 2); rim.position.set(5, -1, -3); this.scene.add(rim);
        for (const p of positions.values()) {
            const [x, y] = this.cell(vector(p));
            const i = y * 48 + x; this.density[i] = (this.density[i] ?? 0) + 1;
        }
        for (let pass = 0; pass < 3; pass += 1) {
            const previous = this.density.slice();
            for (let y = 0; y < 24; y += 1) for (let x = 0; x < 48; x += 1) {
                let sum = 0;
                for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1)
                    sum += previous[Math.max(0, Math.min(23, y + dy)) * 48 + (x + dx + 48) % 48] ?? 0;
                this.density[y * 48 + x] = sum / 9;
            }
        }
        const maximum = Math.max(1, ...this.density);
        this.density = this.density.map(v => Math.sqrt(v / maximum));
        const geometry = form === 'globe' ? new THREE.SphereGeometry(1, 128, 80) : new THREE.PlaneGeometry(6.6, 4.6, 96, 64);
        const vertices = geometry.getAttribute('position'); const colors: number[] = [];
        for (let i = 0; i < vertices.count; i += 1) {
            const p = new THREE.Vector3().fromBufferAttribute(vertices, i);
            const q = form === 'globe' ? p : new THREE.Vector3(p.x / 3.2, p.y / 2.2, 0);
            const height = this.height(q);
            const surface = this.surface(q); vertices.setXYZ(i, surface.x, surface.y, surface.z);
            const color = new THREE.Color(0x061e29).lerp(new THREE.Color(0x365e50), height * 0.78);
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
        this.root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.62, side: THREE.DoubleSide })));
        if(form==='globe')this.root.add(new THREE.Mesh(new THREE.SphereGeometry(3.37,64,40),new THREE.ShaderMaterial({
            transparent:true,depthWrite:false,side:THREE.BackSide,
            vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
            fragmentShader:'varying vec3 n;varying vec3 v;void main(){float edge=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(0.12,0.33,0.37,edge*0.42);}',
        })));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.009, 6, 160), new THREE.MeshStandardMaterial({ color: 0xa79366, metalness: 0.9, roughness: 0.35 }));
        ring.rotation.x = 1.08; ring.rotation.y = 0.15; ring.position.y = -0.3; this.root.add(ring);
        this.renderedIds = [...positions.keys()];
        const coordinates = this.renderedIds.flatMap(id => {
            const p = this.surface(vector(positions.get(id) as Point3));
            if (form === 'globe') p.multiplyScalar(1.006); else p.z += 0.025;
            this.location.set(id, p); return p.toArray();
        });
        const dots = new THREE.BufferGeometry(); dots.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3));
        this.points = new THREE.Points(dots, new THREE.PointsMaterial({ color: 0xd7dace, size: 0.028, transparent: true, opacity: 0.74, sizeAttenuation: true }));
        this.root.add(this.points, this.links, this.marker);
        const orbGeometry = new THREE.SphereGeometry(0.2, 32, 20);
        const orbMaterial = new THREE.MeshPhysicalMaterial({ color: 0x799b91, metalness: 0.45, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x183d3b, emissiveIntensity: 0.35 });
        for (const gate of gates.slice(0, 8)) {
            const center = new THREE.Vector3(); let count = 0;
            for (const id of gate.members) { const p = positions.get(id); if (p !== undefined) { center.add(vector(p)); count += 1; } }
            if (count === 0) continue; center.divideScalar(count);
            const at = this.surface(center.clone()); if (form === 'globe') at.multiplyScalar(1.13); else at.z += 0.28;
            const orb = new THREE.Mesh(orbGeometry, orbMaterial); orb.position.copy(at); this.root.add(orb); this.gates.set(orb, gate);
            const preview=new THREE.BufferGeometry();
            preview.setAttribute('position',new THREE.Float32BufferAttribute(gate.members.slice(0,48).flatMap(id=>{const p=positions.get(id);return p===undefined?[]:vector(p).sub(center).normalize().multiplyScalar(0.205).toArray();}),3));
            orb.add(new THREE.Points(preview,new THREE.PointsMaterial({color:0xe2dcc0,size:0.008,sizeAttenuation:true})));
            const label = document.createElement('button'); label.type = 'button'; label.className = 'play-portal-label'; label.textContent = gate.title;
            label.setAttribute('aria-label', `进入${gate.title}的局部世界`); label.onclick = () => this.onEnter(gate.id);
            this.host.append(label); this.labels.set(label, at);
        }
        this.scene.add(this.root);
        this.camera.position.set(4, 3, 12);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = !this.reduced; this.controls.dampingFactor = 0.09;
        this.controls.enablePan = form !== 'globe'; this.controls.minDistance = 4.2; this.controls.maxDistance = 28;
        this.controls.addEventListener('change', this.invalidate);
        this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
        this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
        this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
        this.observer = new ResizeObserver(() => {
            const { width, height } = this.host.getBoundingClientRect();
            this.size = { width, height }; this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
            const currentSize=this.renderer.getSize(new THREE.Vector2());
            if(currentSize.x!==width||currentSize.y!==height)this.renderer.setSize(width, height);
            this.invalidate();
        }); this.observer.observe(host);
        this.visibility = new IntersectionObserver(([entry]) => { this.visible = entry?.isIntersecting ?? false; if (this.visible) this.invalidate(); }); this.visibility.observe(host);
        if (view !== undefined) { this.camera.position.copy(vector(view.position)); this.controls.target.copy(vector(view.target)); }
        document.addEventListener('visibilitychange', this.invalidate);
        this.renderer.compile(this.scene,this.camera);
        const resources=gpuResources.get(host);resources?.pending.forEach(material=>material.dispose());resources?.pending.clear();
        this.motionMedia.addEventListener('change',this.motionChanged);
        this.controls.update(); this.invalidate();
    }
    private cell(p: THREE.Vector3): [number, number] {
        if (this.form === 'globe') {
            p.normalize(); return [Math.min(47, Math.floor((Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5) * 48)), Math.min(23, Math.floor((Math.asin(clamp(p.y)) / Math.PI + 0.5) * 24))];
        }
        return [Math.min(47, Math.max(0, Math.floor((clamp(p.x) + 1) * 23.5))), Math.min(23, Math.max(0, Math.floor((clamp(p.y) + 1) * 11.5)))];
    }
    private height(p: THREE.Vector3): number { const [x,y] = this.cell(p.clone()); return this.density[y * 48 + x] ?? 0; }
    private surface(p: THREE.Vector3): THREE.Vector3 {
        if (this.form === 'globe') { if (p.lengthSq() < 1e-12) p.set(0,0,1); return p.normalize().multiplyScalar(2.85 + this.height(p) * 0.4); }
        const x = clamp(p.x) * 3.2, y = clamp(p.y) * 2.2;
        const z = this.form === 'lens' ? 0.8 - 0.09 * (x*x + y*y) : Math.sin(x * 1.1) * 0.45 + Math.sin(y * 1.8) * 0.22;
        return new THREE.Vector3(x,y,z + this.height(p) * 0.16);
    }
    private invalidate = (): void => { if (!this.disposed && this.frame === 0) this.frame = requestAnimationFrame(this.draw); };
    private draw = (now: number): void => {
        this.frame = 0; if (this.disposed || !this.visible || document.hidden) return;
        const moving = this.controls.update();
        if (this.animation !== null) {
            const a = this.animation; const t = Math.min(1, (now-a.started)/600); const eased = t*t*(3-2*t);
            if(this.form==='globe'){this.marker.position.copy(sphericalLerp(a.from,a.to,eased));this.camera.position.copy(sphericalLerp(a.cameraFrom,a.cameraTo,eased));}
            else{this.marker.position.lerpVectors(a.from,a.to,eased);this.camera.position.lerpVectors(a.cameraFrom,a.cameraTo,eased);}
            this.camera.lookAt(this.controls.target);
            if (t === 1) this.animation = null;
        }
        this.renderer.render(this.scene,this.camera); this.renders += 1;
        const occupied:Array<{x:number;y:number;width:number}>=[];
        for (const [label,position] of this.labels) {
            const p = position.clone().project(this.camera);
            const front = this.form !== 'globe' || position.dot(this.camera.position) > 0;
            const x=(p.x+1)*this.size.width/2+12,y=(1-p.y)*this.size.height/2-30,width=32+(label.textContent?.length??2)*14;
            const shown = front && p.z > -1 && p.z < 1 && x>width/2+8&&x<this.size.width-width/2-8&&y>80&&y<this.size.height-80 && !occupied.some(box=>Math.abs(box.x-x)<(box.width+width)/2+8&&Math.abs(box.y-y)<52);
            label.hidden = !shown;
            if(shown)occupied.push({x,y,width});
            label.style.left = `${String(x)}px`; label.style.top = `${String(y)}px`;
        }
        this.host.dataset.playRenders = String(this.renders); this.host.dataset.playDrawCalls = String(this.renderer.info.render.calls);
        this.host.dataset.playTriangles = String(this.renderer.info.render.triangles);
        this.host.dataset.playGeometries=String(this.renderer.info.memory.geometries);this.host.dataset.playTextures=String(this.renderer.info.memory.textures);this.host.dataset.playPrograms=String(this.renderer.info.programs?.length??0);
        if(this.host.dataset.playContext!=='lost')this.host.dataset.playContext='ready';
        if (moving || this.animation !== null) this.invalidate();
    };
    setFocus(id: string, neighbours: string[], mode: PlayParticipation, arrive = true): void {
        this.mode = mode; const destination = this.location.get(id); if (destination === undefined) return;
        this.marker.visible = true;
        const distance = (mode === 'travel' ? 6.6 : 12.5) / Math.min(1, this.camera.aspect);
        const target=this.form==='lens'?destination.clone().multiplyScalar(0.55):new THREE.Vector3();
        const cameraTo = this.form === 'globe' ? destination.clone().normalize().multiplyScalar(distance) : target.clone().add(new THREE.Vector3(0,1.5,this.form==='lens'?distance*0.8:distance));
        if(arrive)this.controls.target.copy(target);
        if (arrive && mode === 'travel' && !this.reduced && this.marker.position.lengthSq() > 0) {
            this.animation = { from: this.marker.position.clone(), to: destination.clone(), started: performance.now(), cameraFrom: this.camera.position.clone(), cameraTo };
        } else {
            this.animation = null; this.marker.position.copy(destination);
            if (arrive) { this.camera.position.copy(cameraTo); this.controls.target.copy(target); this.controls.update(); }
        }
        for (const child of [...this.links.children]) { if (child instanceof THREE.Line) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); } this.links.remove(child); }
        for (const neighbour of neighbours) {
            const end = this.location.get(neighbour); if (end === undefined) continue;
            const middle = destination.clone().add(end).multiplyScalar(0.5);
            if (this.form === 'globe') middle.normalize().multiplyScalar(3.7); else middle.z += 0.35;
            const curve = new THREE.QuadraticBezierCurve3(destination,middle,end);
            const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
            this.links.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({ color: 0xceba83, transparent: true, opacity: 0.58 })));
        }
        this.invalidate();
    }
    setBook(ids:ReadonlySet<string>|null,accent:string):void {
        const base=new THREE.Color(0x9ca8a7),lit=new THREE.Color(accent).lerp(new THREE.Color(0xffffff),0.42);
        const colors=this.renderedIds.flatMap(id=>{const color=ids===null?base:ids.has(id)?lit:base.clone().multiplyScalar(0.28);return [color.r,color.g,color.b];});
        this.points.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
        const material=this.points.material as THREE.PointsMaterial;
        if(!material.vertexColors){material.vertexColors=true;material.color.set(0xffffff);material.needsUpdate=true;}
        this.invalidate();
    }
    view(): SceneView { return { position: this.camera.position.toArray() as Point3, target: this.controls.target.toArray() as Point3 }; }
    nudge(dx: number, dy: number): void {
        if (this.mode === 'travel') {
            const current = this.marker.position.clone().project(this.camera);
            const candidates = [...this.location].map(([id,p]) => ({id,p:p.clone().project(this.camera)}))
                .filter(({id,p}) => p.z > -1 && p.z < 1 && (this.form!=='globe'||(this.location.get(id)?.dot(this.camera.position)??-1)>0) && (p.x-current.x)*dx + (p.y-current.y)*dy > 0.005)
                .sort((a,b) => a.p.distanceToSquared(current)-b.p.distanceToSquared(current));
            const next = candidates[0]; if (next !== undefined) this.onPick(next.id);
        } else { const offset = this.camera.position.clone().sub(this.controls.target); const sphere = new THREE.Spherical().setFromVector3(offset); sphere.theta += dx*0.15; sphere.phi = Math.max(0.1,Math.min(Math.PI-0.1,sphere.phi-dy*0.15)); this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sphere)); this.controls.update(); this.invalidate(); }
    }
    private motionChanged = ():void => {
        this.reduced=this.motionMedia.matches;this.controls.enableDamping=!this.reduced;
        if(this.reduced&&this.animation!==null){this.marker.position.copy(this.animation.to);this.camera.position.copy(this.animation.cameraTo);this.animation=null;this.controls.update();}
        this.invalidate();
    };
    private pointerDown = (event: PointerEvent): void => { this.down = {x:event.clientX,y:event.clientY}; if(this.animation!==null)this.marker.position.copy(this.animation.to);this.animation=null;this.invalidate(); };
    private pointerUp = (event: PointerEvent): void => {
        if (Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>7) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.camera);
        const orb = this.ray.intersectObjects([...this.gates.keys()],false)[0];
        const gate = orb === undefined ? undefined : this.gates.get(orb.object); if (gate !== undefined) { this.onEnter(gate.id); return; }
        this.ray.params.Points.threshold = 0.09;
        const hit = this.ray.intersectObject(this.points).find(entry=>this.form!=='globe'||entry.point.dot(this.camera.position)>0);
        const id = hit?.index === undefined ? undefined : this.renderedIds[hit.index]; if (id !== undefined) this.onPick(id);
    };
    private contextLost = (event: Event): void => { event.preventDefault(); this.host.dataset.playContext = 'lost'; this.labels.forEach((_,label)=>{label.hidden=true;}); };
    private contextRestored = (): void => {
        const generator=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
        this.environment.dispose();this.environment=generator.fromScene(room,0.04);room.dispose();generator.dispose();
        this.scene.environment=this.environment.texture;const resources=gpuResources.get(this.host);if(resources!==undefined)resources.environment=this.environment;
        this.host.dataset.playContext = 'ready'; this.invalidate();
    };
    dispose(): void {
        this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.visibility.disconnect(); this.controls.dispose(); document.removeEventListener('visibilitychange',this.invalidate);this.motionMedia.removeEventListener('change',this.motionChanged);
        this.renderer.domElement.removeEventListener('pointerdown',this.pointerDown); this.renderer.domElement.removeEventListener('pointerup',this.pointerUp);
        this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost); this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);
        const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
        this.scene.traverse(object=>{ if(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) { geometries.add(object.geometry); for(const material of Array.isArray(object.material)?object.material:[object.material]) materials.add(material); } });
        geometries.forEach(geometry=>geometry.dispose());this.labels.forEach((_,label)=>label.remove());
        const resources=gpuResources.get(this.host);
        if(this.host.isConnected&&resources!==undefined){materials.forEach(material=>resources.pending.add(material));}
        else {
            materials.forEach(material=>material.dispose());releasePlayGPU(this.host);
        }
    }
}
