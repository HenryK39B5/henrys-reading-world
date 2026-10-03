import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRoomProps } from '../map/MapRoom.tsx';
import type { Snapshot } from '../../domain/types.ts';
import { localPositions, parsePlayWorldData, playNeighbours, playSnapshotIdentity, playfulEncounter, topicGates, topicMembers } from '../../domain/playWorld.ts';
import type { PlayForm, PlayParticipation, PlayWorldData } from '../../domain/playWorld.ts';
import { sitePath } from '../../app/sitePath.ts';
import { coverUrl, useCoverAccent } from '../../app/covers.ts';
import { PlayScene, releasePlayGPU } from './PlayScene.ts';
import type { SceneView } from './PlayScene.ts';
import './play.css';

type WorldFrame = { tags: string[]; current: string | null; view?: SceneView };
type Memory = { tags: string[]; current: string | null; form: PlayForm; mode: PlayParticipation; parents: WorldFrame[]; seen: Set<string>; view?: SceneView };
const memories = new WeakMap<Snapshot, Memory>();
const requests = new WeakMap<Snapshot, Promise<PlayWorldData>>();
function loadGeometry(snapshot: Snapshot): Promise<PlayWorldData> {
    const previous = requests.get(snapshot); if (previous !== undefined) return previous;
    const promise = fetch('/__play_world_geometry').then(async response => {
        if (!response.ok) throw Error('本机世界数据尚未准备好，请运行 npm run play:prepare。');
        const data = parsePlayWorldData(await response.json() as unknown,snapshot);
        const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(playSnapshotIdentity(snapshot)));
        const hash = [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
        if (hash !== data.snapshotHash) throw Error('世界与当前原文不匹配，需要重新准备本机数据。');
        return data;
    }); requests.set(snapshot,promise); return promise;
}

export function PlayWorldRoom({ index, tagId, bookId, highlightId, worldTags = [], onNavigate, onShare, previousPath }: MapRoomProps) {
    const snapshot = index.snapshot;
    const [memory,setMemory] = useState<Memory>(() => {
        const saved = memories.get(snapshot);
        if (saved !== undefined && (highlightId === null || saved.current === highlightId) &&
            saved.tags.join(',') === (worldTags.length > 0 ? worldTags.join(',') : tagId ?? '') &&
            (bookId === null || (saved.current !== null && index.highlightsById.get(saved.current)?.bookId === bookId))) return saved;
        const tags = worldTags.length > 0 ? worldTags : tagId !== null && index.tagsById.has(tagId) ? [tagId] : [];
        let members = topicMembers(snapshot.highlights,tags);
        if (bookId !== null) { const inBook = members.filter(h=>h.bookId===bookId); if(inBook.length>0)members=inBook; }
        const current = highlightId !== null && index.highlightsById.has(highlightId) ? highlightId : playfulEncounter(members,new Set(),Math.random);
        return { tags, current, form:'globe', mode:'touch', parents:[], seen:new Set(current===null?[]:[current]) };
    });
    const [data,setData] = useState<PlayWorldData|null>(null);
    const [error,setError] = useState<string|null>(null);
    const [gpuError,setGpuError] = useState(false);
    const [retry,setRetry] = useState(0);
    const host = useRef<HTMLDivElement>(null);
    const original = useRef<HTMLElement>(null);
    const source = useRef(previousPath!==null&&!previousPath.startsWith('/map')?previousPath:null);
    const parentHistory = useRef(new Map<string,WorldFrame[]>());
    const scene = useRef<PlayScene|null>(null);
    const focusToken = useRef('');
    const lastWorld = useRef(worldTags.join(','));
    const views = useRef(new Map<string,SceneView>());
    const latest = useRef(memory); latest.current = memory;
    const pickRef = useRef<(id:string)=>void>(()=>{});
    const enterRef = useRef<(id:string)=>void>(()=>{});
    const members = useMemo(()=>topicMembers(snapshot.highlights,memory.tags),[snapshot,memory.tags]);
    const gates = useMemo(()=>topicGates(snapshot.highlights,memory.tags),[snapshot,memory.tags]);
    const positions = useMemo(()=>data===null?new Map():localPositions(data,members.map(h=>h.id)),[data,members]);
    const current = memory.current === null ? undefined : index.highlightsById.get(memory.current);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);
    const litBook = bookId===null?undefined:index.booksById.get(bookId);
    const bookAccent = useCoverAccent(coverUrl(litBook?.coverPath));
    const litIds=useMemo(()=>litBook===undefined?null:new Set((index.highlightsByBook.get(litBook.id)??[]).map(h=>h.id)),[litBook,index]);
    const neighbours = useMemo(()=>data===null||current===undefined?[]:playNeighbours(data,current.id,members),[data,current,members]);
    const allSeen = members.length > 0 && members.every(h=>memory.seen.has(h.id));
    useEffect(()=>{ let cancelled=false; void loadGeometry(snapshot).then(value=>{if(!cancelled){setData(value);setError(null);}},reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'本机世界无法打开。');});return()=>{cancelled=true;};},[snapshot,retry]);
    useEffect(()=>{memories.set(snapshot,memory);parentHistory.current.set(memory.tags.join(','),memory.parents);},[snapshot,memory]);
    const worldKey = worldTags.join(',');
    useEffect(()=>{
        const changedWorld = lastWorld.current !== worldKey; lastWorld.current = worldKey;
        if(!changedWorld && (highlightId===null || highlightId===latest.current.current))return;
        setMemory(previous=>{
            const requestedTags = changedWorld ? worldTags : previous.tags;
            const target = highlightId!==null&&index.highlightsById.has(highlightId) ? highlightId : previous.current;
            const restored = previous.parents.findIndex(frame=>frame.tags.join(',')===worldKey);
            const frame = restored<0?undefined:previous.parents[restored];
            const next:Memory={...previous,tags:requestedTags,current:target,parents:parentHistory.current.get(worldKey) ?? (frame===undefined?previous.parents:previous.parents.slice(0,restored)),seen:new Set(target===null?[]:[target])};
            delete next.view;
            const savedView=views.current.get(worldKey);if(savedView!==undefined)next.view=savedView;
            return next;
        });
    },[highlightId,index,worldKey,worldTags]);
    const pick = useCallback((id:string)=>{
        if(!index.highlightsById.has(id))return;
        setMemory(previous=>({...previous,current:id,seen:new Set([...previous.seen,id])}));
        const query=new URLSearchParams(); query.set('h',id);
        if(tagId!==null)query.set('tag',tagId); if(bookId!==null)query.set('book',bookId);
        if(latest.current.tags.length>0)query.set('world',latest.current.tags.join(','));
        onNavigate(`/map?${query.toString()}`);
    },[index,onNavigate,tagId,bookId]);
    const enter = useCallback((id:string)=>{
        const gate=gates.find(g=>g.tagIds.includes(id)); if(gate===undefined)return;
        const parent=latest.current;
        const tags=[...parent.tags,id]; const child=topicMembers(snapshot.highlights,tags);
        const currentId=child.some(h=>h.id===parent.current)?parent.current:playfulEncounter(child,new Set(),Math.random);
        const frame:WorldFrame={tags:parent.tags,current:parent.current,...(scene.current===null?{}:{view:scene.current.view()})};
        if(frame.view!==undefined)views.current.set(parent.tags.join(','),frame.view);
        lastWorld.current=tags.join(',');
        setMemory({tags,current:currentId,form:parent.form,mode:parent.mode,parents:[...parent.parents,frame],seen:new Set(currentId===null?[]:[currentId])});
        const query=new URLSearchParams();if(currentId!==null)query.set('h',currentId);if(tagId!==null)query.set('tag',tagId);query.set('world',tags.join(','));onNavigate(`/map?${query.toString()}`);
    },[gates,snapshot,onNavigate,tagId]);
    pickRef.current=pick; enterRef.current=enter;
    const sceneGates=useMemo(()=>gates.map(g=>({id:g.tagIds[0] as string,title:g.tagIds.map(id=>index.tagsById.get(id)?.title).join(' / '),members:g.memberIds})),[gates,index]);
    useEffect(()=>{
        if(host.current===null||data===null)return;
        if(members.length===0){releasePlayGPU(host.current);host.current.dataset.playRenders='0';host.current.dataset.playMemberCount='0';host.current.dataset.playContext='empty';return;}
        const holder=host.current;
        let active:PlayScene;
        try{active=new PlayScene(holder,positions,memory.form,sceneGates,id=>pickRef.current(id),id=>enterRef.current(id),latest.current.view);scene.current=active;setGpuError(false);}
        catch{releasePlayGPU(holder);setGpuError(true);return;}
        const now=latest.current;
        if(now.current!==null)active.setFocus(now.current,playNeighbours(data,now.current,members).map(h=>h.id),now.mode,now.view===undefined);
        focusToken.current=`${now.current ?? ''}:${now.mode}`;
        const scopeKey=memory.tags.join(','),viewCache=views.current;
        return()=>{const view=active.view();viewCache.set(scopeKey,view);memories.set(snapshot,{...latest.current,view});active.dispose();if(scene.current===active)scene.current=null;};
    },[data,positions,memory.form,memory.tags,sceneGates,members,snapshot]);
    useEffect(()=>{const token=`${current?.id ?? ''}:${memory.mode}`;if(current!==undefined&&token!==focusToken.current){scene.current?.setFocus(current.id,neighbours.map(h=>h.id),memory.mode);focusToken.current=token;}},[current,neighbours,memory.mode]);
    useEffect(()=>{scene.current?.setBook(litIds,bookAccent);},[litIds,bookAccent,data,positions,memory.form]);
    useEffect(()=>{const holder=host.current;return()=>{if(holder!==null)releasePlayGPU(holder);};},[]);
    const leave = ():void=>{
        const frame=memory.parents.at(-1);if(frame===undefined)return;
        lastWorld.current=frame.tags.join(',');
        setMemory({...memory,tags:frame.tags,current:frame.current,parents:memory.parents.slice(0,-1),seen:new Set(frame.current===null?[]:[frame.current]),...(frame.view===undefined?{}:{view:frame.view})});
        const query=new URLSearchParams();if(frame.current!==null)query.set('h',frame.current);if(tagId!==null)query.set('tag',tagId);if(frame.tags.length>0)query.set('world',frame.tags.join(','));onNavigate(`/map?${query.toString()}`);
    };
    const encounter = ():void=>{
        const id=playfulEncounter(members,allSeen?new Set():memory.seen,Math.random);if(id!==null)pick(id);
    };
    const modeNames:Record<PlayParticipation,string>={touch:'拨动世界',travel:'走进世界'};
    const formNames:Record<PlayForm,string>={globe:'球中世界',lens:'焦点透镜',fold:'展开曲面'};
    return <section className="play-room" data-testid="play-world" data-play-form={memory.form} data-play-mode={memory.mode}>
        <header className="play-heading"><div><p className="play-eyebrow">本机探索 · 一处文字，一个入口</p><h1>{memory.tags.length===0?'让文字成为世界':memory.tags.map(id=>index.tagsById.get(id)?.title).join(' · ')}</h1></div>
            {source.current!==null?<a href={sitePath(source.current)}>回到刚才的房间</a>:null}</header>
        {highlightId!==null&&!index.highlightsById.has(highlightId)?<p role="status">这处原文不在当前本机资料中；下面展示的是世界里的其他真实原文。</p>:null}
        <div className="play-controls"><div aria-label="参与方式">{(['touch','travel'] as const).map(mode=><button key={mode} type="button" aria-pressed={memory.mode===mode} onClick={()=>setMemory({...memory,mode})}>{modeNames[mode]}</button>)}</div>
            <details><summary>变换世界的形状</summary><div>{(['globe','lens','fold'] as const).map(form=><button key={form} type="button" aria-pressed={memory.form===form} onClick={()=>{const next={...memory,form};delete next.view;setMemory(next);}}>{formNames[form]}</button>)}</div></details></div>
        {litBook!==undefined?<p className="play-lit-book" data-play-lit-book={litBook.id}>点亮《{litBook.title}》 · {litIds?.size??0} 处原文</p>:null}
        {memory.parents.length>0?<nav className="play-breadcrumb" aria-label="世界来路"><button type="button" onClick={leave}>← 返回上一层世界</button><span>{memory.tags.map(id=>index.tagsById.get(id)?.title).join(' ∩ ')}</span></nav>:null}
        {memory.tags.length>0&&memory.parents.length===0?<button type="button" onClick={()=>{lastWorld.current='';setMemory({...memory,tags:[],parents:[]});onNavigate(memory.current===null?'/map':`/map?h=${memory.current}`);}}>回到总世界</button>:null}
        <div className="play-stage" ref={host} data-play-fallback={gpuError?'true':undefined} tabIndex={0} role="group" aria-label="阅读世界。方向键拨动或移动，下方文字入口可独立操作。" onKeyDown={event=>{
            if(event.target!==event.currentTarget)return;
            const deltas:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};const delta=deltas[event.key];if(delta!==undefined){event.preventDefault();scene.current?.nudge(...delta);}
        }}>
            <div className="play-stage-caption"><span>{formNames[memory.form]}</span><small>{memory.mode==='touch'?'拖动世界 · 触碰亮点 · 进入小球':'光粒随你抵达文字 · 方向键也能前行'}</small></div>
            {data===null?<p className="play-loading" role="status">{error??'正在把真实文字展开成世界……'}</p>:null}
            {members.length===0?<p className="play-loading" role="status">这一层没有已记录的符合条件原文，可以返回上一层或总世界。</p>:null}
            {gpuError?<p className="play-loading" role="status">这个浏览器暂时无法绘制 3D。下方的原文和入口仍可完整阅读。</p>:null}
            {current!==undefined&&members.length>0?<div className="play-scene-peek"><p>{Array.from(current.text).slice(0,58).join('')}{Array.from(current.text).length>58?'…':''}</p><button type="button" onClick={()=>{original.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});original.current?.focus({preventScroll:true});}}>停下来，读完整原文 ↗</button></div>:null}
            <div className="play-direction-pad" aria-label="世界方向">{([['←',-1,0],['↑',0,1],['↓',0,-1],['→',1,0]] as const).map(([label,x,y])=><button type="button" key={label} aria-label={`向${label}探索`} onClick={()=>scene.current?.nudge(x,y)}>{label}</button>)}</div>
        </div>
        {error!==null?<button type="button" onClick={()=>{requests.delete(snapshot);setRetry(retry+1);}}>重新读取本机世界</button>:null}
        <div className="play-reading" data-play-reading-highlight={current?.id}>
            <article className="play-original" ref={original} tabIndex={-1} aria-label="当前完整原文"><p className="play-eyebrow">在这里停一会儿</p>
                {current===undefined?<p>这里暂时没有可读原文。</p>:<><blockquote><p>{current.text}</p><footer>——《{book?.title}》{book?.author}</footer></blockquote>
                    <div className="play-clues">{current.tagIds.map(id=><a key={id} href={sitePath(`/paths/${id}?h=${current.id}`)}>#{index.tagsById.get(id)?.title}</a>)}</div>
                    <div className="play-reading-actions"><button type="button" onClick={encounter}>{allSeen?'重新遇见这一片世界':'再遇见一处'}</button><a href={sitePath(`/books/${current.bookId}`)}>去这本书的书房</a><button type="button" onClick={()=>onShare(current.id)}>分享</button></div></>}
            </article>
            <aside className="play-echoes"><h2>触碰之后，文字的回声</h2>{neighbours.length===0?<p>这片局部里没有预计算的相邻候选。不妨再遇见一处。</p>:<ul>{neighbours.map(h=><li key={h.id}><button type="button" onClick={()=>pick(h.id)}><span>{Array.from(h.text).slice(0,90).join('')}{Array.from(h.text).length>90?'…':''}</span><small>《{index.booksById.get(h.bookId)?.title}》</small></button></li>)}</ul>}</aside>
        </div>
        <details className="play-entrances"><summary>进入这片世界里的其他主题（{gates.length}）</summary>{gates.length===0?<p>这一层不再划出更小的主题世界，原文仍可继续读。</p>:<ul>{gates.map(g=><li key={g.tagIds.join('|')}><button type="button" onClick={()=>enter(g.tagIds[0] as string)}><span>{g.tagIds.map(id=>index.tagsById.get(id)?.title).join(' / ')}</span><small>{g.bookCount} 本书 · {g.memberIds.length} 处原文</small></button></li>)}</ul>}</details>
        <details className="play-notes"><summary>关于这个本机世界</summary><p>所有亮点都是已有真实划线。主题里的主题表示已记录标签的交集；未标注的原文仍留在总世界。连线是本机模型的候选联想，不是作者之间的引用或观点一致。三种形状只是不同的空间表达，不保证屏幕距离等于内容相似度。</p><p>本轮保留两种参与方式和三种形状供完整站点探索，没有选定最终产品。角色目前是一粒光，不含关卡、计分或强制解谜。</p></details>
    </section>;
}
