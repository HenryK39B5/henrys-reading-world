import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import type { Snapshot } from '../src/domain/types.ts';
import { topicGates, topicMembers } from '../src/domain/playWorld.ts';
const snapshot=JSON.parse(readFileSync('.private/local-snapshot.json','utf8')) as Snapshot;
const byId=new Map(snapshot.highlights.map(h=>[h.id,h]));
const anchor=byId.get('h-3501');if(anchor===undefined)throw Error('Frozen genuine anchor missing');
mkdirSync('.private/review/twilight-garden',{recursive:true});
async function menu(page:Page){const details=page.locator('.play-page-menu');if(await details.getAttribute('open')===null)await details.locator('summary').click();}
async function ready(page:Page){await expect(page.getByTestId('play-world')).toHaveAttribute('data-play-data','ready');await expect(page.locator('.play-stage')).toHaveAttribute('data-play-context','ready',{timeout:90_000});}
async function original(page:Page,id:string){await expect(page.locator('.play-original')).toHaveAttribute('data-play-reading-highlight',id);await expect(page.locator('.play-original blockquote > p')).toHaveText(byId.get(id)?.text??'');}
async function ids(page:Page){return page.locator('.play-page-strip button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('data-highlight-id')));}

for(const width of [1440,390])test(`one-action reading, stable scene and explicit continuation at ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');
    await expect(page.locator('.play-stage')).toHaveAttribute('data-play-form','garden');
    await expect(page.locator('.play-book-label')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'走进世界',exact:true})).toHaveCount(0);
    await expect(page.getByText('变换世界的形状',{exact:true})).toHaveCount(0);
    const before=await ids(page);const camera=await page.locator('.play-stage').getAttribute('data-play-camera');
    await page.evaluate(()=>{(window as unknown as {sceneCanvas:HTMLCanvasElement|null}).sceneCanvas=document.querySelector('.play-stage canvas');});
    await menu(page);await page.locator('.play-page-strip button').nth(1).click();
    const selected=await page.locator('.play-original').getAttribute('data-play-reading-highlight');expect(selected).not.toBe('h-3501');await original(page,selected as string);
    expect(await ids(page)).toEqual(before);expect(await page.locator('.play-stage').getAttribute('data-play-camera')).toBe(camera);
    expect(new URL(page.url()).searchParams.get('h')).toBe(selected);expect(new URL(page.url()).searchParams.get('anchor')).toBe('h-3501');
    await expect(page.getByRole('button',{name:'从这页继续',exact:false})).toBeEnabled();await page.getByRole('button',{name:'从这页继续',exact:false}).click();
    expect(new URL(page.url()).searchParams.get('anchor')).toBe(selected);await original(page,selected as string);expect((await ids(page))[0]).toBe(selected);
    expect(await page.evaluate(()=>document.querySelector('.play-stage canvas')===(window as unknown as {sceneCanvas:HTMLCanvasElement|null}).sceneCanvas)).toBe(true);
    await page.getByRole('button',{name:'分享',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(byId.get(selected as string)?.text??'');await page.keyboard.press('Escape');
    const beforeBook=page.url();await page.getByRole('link',{name:'去这本书',exact:true}).click();await expect(page).toHaveURL(/\/books\/b-/);await page.goBack();await ready(page);await original(page,selected as string);expect(page.url()).toBe(beforeBook);
    await page.locator('.play-stage').screenshot({path:`.private/review/twilight-garden/final-${info.project.name}-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);expect(await page.locator('button').count()).toBeLessThan(140);
});

test('actual topic intersections, parent return, Back and refresh retain original identities',async({page})=>{
    await page.goto('/map?h=h-3501');await ready(page);
    const gate=topicGates(snapshot.highlights,[]).find(g=>topicGates(snapshot.highlights,[g.tagIds[0] as string]).length>0);if(gate===undefined)throw Error('No real recursive gate');
    const tag=gate.tagIds[0] as string;const title=snapshot.tags.find(t=>t.id===tag)?.title??'';
    await page.locator('.play-entrances summary').click();await page.locator('.play-entrances button').filter({hasText:title}).first().click();await ready(page);
    const parent=page.url();const parentId=await page.locator('.play-original').getAttribute('data-play-reading-highlight');expect(gate.memberIds).toContain(parentId);
    const child=topicGates(snapshot.highlights,[tag])[0];if(child===undefined)throw Error('No real child');const childTag=child.tagIds[0] as string;const childTitle=snapshot.tags.find(t=>t.id===childTag)?.title??'';
    await page.locator('.play-entrances button').filter({hasText:childTitle}).first().click();await ready(page);
    const childId=await page.locator('.play-original').getAttribute('data-play-reading-highlight');expect(topicMembers(snapshot.highlights,[tag,childTag]).map(h=>h.id)).toContain(childId);
    await page.goBack();await ready(page);expect(page.url()).toBe(parent);await original(page,parentId as string);
    await page.getByRole('button',{name:'返回上一片',exact:false}).click();await ready(page);await original(page,'h-3501');
    await page.goto(`/map?h=${childId}&world=${tag},${childTag}&anchor=${childId}`);await ready(page);await page.reload();await ready(page);await original(page,childId as string);
});

test('keyboard page selection, dynamic reduced motion, 320 and longest real text',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:720,height:450});await page.goto('/map?h=h-3501');await ready(page);
    await menu(page);const first=page.locator('.play-page-strip button').nth(1);await first.focus();await page.keyboard.press('Enter');const id=await first.getAttribute('data-highlight-id');await original(page,id as string);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.play-page-strip button').nth(2).click();await page.emulateMedia({reducedMotion:'reduce'});
    const longest=[...snapshot.highlights].sort((a,b)=>b.text.length-a.text.length)[0];if(longest===undefined)throw Error('No real longest passage');
    await page.goto(`/map?h=${longest.id}`);await ready(page);await original(page,longest.id);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.reload();await ready(page);await original(page,longest.id);
});

test('canvas drag is not a new camera or a content-selection mode; idle rendering settles',async({page})=>{
    await page.goto('/map?h=h-3501');await ready(page);await page.waitForTimeout(1800);
    const camera=await page.locator('.play-stage').getAttribute('data-play-camera');const bounds=await page.locator('.play-stage canvas').boundingBox();if(bounds===null)throw Error('No canvas');
    await page.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.5,{steps:5});await page.mouse.up();
    await original(page,'h-3501');expect(await page.locator('.play-stage').getAttribute('data-play-camera')).toBe(camera);
    await page.mouse.move(0,0);await page.waitForTimeout(1500);const renders=await page.locator('.play-stage').getAttribute('data-play-renders');await page.waitForTimeout(1000);expect(await page.locator('.play-stage').getAttribute('data-play-renders')).toBe(renders);
});

test('read-only local artifact and unavailable GPU both keep genuine reading',async({page,request})=>{
    const data=await request.get('/__play_world_geometry');expect(data.ok()).toBe(true);expect(Object.keys(await data.json()).sort()).toEqual(['ids','neighbours','positions','snapshotHash','version']);
    expect((await request.put('/__play_world_geometry',{data:{}})).status()).toBe(405);
    expect([403,404]).toContain((await request.get('/.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json')).status());
    await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args:Parameters<typeof original>){if(String(args[0]).startsWith('webgl'))return null;return original.apply(this,args);} as typeof original;});
    await page.goto('/map?h=h-3501');await expect(page.locator('.play-stage')).toHaveAttribute('data-play-context','fallback');await original(page,'h-3501');
    await menu(page);await page.locator('.play-page-strip button').nth(1).click();const selected=await page.locator('.play-original').getAttribute('data-play-reading-highlight');await original(page,selected as string);
});

test('direct architectural entrance picking opens its exact original without moving the camera or anchor',async({page})=>{
    await page.setViewportSize({width:1440,height:900});const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('/map?h=h-3501');await ready(page);await page.waitForTimeout(900);
    const expected=await page.locator('.play-page-strip button').nth(1).getAttribute('data-highlight-id');
    const camera=await page.locator('.play-stage').getAttribute('data-play-camera');const box=await page.locator('.play-stage canvas').boundingBox();if(box===null)throw Error('Missing garden canvas');
    const target=await page.locator('.play-garden-entrance').nth(1).evaluate(e=>({x:Number((e as HTMLElement).dataset.pickX),y:Number((e as HTMLElement).dataset.pickY)}));
    await page.locator('.play-garden-entrance').evaluateAll(nodes=>nodes.forEach(n=>{(n as HTMLElement).style.pointerEvents='none';}));
    await page.mouse.click(box.x+target.x,box.y+target.y);
    await original(page,expected as string);expect(new URL(page.url()).searchParams.get('anchor')).toBe('h-3501');
    expect(await page.locator('.play-stage').getAttribute('data-play-camera')).toBe(camera);expect(errors).toEqual([]);
});

test('bounded garden responses, live reduced motion and repeated picks retain bounded GPU resources',async({page})=>{
    await page.setViewportSize({width:1440,height:900});await page.goto('/map?h=h-3501');await ready(page);await page.waitForTimeout(1500);
    const geometry=await page.locator('.play-stage').getAttribute('data-play-geometries');const textures=await page.locator('.play-stage').getAttribute('data-play-textures');
    await menu(page);for(let i=0;i<10;i++){await page.locator('.play-page-strip button').nth(1+i%2).click();}
    await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.play-stage')).toHaveAttribute('data-play-reduced','true');
    await page.waitForTimeout(300);const frames=await page.locator('.play-stage').getAttribute('data-play-renders');await page.waitForTimeout(600);
    expect(await page.locator('.play-stage').getAttribute('data-play-renders')).toBe(frames);
    expect(await page.locator('.play-stage').getAttribute('data-play-geometries')).toBe(geometry);expect(await page.locator('.play-stage').getAttribute('data-play-textures')).toBe(textures);
    await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('.play-stage')).toHaveAttribute('data-play-reduced','false');
});

test.describe('native touch',()=>{
    test.use({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
    test('tap a garden entrance to read, explicitly continue and return from its source',async({page})=>{
        await page.goto('/map?h=h-3501');await ready(page);
        await page.locator('.play-garden-entrance').nth(1).tap();const selected=await page.locator('.play-original').getAttribute('data-play-reading-highlight');await original(page,selected as string);
        expect(new URL(page.url()).searchParams.get('anchor')).toBe('h-3501');await page.getByRole('button',{name:'从这页继续',exact:false}).tap();await original(page,selected as string);
        await page.getByRole('link',{name:'去这本书',exact:true}).tap();await page.goBack();await ready(page);await original(page,selected as string);
    });
});

test('GPU loss and restoration preserve the selected original and rebuild the scene',async({page})=>{
    await page.goto('/map?h=h-3501');await ready(page);
    const supported=await page.evaluate(()=>{const canvas=document.querySelector('.play-stage canvas') as HTMLCanvasElement;const extension=canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');if(!extension)return false;(window as unknown as {playLoss:WEBGL_lose_context}).playLoss=extension;extension.loseContext();return true;});
    test.skip(!supported,'Engine does not expose context-loss test extension.');await expect(page.locator('.play-stage')).toHaveAttribute('data-play-context','lost');await original(page,'h-3501');
    await page.evaluate(()=>(window as unknown as {playLoss:WEBGL_lose_context}).playLoss.restoreContext());await ready(page);await original(page,'h-3501');
});

test('the scene is playable before reading: direct sunlight and bridge gestures preserve actual content',async({page},info)=>{
    await page.goto('/map');await ready(page);await expect(page.locator('.play-original')).toBeHidden();
    const selected=await page.locator('.play-original').getAttribute('data-play-reading-highlight');const before=await ids(page);const address=page.url();
    const camera=await page.locator('.play-stage').getAttribute('data-play-camera');const box=await page.locator('.play-stage canvas').boundingBox();if(box===null)throw Error('No garden');
    const sun=await page.locator('.play-stage').evaluate(e=>({x:Number((e as HTMLElement).dataset.playSunX),y:Number((e as HTMLElement).dataset.playSunY)}));
    await page.mouse.move(box.x+sun.x,box.y+sun.y);await page.mouse.down();await page.mouse.move(box.x+sun.x+box.width*.18,box.y+sun.y,{steps:8});await page.mouse.up();
    await expect.poll(async()=>Number(await page.getByRole('slider',{name:'光的方向'}).inputValue())).toBeGreaterThan(40);
    const lever=await page.locator('.play-stage').evaluate(e=>({x:Number((e as HTMLElement).dataset.playSwitchX),y:Number((e as HTMLElement).dataset.playSwitchY)}));
    await page.mouse.click(box.x+lever.x,box.y+lever.y);await expect(page.getByRole('button',{name:'让桥落下'})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.play-stage')).toHaveAttribute('data-play-bridge','1.000');
    expect(await ids(page)).toEqual(before);expect(page.url()).toBe(address);expect(await page.locator('.play-stage').getAttribute('data-play-camera')).toBe(camera);
    await page.getByRole('button',{name:'读一处',exact:false}).click();await original(page,selected as string);
    await page.getByRole('button',{name:'收起阅读',exact:false}).click();await expect(page.locator('.play-original')).toBeHidden();
    await expect(page.getByRole('button',{name:'读一处',exact:false})).toBeFocused();
    await page.getByRole('slider',{name:'光的方向'}).focus();await page.keyboard.press('Home');await expect(page.locator('.play-stage')).toHaveAttribute('data-play-light','0.000');
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'让桥落下'}).click();await expect(page.locator('.play-stage')).toHaveAttribute('data-play-bridge','0.000');
    await page.locator('.play-stage').screenshot({path:`.private/review/twilight-garden/played-${info.project.name}.png`});
    await page.mouse.move(0,0);await page.waitForTimeout(1000);const frames=await page.locator('.play-stage').getAttribute('data-play-renders');await page.waitForTimeout(700);
    expect(await page.locator('.play-stage').getAttribute('data-play-renders')).toBe(frames);
});

test('narrow scene presents three separated real entrances, with the complete menu as its native alternative',async({page})=>{
    await page.setViewportSize({width:320,height:900});await page.goto('/map?h=h-3501');await ready(page);
    await expect(page.locator('.play-stage')).toHaveAttribute('data-play-entrances','3');
    const bounds=await page.locator('.play-garden-entrance').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    expect(bounds).toHaveLength(3);for(const r of bounds){expect(r.w).toBeGreaterThanOrEqual(43.99);expect(r.h).toBeGreaterThanOrEqual(43.99);}
    for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];if(a===undefined||b===undefined)throw Error('No bounds');expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);}
    await menu(page);await expect(page.locator('.play-page-strip button')).toHaveCount(7);
    await page.locator('.play-page-strip button').last().click();const id=await page.locator('.play-page-strip button').last().getAttribute('data-highlight-id');await original(page,id as string);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('unknown / outside-scope requests are honest; invalid relations degrade to labelled encounters',async({page})=>{
    await page.goto('/map?h=not-a-real-highlight');await ready(page);await expect(page.getByText('这处原文不在当前资料中；下面是其他真实书页。')).toBeVisible();
    const tag=snapshot.tags.find(t=>!anchor.tagIds.includes(t.id));if(tag===undefined)throw Error('No actual counterexample tag');
    await page.goto(`/map?h=${anchor.id}&world=${tag.id}`);await ready(page);await expect(page.getByText('请求的原文不属于这一片主题。')).toBeVisible();await page.getByRole('button',{name:'打开请求的原文'}).click();await original(page,anchor.id);
    await page.route('**/__play_world_geometry',async route=>{const response=await route.fetch();const body=await response.json();await route.fulfill({response,json:{...body,vectors:[]}});});
    await page.reload();await ready(page);await expect(page.getByRole('status')).toContainText('Invalid play-world contract');
    expect(await page.locator('.play-page-strip .play-page-kind').allTextContents()).not.toContain('联想候选');await original(page,anchor.id);
});
