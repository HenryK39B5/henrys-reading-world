import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { parsePlayWorldData, playSnapshotIdentity } from '../../src/domain/playWorld.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';

/** Read-only, fixed-path derivative endpoint. Never serves vectors, reports, or arbitrary private files. */
export function playWorldPlugin(enabled: boolean): Plugin {
    return {
        name: 'reading-world-play-private',
        config(_config, env) { if(enabled && env.command==='build')throw Error('Play-world exploration is loopback-only; no production build.'); },
        configureServer(server) {
            if(!enabled)return;
            server.middlewares.use((req,res,next)=>{
                if((req.url??'').split('?')[0]!=='/__play_world_geometry'){next();return;}
                res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
                if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end('Method Not Allowed');return;}
                void(async()=>{
                    try{
                        const checked=validateSnapshot(JSON.parse(await readFile('.private/local-snapshot.json','utf8')) as unknown,{expectedVisibility:'local-only'});
                        if(!checked.ok)throw Error('Invalid local snapshot');
                        const raw=await readFile('.private/play-world-exact-v2.json','utf8');
                        const data=parsePlayWorldData(JSON.parse(raw) as unknown,checked.snapshot);
                        if(data.snapshotHash!==createHash('sha256').update(playSnapshotIdentity(checked.snapshot)).digest('hex'))throw Error('Stale artifact');
                        res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(req.method==='HEAD'?'':raw);
                    }catch{res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Play world unavailable; prepare matching local geometry.');}
                })();
            });
        },
    };
}
