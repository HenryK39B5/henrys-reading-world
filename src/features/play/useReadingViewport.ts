import {useEffect,useRef,useState} from 'react';
import {readingOverflow} from './readingMotion.ts';
export function useReadingViewport(id:string|null,open:boolean,mode:string){
    const viewport=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
    const [edges,setEdges]=useState({above:false,below:false});
    const measure=()=>{const el=viewport.current;if(el===null)return;const next=readingOverflow(el.scrollTop,el.clientHeight,el.scrollHeight);setEdges(old=>old.above===next.above&&old.below===next.below?old:next);};
    useEffect(()=>{if(open&&viewport.current!==null)viewport.current.scrollTop=0;},[id,open]);
    useEffect(()=>{const el=viewport.current,inner=content.current;if(el===null||inner===null||!open)return;
        measure();const observer=new ResizeObserver(measure);observer.observe(el);observer.observe(inner);
        return()=>observer.disconnect();
    },[id,open,mode]);
    const scroll=(distance:number)=>{viewport.current?.scrollBy({top:distance,behavior:'instant'});};
    return {viewport,content,edges,measure,scroll};
}
