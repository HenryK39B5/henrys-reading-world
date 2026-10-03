import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapRoomProps } from '../map/MapRoom.tsx';
import type { Snapshot } from '../../domain/types.ts';
import { parsePlayWorldData, playSnapshotIdentity, playfulEncounter, topicGates, topicMembers, type PlayWorldData } from '../../domain/playWorld.ts';
import { readingAddress, readingFrame, readingPages, type ReadingFrame } from '../../domain/playExperience.ts';
import { sitePath } from '../../app/sitePath.ts';
import { ReadingScene, type ScenePage } from './ReadingScene.tsx';
import './play.css';

type Session = { frame: ReadingFrame; parents: ReadingFrame[]; seen: Set<string> };
const memories = new WeakMap<Snapshot, Session>();
const requests = new WeakMap<Snapshot, Promise<PlayWorldData>>();
const frameKey = (frame: ReadingFrame): string => `${frame.tags.join(',')}#${frame.anchorId ?? ''}`;
function geometry(snapshot: Snapshot): Promise<PlayWorldData> {
    const saved = requests.get(snapshot); if (saved !== undefined) return saved;
    const pending = fetch('/__play_world_geometry').then(async response => {
        if (!response.ok) throw Error('本机联想资料暂时不可用，仍可继续偶遇与阅读。');
        const value = parsePlayWorldData(await response.json() as unknown, snapshot);
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(playSnapshotIdentity(snapshot)));
        const hash = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2,'0')).join('');
        if (hash !== value.snapshotHash) throw Error('联想资料与原文不匹配，需要重新准备本机资料。');
        return value;
    }); requests.set(snapshot,pending); return pending;
}

/** One action model: select a real page, explicitly continue, explicitly enter/return. Never orbit to read. */
export function PlayWorldRoom({ index, tagId, bookId, highlightId, worldTags = [], playAnchorId = null, onNavigate, onShare, previousPath }: MapRoomProps) {
    const snapshot = index.snapshot;
    const requestedTags = worldTags.length > 0 ? worldTags : tagId === null ? [] : [tagId];
    const requestedKey = requestedTags.join(',');
    const signature = `${requestedKey}#${highlightId ?? ''}#${playAnchorId ?? ''}#${bookId ?? ''}`;
    const [session,setSession] = useState<Session>(() => {
        const saved = memories.get(snapshot);
        if (saved !== undefined && saved.frame.tags.join(',') === requestedKey &&
            (highlightId === null || saved.frame.selectedId === highlightId) &&
            (playAnchorId === null || saved.frame.anchorId === playAnchorId)) return saved;
        let members = topicMembers(snapshot.highlights, requestedTags);
        if (bookId !== null && highlightId === null) {
            const inBook = members.filter(h => h.bookId === bookId); if (inBook.length > 0) members = inBook;
        }
        const frame = readingFrame(members, requestedTags, highlightId, playAnchorId, Math.random);
        return { frame, parents: [], seen: new Set(frame.anchorId === null ? [] : [frame.anchorId]) };
    });
    const [data,setData] = useState<PlayWorldData | null>(null);
    const [settled,setSettled] = useState(!__LOCAL_MODE__);
    const [error,setError] = useState<string | null>(null);
    const [retry,setRetry] = useState(0);
    const handled = useRef(signature);
    const history = useRef(new Map<string,ReadingFrame[]>());
    const source = useRef(previousPath !== null && !previousPath.startsWith('/map') ? previousPath : null);
    const original = useRef<HTMLElement>(null);
    const [readingOpen,setReadingOpen] = useState(highlightId!==null);
    const readTrigger = useRef<HTMLElement|null>(null);
    const openReading = ():void => {readTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setReadingOpen(true);};
    const closeReading = ():void => {setReadingOpen(false);requestAnimationFrame(()=>{const button=document.querySelector<HTMLButtonElement>('.play-read-current');(button??readTrigger.current)?.focus();});};
    const {frame} = session;
    const members = useMemo(() => topicMembers(snapshot.highlights,frame.tags),[snapshot,frame.tags]);
    const gates = useMemo(() => topicGates(snapshot.highlights,frame.tags),[snapshot,frame.tags]);
    const pages = useMemo(() => readingPages(members,frame.anchorId,data,settled ? 7 : 1),[members,frame.anchorId,data,settled]);
    const current = frame.selectedId === null ? undefined : index.highlightsById.get(frame.selectedId);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);
    const selectedPage = pages.find(page => page.highlight.id === current?.id);
    const currentKind = selectedPage?.kind === 'candidate' ? '联想候选' : selectedPage?.kind === 'encounter' ? '这次偶遇' : '这片书页的起点';
    const litBook = bookId === null ? undefined : index.booksById.get(bookId);
    const unknown = highlightId !== null && !index.highlightsById.has(highlightId);
    const outside = highlightId !== null && !unknown && !members.some(h => h.id === highlightId);
    const scenePages: ScenePage[] = useMemo(() => pages.map(page => ({ id:page.highlight.id,
        title:index.booksById.get(page.highlight.bookId)?.title ?? '', preview:page.highlight.text,
        kind:page.kind === 'candidate' ? '联想候选' : page.kind === 'encounter' ? '偶遇一页' : '从这里出发',
    })),[pages,index]);
    useEffect(() => {
        if (!__LOCAL_MODE__) return;
        let active = true;
        void geometry(snapshot).then(value => { if(active){setData(value);setError(null);setSettled(true);} },reason => {
            if(active){setError(reason instanceof Error ? reason.message : '联想资料不可用。');setSettled(true);}
        });
        return () => {active=false;};
    },[snapshot,retry]);
    useEffect(() => { memories.set(snapshot,session); history.current.set(frameKey(frame),session.parents); },[snapshot,session,frame]);
    useEffect(() => {
        if (handled.current === signature) return;
        handled.current = signature;
        if(highlightId!==null)setReadingOpen(true);
        const tags = requestedKey === '' ? [] : requestedKey.split(',');
        const scope = topicMembers(snapshot.highlights,tags);
        const next = readingFrame(scope,tags,highlightId,playAnchorId,Math.random);
        setSession(previous => ({frame:next,parents:history.current.get(frameKey(next)) ?? [],seen:new Set([...previous.seen,...(next.anchorId === null ? [] : [next.anchorId])])}));
    },[signature,requestedKey,highlightId,playAnchorId,snapshot]);
    const commit = (next: Session): void => {
        setSession(next); history.current.set(frameKey(next.frame),next.parents);
        onNavigate(readingAddress(next.frame,bookId));
    };
    const select = (id: string): void => {
        if (!members.some(h => h.id === id)) return;
        openReading();
        commit({...session,frame:{...frame,selectedId:id}});
    };
    const continueFromHere = (): void => {
        if (current === undefined || frame.anchorId === current.id) return;
        commit({...session,frame:{...frame,anchorId:current.id},seen:new Set([...session.seen,current.id])});
    };
    const encounter = (): void => {
        let id = playfulEncounter(members,session.seen,Math.random);
        if (id === null) id = playfulEncounter(members,new Set(frame.anchorId === null ? [] : [frame.anchorId]),Math.random);
        if (id === null) return;
        commit({...session,frame:{...frame,anchorId:id,selectedId:id},seen:new Set([...session.seen,id])});
    };
    const enter = (id: string): void => {
        if (!gates.some(g => g.tagIds.includes(id))) return;
        const tags = [...frame.tags,id]; const child = topicMembers(snapshot.highlights,tags);
        const next = readingFrame(child,tags,child.some(h => h.id === frame.selectedId) ? frame.selectedId : null,null,Math.random);
        commit({frame:next,parents:[...session.parents,frame],seen:new Set(next.anchorId === null ? [] : [next.anchorId])});
    };
    const back = (): void => {
        const parent = session.parents.at(-1);
        if (parent !== undefined) commit({...session,frame:parent,parents:session.parents.slice(0,-1)});
        else commit({...session,frame:readingFrame(snapshot.highlights,[],frame.selectedId,frame.anchorId,Math.random),parents:[]});
    };
    return <section className="play-room" data-testid="play-world" data-play-data={settled?'ready':'loading'}>
        <header className="play-heading"><div><p className="play-eyebrow">HENRY’S READING WORLD · 本机新探索</p>
            <h1>暮光庭院<span>可以先逛一会儿，再读一处。</span></h1></div>
            <button className="play-new-pages" type="button" onClick={encounter} disabled={members.length < 2}>换一片书页 <span aria-hidden="true">↗</span></button>
        </header>
        <nav className="play-breadcrumb" aria-label="阅读来路">
            {frame.tags.length > 0 ? <button type="button" onClick={back}>← {session.parents.length > 0 ? '返回上一片' : '全部书页'}</button> : <span>自由漫游</span>}
            {frame.tags.map(id => <span key={id}>{index.tagsById.get(id)?.title ?? '未知主题'}</span>)}
            <small>{new Set(members.map(h=>h.bookId)).size} 本书 · {members.length} 处划线</small>
            {source.current !== null ? <a href={sitePath(source.current)}>回到刚才的房间</a> : null}
        </nav>
        {litBook !== undefined ? <p className="play-lit-book" data-play-lit-book={litBook.id}>从《{litBook.title}》来到这里</p> : null}
        {unknown ? <p role="status">这处原文不在当前资料中；下面是其他真实书页。</p> : null}
        {outside ? <p role="status">请求的原文不属于这一片主题。<button type="button" onClick={()=>commit({...session,frame:readingFrame(snapshot.highlights,[],highlightId,null,Math.random),parents:[]})}>打开请求的原文</button></p> : null}
        <div className="play-experience">
            <div className="play-landscape">
                <ReadingScene pages={scenePages} selectedId={frame.selectedId} onSelect={select} onRead={openReading} readingOpen={readingOpen}/>
                <details className="play-page-menu"><summary>文字目录 <span>{pages.length}</span></summary>
                <div className="play-page-strip" role="group" aria-label="选择书页">
                    {pages.map(page => <button type="button" key={page.highlight.id} aria-pressed={page.highlight.id === frame.selectedId}
                        data-highlight-id={page.highlight.id} onClick={()=>select(page.highlight.id)}>
                        <span className="play-page-kind">{page.kind==='candidate'?'联想候选':page.kind==='encounter'?'偶遇':'起点'}</span>
                        <strong>{index.booksById.get(page.highlight.bookId)?.title}</strong><span>{Array.from(page.highlight.text).slice(0,44).join('')}{page.highlight.text.length>44?'…':''}</span>
                    </button>)}
                </div>
                </details>
                {!settled ? <p role="status" className="play-data-note">原文已经可以读，正在准备周围的书页……</p> : null}
            </div>
            <article className="play-original" hidden={!readingOpen} ref={original} tabIndex={-1} aria-label="当前完整原文" data-play-reading-highlight={current?.id}>
                <div className="play-reading-top"><p className="play-eyebrow">{currentKind}</p><button type="button" onClick={closeReading}>收起阅读 <span aria-hidden="true">×</span></button></div>
                {current === undefined ? <p>这片主题暂时没有原文，可以返回全部书页。</p> : <>
                    <blockquote><p>{current.text}</p><footer><span>《{book?.title}》</span><span>{book?.author}</span></footer></blockquote>
                    <div className="play-clues">{current.tagIds.map(id=><a key={id} href={sitePath(`/paths/${id}?h=${current.id}`)}>#{index.tagsById.get(id)?.title}</a>)}</div>
                    <div className="play-reading-actions"><button type="button" onClick={continueFromHere} disabled={frame.anchorId===current.id}>从这页继续 <span aria-hidden="true">→</span></button>
                        <a href={sitePath(`/books/${current.bookId}`)}>去这本书</a><button type="button" onClick={()=>onShare(current.id)}>分享</button></div>
                </>}
            </article>
        </div>
        <section className="play-topics" aria-label="主题入口"><div><p className="play-eyebrow">换个方向</p><h2>还有这些主题</h2></div>
            <details className="play-entrances"><summary>浏览主题 <span>{gates.length}</span></summary>
                {gates.length===0?<p>这里不再划出更小的主题，仍可以换一片书页继续读。</p>:<ul>{gates.map(g=><li key={g.tagIds.join('|')}><button type="button" onClick={()=>enter(g.tagIds[0] as string)}>
                    <span>{g.tagIds.map(id=>index.tagsById.get(id)?.title).join(' / ')}</span><small>{g.bookCount} 本书 · {g.memberIds.length} 处划线</small></button></li>)}</ul>}
            </details>
        </section>
        {error!==null?<p className="play-data-note" role="status">{error}<button type="button" onClick={()=>{requests.delete(snapshot);setRetry(n=>n+1);}}>重试联想资料</button></p>:null}
        <details className="play-notes"><summary>关于这片书页</summary><p>书与原文都来自已有真实划线。“联想候选”来自本机模型，不是作者之间的引用或观点一致；“偶遇”不表示内容相似。庭院是独立设计的装饰场景，不是从语料生成的地理或作者关系；点亮的入口各绑定一处真实划线。主题入口只筛选已记录的标签，未标注的原文仍留在全部书页里。</p>
            <p>这是未上线的游戏式场景探索。拨动光与浮桥是纯视觉游玩，不改变阅读候选、标签或原文，不需解锁才能阅读。完整原文立即显示，不必等动作效果。没有模型资料时仍可静态运行并按书偶遇；完整文字、出处、书房、小径与分享不依赖3D。</p></details>
    </section>;
}
