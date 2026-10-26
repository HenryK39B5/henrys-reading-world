import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { hashBytes } from './mapCoordinatePolish.ts';
import { readCoordinateCandidate } from './mapCoordinateCandidate.ts';

const CANDIDATE='.private/research/map/coordinate-polish/selected-local.json';
/** Only the explicitly local full-site play mode can substitute map coordinates. No arbitrary file route. */
export function mapCoordinatePlugin(enabled:boolean):Plugin{
    let cachedKey='';let cached:ReturnType<typeof readCoordinateCandidate>|undefined;
    return {
        name:'reading-world-local-coordinate-candidate',
        config(_config,env){if(enabled&&env.command==='build')throw Error('Coordinate candidate is local-only; no production build.');},
        configureServer(server){
            if(!enabled)return;
            server.middlewares.use((req,res,next)=>{
                const path=(req.url??'').split('?')[0];
                if(path!=='/__local_snapshot'&&path!=='/__local_map_terrain'){next();return;}
                void(async()=>{
                    let raw:string;
                    try{raw=await readFile(CANDIDATE,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){next();return;}res.statusCode=503;res.end('Coordinate candidate unavailable.');return;}
                    res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
                    if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end('Method Not Allowed');return;}
                    try{
                        const source=await readFile('.private/local-snapshot.json','utf8');
                        const key=hashBytes(source)+'/'+hashBytes(raw);
                        if(cachedKey!==key||cached===undefined){cached=readCoordinateCandidate(raw,source);cachedKey=key;}
                        res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');
                        res.end(req.method==='HEAD'?'':JSON.stringify(path==='/__local_snapshot'?cached.snapshot:cached.terrain));
                    }catch{res.statusCode=503;res.end('Coordinate candidate is stale or invalid; original files are unchanged.');}
                })();
            });
        },
    };
}
