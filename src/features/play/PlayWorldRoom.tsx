import { useEffect,useMemo,useRef,useState } from 'react';
import type { MapRoomProps } from '../map/MapRoom.tsx';
import type { Highlight,Snapshot } from '../../domain/types.ts';
import { parsePlayWorldData,playSnapshotIdentity,playNeighbours,topicGates,topicMembers,type PlayWorldData } from '../../domain/playWorld.ts';
import { readingFrame,type ReadingFrame } from '../../domain/playExperience.ts';
import { flowBatch,flowExcerpt,type TextFlowMode } from '../../domain/textFlow.ts';
import { sitePath } from '../../app/sitePath.ts';
import { TextFlowScene,type FlowText } from './TextFlowScene.tsx';
import './play.css';
type Place={frame:ReadingFrame;anchor:string|null};
type Session={frame:ReadingFrame;anchor:string|null;parents:Place[];items:Highlight[];recent:string[]};
const memories=new WeakMap<Snapshot,Session>();
const requests=new WeakMap<Snapshot,Promise<PlayWorldData>>();
function geometry(snapshot:Snapshot):Promise<PlayWorldData>{
    const saved=requests.get(snapshot);if(saved!==undefined)return saved;
    const pending=fetch('/__play_world_geometry').then(async response=>{
        if(!response.ok)throw Error('本机联想资料暂时不可用；全部文字仍可流动与阅读。');
        const value=parsePlayWorldData(await response.json() as unknown,snapshot);
        const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(playSnapshotIdentity(snapshot)));
        const hash=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
        if(hash!==value.snapshotHash)throw Error('联想资料与原文不匹配；不使用这份关系。');return value;
    });requests.set(snapshot,pending);return pending;
}
function savedMode():TextFlowMode{try{return sessionStorage.getItem('reading-world-water-world')==='river'?'river':'tide';}catch{return 'tide';}}
function address(frame:ReadingFrame,anchor:string|null,bookId:string|null):string{
    const query=new URLSearchParams();if(bookId!==null)query.set('book',bookId);
    if(frame.selectedId!==null)query.set('h',frame.selectedId);
    if(frame.tags.length>0)query.set('world',frame.tags.join(','));if(anchor!==null)query.set('anchor',anchor);
    return query.size===0?'/map':`/map?${query.toString()}`;
}
/** Text moves; a caught original does not expire. Model exploration is explicit, never a mandatory junction. */
export function PlayWorldRoom({index,tagId,bookId,highlightId,worldTags=[],playAnchorId=null,onNavigate,onShare,previousPath}:MapRoomProps){
    const snapshot=index.snapshot;const requested=worldTags.length>0?worldTags:tagId===null?[]:[tagId];const requestedKey=requested.join(',');
    const signature=`${requestedKey}#${highlightId??''}#${playAnchorId??''}#${bookId??''}`;
    const [session,setSession]=useState<Session>(()=>{
        const saved=memories.get(snapshot);if(saved!==undefined&&saved.frame.tags.join(',')===requestedKey&&(highlightId===null||saved.frame.selectedId===highlightId)&&saved.anchor===playAnchorId)return saved;
        let members=topicMembers(snapshot.highlights,requested);
        if(bookId!==null&&highlightId===null){const fromBook=members.filter(h=>h.bookId===bookId);if(fromBook.length>0)members=fromBook;}
        const frame=readingFrame(members,requested,highlightId,playAnchorId,Math.random);
        return {frame,anchor:playAnchorId,parents:[],items:flowBatch(members,7,Math.random,new Set(),frame.selectedId),recent:[]};
    });
    const [mode,setMode]=useState<TextFlowMode>(savedMode);const [readingOpen,setReadingOpen]=useState(highlightId!==null);
    const [data,setData]=useState<PlayWorldData|null>(null);const [error,setError]=useState<string|null>(null);
    const [retry,setRetry]=useState(0);const handled=useRef(signature);const history=useRef(new Map<string,Place[]>());
    const source=useRef(previousPath!==null&&!previousPath.startsWith('/map')?previousPath:null);
    const original=useRef<HTMLElement>(null);
    const frame=session.frame;
    const members=useMemo(()=>topicMembers(snapshot.highlights,frame.tags),[snapshot,frame.tags]);
    const gates=useMemo(()=>topicGates(snapshot.highlights,frame.tags),[snapshot,frame.tags]);
    const pool=useMemo(()=>session.anchor===null?members:data===null?[]:playNeighbours(data,session.anchor,members,16),[members,session.anchor,data]);
    const current=frame.selectedId===null?undefined:index.highlightsById.get(frame.selectedId);
    const book=current===undefined?undefined:index.booksById.get(current.bookId);
    const litBook=bookId===null?undefined:index.booksById.get(bookId);
    const unknown=highlightId!==null&&!index.highlightsById.has(highlightId);
    const outside=highlightId!==null&&!unknown&&!members.some(h=>h.id===highlightId);
    const nextCandidates=useMemo(()=>current===undefined||data===null?[]:playNeighbours(data,current.id,members,16),[current,data,members]);
    const sceneItems:FlowText[]=useMemo(()=>session.items.map(h=>({id:h.id,text:h.text,title:index.booksById.get(h.bookId)?.title??''})),[session.items,index]);
    const open=()=>{setReadingOpen(true);requestAnimationFrame(()=>original.current?.focus({preventScroll:true}));};
    const close=()=>{setReadingOpen(false);setSession(old=>{const held=index.highlightsById.get(old.frame.selectedId??'');return held===undefined||old.items.some(h=>h.id===held.id)?old:{...old,items:[held,...old.items].slice(0,7)};});requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.text-flow-controls button')?.focus());};
    const navigate=(next:Session)=>{
        handled.current=`${next.frame.tags.join(',')}#${next.frame.selectedId??''}#${next.anchor??''}#${bookId??''}`;
        setSession(next);history.current.set(`${next.frame.tags.join(',')}#${next.anchor??''}`,next.parents);
        onNavigate(address(next.frame,next.anchor,bookId));
    };
    const select=(id:string)=>{if(!members.some(h=>h.id===id))return;open();navigate({...session,frame:{...frame,selectedId:id},recent:[...session.recent.filter(h=>h!==id),id].slice(-24)});};
    const newBatch=()=>setSession(old=>({...old,items:flowBatch(pool,7,Math.random,new Set(old.items.map(h=>h.id)),readingOpen?old.frame.selectedId:null),recent:[...old.recent,...old.items.map(h=>h.id)].slice(-24)}));
    const advance=(slot:number|null)=>{
        if(slot===null){newBatch();return;}
        setSession(old=>{const departing=old.items[slot];if(departing===undefined||(readingOpen&&departing.id===old.frame.selectedId))return old;
            const occupied=new Set(old.items.map(h=>h.id));if(readingOpen&&old.frame.selectedId!==null)occupied.add(old.frame.selectedId);
            const next=flowBatch(pool,1,Math.random,occupied)[0];if(next===undefined||occupied.has(next.id))return old;
            const items=[...old.items];items[slot]=next;return {...old,items,recent:[...old.recent,departing.id].slice(-24)};
        });
    };
    const previous=session.recent.filter(id=>id!==frame.selectedId&&members.some(h=>h.id===id)).at(-1);
    const explore=()=>{if(current===undefined||nextCandidates.length===0)return;
        const next={...session,anchor:current.id,frame:{...frame,anchorId:current.id},parents:[...session.parents,{frame,anchor:session.anchor}],items:flowBatch(nextCandidates,7,Math.random)};navigate(next);
    };
    const enter=(id:string)=>{if(!gates.some(g=>g.tagIds.includes(id)))return;
        const tags=[...frame.tags,id],child=topicMembers(snapshot.highlights,tags),next=readingFrame(child,tags,child.some(h=>h.id===frame.selectedId)?frame.selectedId:null,null,Math.random);
        navigate({frame:next,anchor:null,parents:[...session.parents,{frame,anchor:session.anchor}],items:flowBatch(child,7,Math.random,new Set(),next.selectedId),recent:session.recent});
    };
    const back=()=>{const parent=session.parents.at(-1);const next=parent?.frame??readingFrame(snapshot.highlights,[],frame.selectedId,null,Math.random);const anchor=parent?.anchor??null;
        const scope=topicMembers(snapshot.highlights,next.tags),target=anchor!==null&&data!==null?playNeighbours(data,anchor,scope,16):scope;
        navigate({...session,frame:next,anchor,parents:session.parents.slice(0,-1),items:flowBatch(target,7,Math.random,new Set(),next.selectedId)});
    };
    useEffect(()=>{memories.set(snapshot,session);},[snapshot,session]);
    useEffect(()=>{if(!__LOCAL_MODE__)return;let active=true;void geometry(snapshot).then(value=>{if(active){setData(value);setError(null);}},reason=>{if(active)setError(reason instanceof Error?reason.message:'联想资料不可用。');});return()=>{active=false;};},[snapshot,retry]);
    useEffect(()=>{if(handled.current===signature)return;handled.current=signature;if(highlightId!==null)setReadingOpen(true);
        const tags=requestedKey===''?[]:requestedKey.split(','),scope=topicMembers(snapshot.highlights,tags),next=readingFrame(scope,tags,highlightId,playAnchorId,Math.random);
        const target=playAnchorId!==null&&data!==null?playNeighbours(data,playAnchorId,scope,16):scope;
        setSession(old=>({...old,frame:next,anchor:playAnchorId,parents:history.current.get(`${requestedKey}#${playAnchorId??''}`)??[],items:flowBatch(target,7,Math.random,new Set(),next.selectedId)}));
    },[signature,requestedKey,highlightId,playAnchorId,snapshot,data]);
    // Matching graph arrival only changes an explicitly requested model scope, never the base stream.
    useEffect(()=>{if(session.anchor===null)return;setSession(old=>({...old,items:flowBatch(pool,7,Math.random)}));},[pool,session.anchor]);
    const changeMode=(value:TextFlowMode)=>{setMode(value);try{sessionStorage.setItem('reading-world-water-world',value);}catch{/* preference is optional */}};
    return <section className={`play-room play-edition-${mode}`} data-testid="play-world" data-play-data="ready">
        <header className="play-heading"><div><p className="play-eyebrow">HENRY’S READING WORLD · 文字本身的风景</p><h1>{mode==='tide'?'潮汐 · 水岸':'河流 · 河湾'}<span>不必选下一步，喜欢的就留一会儿。</span></h1></div>
            <div className="text-flow-modes" role="group" aria-label="两种文字流"><button type="button" aria-pressed={mode==='river'} onClick={()=>changeMode('river')}>河流</button><button type="button" aria-pressed={mode==='tide'} onClick={()=>changeMode('tide')}>潮汐</button></div></header>
        <nav className="play-breadcrumb" aria-label="阅读来路">{frame.tags.length>0||session.anchor!==null?<button type="button" onClick={back}>← {session.parents.length>0?'回到刚才的流':'回到全部'}</button>:<span>按书偶遇 · 多处同时经过</span>}
            {frame.tags.map(id=><span key={id}>{index.tagsById.get(id)?.title??'未知主题'}</span>)}<small>{new Set(pool.map(h=>h.bookId)).size} 本书 · {pool.length} 处划线{session.anchor!==null?' · 本机模型联想候选':''}</small>{source.current!==null?<a href={sitePath(source.current)}>回到刚才的房间</a>:null}</nav>
        {litBook!==undefined?<p className="play-lit-book" data-play-lit-book={litBook.id}>从《{litBook.title}》来到这里</p>:null}
        {unknown?<p role="status">这处原文不在当前资料中；下面仍是真实划线。</p>:null}
        {outside?<p role="status">请求的原文不属于当前范围。<button type="button" onClick={()=>{const next=readingFrame(snapshot.highlights,[],highlightId,null,Math.random);navigate({...session,frame:next,anchor:null,parents:[],items:flowBatch(snapshot.highlights,7,Math.random,new Set(),next.selectedId)});}}>打开请求的原文</button></p>:null}
        <div className="play-experience"><div className="play-landscape">
            <TextFlowScene items={sceneItems} mode={mode} heldId={readingOpen?frame.selectedId:null} onCatch={select} onAdvance={advance} onPrevious={()=>{if(previous!==undefined)select(previous);}} previousAvailable={previous!==undefined}/>
            <div className="text-flow-directory-heading"><details className="play-page-menu"><summary>文字目录 <span>{session.items.length}</span></summary><div className="play-page-strip" role="group" aria-label="留住一处文字">
                {session.items.map(h=><button type="button" key={h.id} aria-pressed={readingOpen&&h.id===frame.selectedId} data-highlight-id={h.id} onClick={()=>select(h.id)}><strong>{index.booksById.get(h.bookId)?.title}</strong><span>{flowExcerpt(h.text,60)}</span></button>)}
            </div></details><button type="button" onClick={newBatch} disabled={pool.length<2}>换一批文字 ↗</button></div>
            {session.anchor!==null&&pool.length===0?<p role="status">这里暂时没有可用的联想候选。原文仍可读，也可以返回全部文字。</p>:null}
        </div>
        <article className="play-original" hidden={!readingOpen} ref={original} tabIndex={-1} aria-label="当前完整原文" data-play-reading-highlight={current?.id}>
            <div className="play-reading-top"><p className="play-eyebrow">留住的这一处</p><button type="button" onClick={close}>放回流中 <span aria-hidden="true">↗</span></button></div>
            {current===undefined?<p>这个范围暂时没有原文，可以回到全部文字。</p>:<><blockquote><p>{current.text}</p><footer><span>《{book?.title}》</span><span>{book?.author}</span></footer></blockquote>
                <div className="play-clues">{current.tagIds.map(id=><a key={id} href={sitePath(`/paths/${id}?h=${current.id}`)}>#{index.tagsById.get(id)?.title}</a>)}</div>
                <div className="play-reading-actions"><button type="button" onClick={explore} disabled={nextCandidates.length===0||session.anchor===current.id}>沿这处流一会儿 →</button><a href={sitePath(`/books/${current.bookId}`)}>去这本书</a><button type="button" onClick={()=>onShare(current.id)}>分享</button></div>
            </>}
        </article></div>
        <section className="play-topics" aria-label="主题入口"><div><p className="play-eyebrow">想有个方向时</p><h2>沿主题看一会儿</h2></div><details className="play-entrances"><summary>浏览主题 <span>{gates.length}</span></summary>{gates.length===0?<p>这里不再划出更小的范围，仍可以继续看文字经过。</p>:<ul>{gates.map(g=><li key={g.tagIds.join('|')}><button type="button" onClick={()=>enter(g.tagIds[0] as string)}><span>{g.tagIds.map(id=>index.tagsById.get(id)?.title).join(' / ')}</span><small>{g.bookCount} 本书 · {g.memberIds.length} 处划线</small></button></li>)}</ul>}</details></section>
        {error!==null?<p className="play-data-note" role="status">{error}<button type="button" onClick={()=>{requests.delete(snapshot);setRetry(n=>n+1);}}>重试联想资料</button></p>:null}
        <details className="play-notes"><summary>关于这片文字</summary><p>文字来自真实划线。河流持续经过，潮汐成批到来/停留/退去；水路、岸线与文字位置是原创场景构图，不表示语义距离。“沿这处流一会儿”仅在匹配的本机资料中取实际模型候选，不是作者引用或观点一致；没有资料时仍可按书偶遇、阅读与分享。主题只筛选已有正标签，未标注仍留在全部文字。</p><p>这是原网站中的本机水岸探索，现有“随机一句”与已发布第二版不变。完整原文不等动画、不定时放走、不用拼字或完成任务。可以暂停动态，也可以通过原生目录选择、复制正文、去书房/主题小径或分享稳定原文。</p></details>
    </section>;
}
