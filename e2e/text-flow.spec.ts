import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import type {Snapshot} from '../src/domain/types.ts';
import {topicGates,topicMembers,type PlayWorldData,playNeighbours} from '../src/domain/playWorld.ts';
const snapshot=JSON.parse(readFileSync('.private/local-snapshot.json','utf8')) as Snapshot;const byId=new Map(snapshot.highlights.map(h=>[h.id,h]));
const evidence=process.env.TEXT_FLOW_EVIDENCE??'.private/review/text-flow/final';
mkdirSync(evidence,{recursive:true});
async function ready(page:Page){await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','ready');}
async function original(page:Page,id:string){await expect(page.locator('.play-original')).toBeVisible();await expect(page.locator('.play-original')).toHaveAttribute('data-play-reading-highlight',id);await expect(page.locator('.play-original blockquote > p')).toHaveText(byId.get(id)?.text??'');}
async function menu(page:Page){const d=page.locator('.play-page-menu');if(await d.getAttribute('open')===null)await d.locator('summary').click();}
for(const width of [1440,390,320])test(`both forms show several distinct genuine passages and separated targets at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:980});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/map');await ready(page);await expect(page.locator('.play-original')).toBeHidden();
 for(const mode of ['river','tide']){await page.getByRole('button',{name:mode==='river'?'河流':'潮汐',exact:true}).click();await ready(page);await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-mode',mode);
 await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-visible',width===1440?'7':'4');
 const boxes=await page.locator('.text-flow-hit:visible').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{id:(b as HTMLElement).dataset.highlightId,x:r.x,y:r.y,w:r.width,h:r.height};}));
 expect(new Set(boxes.map(b=>b.id)).size).toBe(width===1440?7:4);expect(boxes.every(b=>byId.has(b.id??''))).toBe(true);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a===undefined||b===undefined)throw Error('Missing box');expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).toBe(false);}
 await page.getByTestId('text-flow').screenshot({path:`${evidence}/${info.project.name}-${width}-${mode}.png`});
 }expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});
test('direct catch reads exactly, selection is not exploration; release, source, share and refresh work',async({page})=>{
 await page.goto('/map');await ready(page);const target=page.locator('.text-flow-hit:visible').nth(1);const id=await target.getAttribute('data-highlight-id');if(id===null)throw Error('No genuine target');
 const before=await page.getByTestId('text-flow').getAttribute('data-flow-ids');await target.click();await original(page,id);expect(new URL(page.url()).searchParams.get('h')).toBe(id);expect(new URL(page.url()).searchParams.has('anchor')).toBe(false);
 expect(await page.getByTestId('text-flow').getAttribute('data-flow-ids')).toBe(before);
 await expect.poll(async()=>Number(await page.getByTestId('text-flow').getAttribute('data-flow-visible'))).toBeGreaterThanOrEqual(2);
 for(const tag of byId.get(id)?.tagIds??[])await expect(page.locator(`.play-clues a[href*="/paths/${tag}?"]`)).toHaveCount(1);
 await page.getByRole('button',{name:'分享',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(byId.get(id)?.text??'');await page.keyboard.press('Escape');
 const address=page.url();await page.getByRole('link',{name:'去这本书',exact:true}).click();await expect(page).toHaveURL(/\/books\/b-/);await page.goBack();await ready(page);expect(page.url()).toBe(address);await original(page,id);
 await page.reload();await ready(page);await original(page,id);await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.locator('.play-original')).toBeHidden();await expect(page.getByRole('button',{name:'暂停流动',exact:true})).toBeFocused();
});
test('river approach steadies only that paragraph and direct click catches its original',async({page})=>{
 await page.goto('/map');await ready(page);await page.getByRole('button',{name:'河流',exact:true}).click();const target=page.locator('.text-flow-hit:visible').nth(1);const id=await target.getAttribute('data-highlight-id');const initial=await target.boundingBox();if(initial===null)throw Error('Missing real river target');await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);await page.waitForTimeout(100);const rect=await target.boundingBox();const time=Number(await page.getByTestId('text-flow').getAttribute('data-flow-time'));await page.waitForTimeout(400);expect(await target.boundingBox()).toEqual(rect);expect(Number(await page.getByTestId('text-flow').getAttribute('data-flow-time'))).toBeGreaterThan(time);await target.click();await original(page,id??'');
});
test('a caught original survives automatic renewal while other text keeps moving in both forms',async({page})=>{
 await page.clock.install();await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');
 for(const label of ['河流','潮汐']){await page.getByRole('button',{name:label,exact:true}).click();const before=await page.getByTestId('text-flow').getAttribute('data-flow-ids');
 await page.clock.runFor(44000);await original(page,'h-3501');await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-held','h-3501');
 expect(Number(await page.getByTestId('text-flow').getAttribute('data-flow-time'))).toBeGreaterThan(40000);expect(await page.getByTestId('text-flow').getAttribute('data-flow-ids')).not.toBe(before);
 const ids=(await page.getByTestId('text-flow').getAttribute('data-flow-ids')??'').split(',');expect(new Set(ids).size).toBe(ids.length);expect(ids.every(id=>byId.has(id))).toBe(true);
 }
});
test('pause, live reduced motion, keyboard, longest text and cached measurement',async({page})=>{
 await page.goto('/map');await ready(page);await page.waitForTimeout(700);const prepares=await page.getByTestId('text-flow').getAttribute('data-flow-prepares');await page.waitForTimeout(700);expect(await page.getByTestId('text-flow').getAttribute('data-flow-prepares')).toBe(prepares);
 await page.getByRole('button',{name:'暂停流动',exact:true}).click();await page.waitForTimeout(100);const time=await page.getByTestId('text-flow').getAttribute('data-flow-time');await page.waitForTimeout(400);expect(await page.getByTestId('text-flow').getAttribute('data-flow-time')).toBe(time);
 await page.getByRole('button',{name:'继续流动',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-reduced','true');await page.waitForTimeout(100);const stopped=await page.getByTestId('text-flow').getAttribute('data-flow-time');await page.waitForTimeout(400);expect(await page.getByTestId('text-flow').getAttribute('data-flow-time')).toBe(stopped);
 await menu(page);const b=page.locator('.play-page-strip button').nth(2);await b.focus();await page.keyboard.press('Enter');await original(page,await b.getAttribute('data-highlight-id')??'');
 const longest=[...snapshot.highlights].sort((a,b)=>b.text.length-a.text.length)[0];if(longest===undefined)throw Error('Missing genuine longest');await page.setViewportSize({width:320,height:900});await page.goto(`/map?h=${longest.id}`);await ready(page);await original(page,longest.id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-reduced','false');
});
test('explicit model scope is exact, and actual topic/parent return remains honest',async({page,request})=>{
 const graph=await (await request.get('/__play_world_geometry')).json() as PlayWorldData;
 await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');const explore=page.getByRole('button',{name:'沿这处流一会儿',exact:false});await expect(explore).toBeEnabled();await explore.click();await expect(page).toHaveURL(/anchor=h-3501/);
 const ids=(await page.getByTestId('text-flow').getAttribute('data-flow-ids')??'').split(',');const pool=new Set(playNeighbours(graph,'h-3501',snapshot.highlights,16).map(h=>h.id));expect(ids.every(id=>pool.has(id))).toBe(true);await original(page,'h-3501');
 await page.getByRole('button',{name:'回到刚才的流',exact:false}).click();await expect(page).not.toHaveURL(/anchor=/);
 const gate=topicGates(snapshot.highlights,[])[0];if(gate===undefined)throw Error('No real gate');const tag=gate.tagIds[0];if(tag===undefined)throw Error('Missing tag');const title=snapshot.tags.find(t=>t.id===tag)?.title??'';
 await page.locator('.play-entrances summary').click();await page.locator('.play-entrances button').filter({hasText:title}).first().click();const selected=await page.locator('.play-original').getAttribute('data-play-reading-highlight');expect(topicMembers(snapshot.highlights,[tag]).some(h=>h.id===selected)).toBe(true);
 await page.getByRole('button',{name:'回到刚才的流',exact:false}).click();await original(page,'h-3501');
});
test('drag is not catch; keyboard focus holds a moving target until activation',async({page})=>{
 await page.goto('/map');await ready(page);const stage=page.getByTestId('text-flow');const target=page.locator('.text-flow-hit:visible').nth(1);const box=await target.boundingBox();if(box===null)throw Error('Missing real target');
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+60,box.y+20,{steps:5});await page.mouse.up();await expect(page.locator('.play-original')).toBeHidden();
 await target.focus();await expect(stage).toHaveAttribute('data-flow-paused','true');await page.waitForTimeout(100);const time=await stage.getAttribute('data-flow-time');await page.waitForTimeout(300);expect(await stage.getAttribute('data-flow-time')).toBe(time);
 const id=await target.getAttribute('data-highlight-id');await page.keyboard.press('Enter');await original(page,id??'');await expect(stage).toHaveAttribute('data-flow-paused','false');
});
test('water tide keeps an asymmetric composition and a stable reading centre across several catches',async({page})=>{
 await page.goto('/map');await ready(page);await page.getByRole('button',{name:'潮汐',exact:true}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-edition','water-shore-3');
 const coordinates=await page.locator('.text-flow-hit:visible').evaluateAll(buttons=>buttons.map(b=>Math.round(b.getBoundingClientRect().x)));expect(new Set(coordinates).size).toBe(7);
 await menu(page);for(const i of [1,3,5]){const button=page.locator('.play-page-strip button').nth(i);const id=await button.getAttribute('data-highlight-id');await button.click();await original(page,id??'');await expect(page.locator('.play-original')).toBeFocused();
 await expect.poll(async()=>Number(await page.getByTestId('text-flow').getAttribute('data-flow-visible'))).toBeGreaterThanOrEqual(2);
 const safe=await page.locator('.text-flow-hit:visible').evaluateAll(buttons=>buttons.every(b=>{const top=b.getBoundingClientRect().top;const caption=document.querySelector('.text-flow-caption')?.getBoundingClientRect();return caption===undefined||top>caption.bottom;}));expect(safe).toBe(true);
 await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.locator('.play-original')).toBeHidden();}
});
test('tide water withdrawal carries the same genuine passages outward before renewal',async({page},info)=>{
 await page.clock.install();await page.goto('/map');await ready(page);const stage=page.getByTestId('text-flow');await expect(stage).toHaveAttribute('data-flow-edition','water-shore-3');
 const measure=async(id:string|null)=>stage.evaluate((root,wanted)=>{const targets=Array.from(root.querySelectorAll<HTMLElement>('.text-flow-hit'));const target=wanted===null?targets.find(b=>getComputedStyle(b).visibility==='visible'):targets.find(b=>b.dataset.highlightId===wanted);if(target===undefined)throw Error('Missing genuine water target');return {id:target.dataset.highlightId??'',x:target.getBoundingClientRect().x,width:root.getBoundingClientRect().width,surge:Number((root as HTMLElement).dataset.waterSurge)};},id);
 const before=await measure(null);await page.clock.runFor(22000);await expect(stage).toHaveAttribute('data-water-phase','outgoing');const after=await measure(before.id);expect(after.surge).toBeLessThan(before.surge);
 expect(Math.abs(after.x-before.x-(before.surge-after.surge)*.58*before.width)).toBeLessThan(1);await stage.screenshot({path:`${evidence}/${info.project.name}-tide-outgoing.png`});
});
test('release visibly returns the caught passage, and reduced motion returns immediately',async({page})=>{
 await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning','h-3501');await expect(page.locator('.play-original')).toBeHidden();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning','',{timeout:5000});
 await page.emulateMedia({reducedMotion:'reduce'});await menu(page);const button=page.locator('.play-page-strip button').first();const id=await button.getAttribute('data-highlight-id');await button.click();await original(page,id??'');await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning','');
});
for(const width of [320,390])test(`long original has its own readable boundary and resets scrolling at ${width}`,async({page},info)=>{
 const longest=[...snapshot.highlights].sort((a,b)=>b.text.length-a.text.length)[0];if(longest===undefined)throw Error('No genuine long text');await page.setViewportSize({width,height:980});await page.goto(`/map?h=${longest.id}`);await ready(page);await original(page,longest.id);
 const article=page.locator('.play-original'),body=page.locator('.play-reading-body'),more=page.getByRole('button',{name:'继续向下阅读',exact:false});await expect(article).toHaveAttribute('data-reading-more','true');await expect(more).toBeVisible();
 const box=await article.boundingBox();if(box===null)throw Error('Missing reading bank');const overlap=await page.locator('.text-flow-hit:visible').evaluateAll((buttons,r)=>buttons.some(b=>{const v=b.getBoundingClientRect();return v.left<r.x+r.width&&v.right>r.x&&v.top<r.y+r.height&&v.bottom>r.y;}),box);expect(overlap).toBe(false);
 await more.click();await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await expect(article).toHaveAttribute('data-reading-above','true');const place=await body.evaluate(el=>el.scrollTop);await page.getByRole('button',{name:'河流',exact:true}).click();await ready(page);expect(await body.evaluate(el=>el.scrollTop)).toBe(place);await article.focus();await page.keyboard.press('End');await expect(article).toHaveAttribute('data-reading-more','false');await expect(page.locator('.play-reading-end')).toBeVisible();await expect(page.getByRole('button',{name:'放回流中',exact:false})).toBeInViewport();
 await menu(page);const b=page.locator(`.play-page-strip button:not([data-highlight-id="${longest.id}"])`).first();await b.click();await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBe(0);await expect(article).toHaveAttribute('data-reading-above','false');await page.getByTestId('text-flow').screenshot({path:`${evidence}/${info.project.name}-${width}-reading-boundary.png`});
});
test('a retained passage outside the four compact slots returns visibly without duplication',async({page})=>{
 await page.setViewportSize({width:390,height:980});await page.goto('/map');await ready(page);await menu(page);const target=page.locator('.play-page-strip button').nth(6),id=await target.getAttribute('data-highlight-id');if(id===null)throw Error('No real seventh passage');await target.click();await original(page,id);expect(await page.locator('.play-original').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning',id);await expect.poll(()=>page.locator('.text-flow-hit:visible').evaluateAll((buttons,wanted)=>buttons.some(b=>(b as HTMLElement).dataset.highlightId===wanted),id)).toBe(true);
 const ids=(await page.getByTestId('text-flow').getAttribute('data-flow-ids')??'').split(',');expect(ids.filter(h=>h===id)).toHaveLength(1);expect(ids.every(h=>byId.has(h))).toBe(true);
});
test('water and text submit on each browser frame, textures stay cached and catch has no ghost',async({page})=>{
 await page.goto('/map');await ready(page);const stage=page.getByTestId('text-flow');const samples=await stage.evaluate(async root=>{const read=()=>{const d=(root as HTMLElement).dataset;return {frames:Number(d.flowFrames),water:Number(d.flowWaterFrames),textures:Number(d.flowTextureBuilds)};};const before=read();let ticks=0;await new Promise<void>(resolve=>{const sample=()=>{if(++ticks===32)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);});return {before,after:read(),ticks};});
 expect(samples.after.frames-samples.before.frames).toBeGreaterThanOrEqual(samples.ticks-2);expect(samples.after.water-samples.before.water).toBe(samples.after.frames-samples.before.frames);expect(samples.after.textures).toBe(samples.before.textures);
 const sizes=await page.locator('.text-flow-hit:visible').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect()));expect(sizes.every(r=>r.height<=112&&r.height>=44)).toBe(true);
 const target=page.locator('.text-flow-hit:visible').nth(1),id=await target.getAttribute('data-highlight-id');await target.click();await original(page,id??'');await expect(stage).toHaveAttribute('data-flow-pickup','');await page.waitForTimeout(500);await expect(stage).toHaveAttribute('data-flow-pickup','');expect(await page.locator('.play-original').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('Canvas2D unavailable still permits complete genuine reading through native directory',async({page})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});await page.goto('/map?h=h-3501');await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','fallback');await original(page,'h-3501');await menu(page);const b=page.locator('.play-page-strip button').nth(1);await b.click();await original(page,await b.getAttribute('data-highlight-id')??'');
});
test('invalid model artifact never supplies fake relations and private endpoints stay read-only',async({page,request})=>{
 const response=await request.get('/__play_world_geometry');const data=await response.json() as Record<string,unknown>;await page.route('**/__play_world_geometry',route=>route.fulfill({json:{...data,vectors:[]}}));
 await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');await expect(page.getByRole('button',{name:'沿这处流一会儿',exact:false})).toBeDisabled();await expect(page.locator('.play-data-note')).toContainText('Invalid play-world contract');
 expect((await request.put('/__play_world_geometry',{data:{}})).status()).toBe(405);expect([403,404]).toContain((await request.get('/.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json')).status());
});
