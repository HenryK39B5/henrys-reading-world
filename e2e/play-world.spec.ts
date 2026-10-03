import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import type { Snapshot } from '../src/domain/types.ts';
import { topicGates, topicMembers } from '../src/domain/playWorld.ts';
const snapshot=JSON.parse(readFileSync('.private/local-snapshot.json','utf8')) as Snapshot;
const byId=new Map(snapshot.highlights.map(h=>[h.id,h]));
const anchor=byId.get('h-3501');if(anchor===undefined)throw Error('Frozen genuine anchor missing');
mkdirSync('.private/review/play-world',{recursive:true});
async function ready(page:Page){await expect(page.locator('.play-stage')).toHaveAttribute('data-play-renders',/^[1-9]\d*$/,{timeout:90_000});}
async function original(page:Page,id:string){await expect(page.locator('.play-reading')).toHaveAttribute('data-play-reading-highlight',id);await expect(page.locator('.play-original blockquote > p')).toHaveText(byId.get(id)?.text??'');}

for(const width of [1440,390])test(`two participation styles, three forms and real reading at ${width}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/map?h=h-3501');await ready(page);await original(page,'h-3501');
    await expect(page.locator('.play-stage canvas')).toHaveCount(1);
    await page.getByRole('button',{name:'走进世界',exact:true}).click();await expect(page.getByTestId('play-world')).toHaveAttribute('data-play-mode','travel');
    await page.locator('.play-echoes button').first().click();
    const selected=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(selected).not.toBeNull();await original(page,selected as string);
    expect(new URL(page.url()).searchParams.get('h')).toBe(selected);
    await page.getByRole('button',{name:'拨动世界',exact:true}).click();
    await page.getByText('变换世界的形状',{exact:true}).click();
    for(const [name,form] of [['焦点透镜','lens'],['展开曲面','fold'],['球中世界','globe']] as const){
        await page.getByRole('button',{name,exact:true}).click();await expect(page.getByTestId('play-world')).toHaveAttribute('data-play-form',form);await ready(page);await original(page,selected as string);
        await page.locator('.play-stage').screenshot({path:`.private/review/play-world/${testInfo.project.name}-${width}-${form}.png`});
    }
    await page.getByRole('button',{name:'停下来，读完整原文 ↗',exact:true}).click();await expect(page.locator('.play-original')).toBeFocused();
    await page.getByRole('button',{name:'分享',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(byId.get(selected as string)?.text??'');
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    const beforeBook=page.url();await page.getByRole('link',{name:'去这本书的书房',exact:true}).click();await expect(page).toHaveURL(/\/books\/b-/);await page.goBack();await ready(page);await original(page,selected as string);expect(page.url()).toBe(beforeBook);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);expect(await page.locator('button').count()).toBeLessThan(140);
});

test('recursive entry, browser Back, actual parent and refresh keep truthful scope',async({page})=>{
    await page.goto('/map?h=h-3501');await ready(page);
    const rootGates=topicGates(snapshot.highlights,[]);const root=rootGates.find(g=>topicGates(snapshot.highlights,[g.tagIds[0] as string]).length>0);if(root===undefined)throw Error('No actual recursive gate');
    const rootTag=root.tagIds[0] as string;const rootTitle=snapshot.tags.find(t=>t.id===rootTag)?.title??'';
    await page.locator('.play-entrances summary').click();await page.locator('.play-entrances button').filter({hasText:rootTitle}).first().click();await ready(page);
    const firstId=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(root.memberIds).toContain(firstId);await original(page,firstId as string);
    const child=topicGates(snapshot.highlights,[rootTag])[0];if(child===undefined)throw Error('Missing real child');const childTag=child.tagIds[0] as string;const childTitle=snapshot.tags.find(t=>t.id===childTag)?.title??'';
    await page.locator('.play-entrances button').filter({hasText:childTitle}).first().click();await ready(page);
    const childId=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(topicMembers(snapshot.highlights,[rootTag,childTag]).map(h=>h.id)).toContain(childId);
    await page.goBack();await ready(page);await original(page,firstId as string);expect(new URL(page.url()).searchParams.get('world')).toBe(rootTag);
    await page.getByRole('button',{name:'返回上一层世界',exact:false}).click();await ready(page);await original(page,'h-3501');expect(new URL(page.url()).searchParams.has('world')).toBe(false);
    await page.goto(`/map?h=${childId}&world=${rootTag},${childTag}`);await ready(page);await original(page,childId as string);await page.reload();await ready(page);await original(page,childId as string);
});

test('keyboard, live reduced motion, 200%-equivalent narrow layout and longest original',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:720,height:450});await page.goto('/map?h=h-3501');await ready(page);
    const stage=page.locator('.play-stage');await stage.focus();await page.keyboard.press('ArrowRight');await expect(stage).toBeFocused();
    await page.getByRole('button',{name:'走进世界',exact:true}).click();await stage.focus();await page.keyboard.press('ArrowRight');
    const longest=[...snapshot.highlights].sort((a,b)=>b.text.length-a.text.length)[0];if(longest===undefined)throw Error('Empty corpus');
    await page.goto(`/map?h=${longest.id}`);await ready(page);await original(page,longest.id);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'走进世界',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});
});

test('book arrival lights its real membership and survives ordinary room return',async({page})=>{
    await page.goto(`/map?book=${anchor.bookId}&h=${anchor.id}`);await ready(page);await original(page,anchor.id);
    await expect(page.locator('[data-play-lit-book]')).toHaveAttribute('data-play-lit-book',anchor.bookId);
    await page.getByRole('link',{name:'去这本书的书房',exact:true}).click();await page.goBack();await ready(page);await original(page,anchor.id);
});

test('read-only geometry endpoint rejects writes; private vectors are not served',async({request})=>{
    const response=await request.get('/__play_world_geometry');expect(response.ok()).toBe(true);const data=await response.json() as Record<string,unknown>;
    expect(Object.keys(data).sort()).toEqual(['ids','neighbours','positions','snapshotHash','version']);expect((data.ids as string[]).length).toBe(snapshot.highlights.length);
    expect((await request.put('/__play_world_geometry',{data:{}})).status()).toBe(405);
    const forbidden=await request.get('/.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json');expect([403,404]).toContain(forbidden.status());
});

test('unavailable WebGL has a real, usable reading/entry fallback',async({page})=>{
    await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args:Parameters<typeof original>){if(String(args[0]).startsWith('webgl'))return null;return original.apply(this,args);} as typeof original;});
    await page.goto('/map?h=h-3501');await expect(page.getByText('这个浏览器暂时无法绘制 3D。下方的原文和入口仍可完整阅读。')).toBeVisible();await original(page,'h-3501');
    await page.getByRole('button',{name:'再遇见一处',exact:true}).click();const next=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(byId.has(next??'')).toBe(true);await original(page,next as string);
});

test.describe('native touch entry',()=>{
    test.use({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
    test('tap a visible world and return without losing the genuine original',async({page})=>{
        await page.goto('/map?h=h-3501');await ready(page);
        await page.locator('.play-portal-label:visible').first().tap();await ready(page);
        const tags=(new URL(page.url()).searchParams.get('world')??'').split(',');
        const id=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(topicMembers(snapshot.highlights,tags).map(h=>h.id)).toContain(id);await original(page,id as string);
        await page.getByRole('button',{name:'返回上一层世界',exact:false}).tap();await ready(page);await original(page,'h-3501');
    });
});

test('lost and restored GPU context leaves the same genuine original readable',async({page})=>{
    await page.goto('/map?h=h-3501');await ready(page);
    const supported=await page.evaluate(()=>{
        const canvas=document.querySelector('.play-stage canvas') as HTMLCanvasElement;
        const gl=canvas.getContext('webgl2');const extension=gl?.getExtension('WEBGL_lose_context');
        if(extension===null||extension===undefined)return false;
        (window as unknown as {playLoss:WEBGL_lose_context}).playLoss=extension;extension.loseContext();return true;
    });
    test.skip(!supported,'This engine does not expose the test context-loss extension.');
    await expect(page.locator('.play-stage')).toHaveAttribute('data-play-context','lost');await original(page,'h-3501');
    await page.evaluate(()=>(window as unknown as {playLoss:WEBGL_lose_context}).playLoss.restoreContext());
    await expect(page.locator('.play-stage')).toHaveAttribute('data-play-context','ready',{timeout:90_000});await original(page,'h-3501');
});

test('unknown identities are honest and extra-vector payloads are rejected, not rendered',async({page})=>{
    await page.goto('/map?h=not-a-real-highlight');await ready(page);await expect(page.getByText('这处原文不在当前本机资料中；下面展示的是世界里的其他真实原文。')).toBeVisible();
    const real=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');expect(byId.has(real??'')).toBe(true);
    await page.route('**/__play_world_geometry',async route=>{const response=await route.fetch();const body=await response.json();await route.fulfill({response,json:{...body,vectors:[]}});});
    await page.reload();await expect(page.locator('.play-loading')).toContainText('Invalid play-world contract');await expect(page.locator('.play-stage canvas')).toHaveCount(0);
    const selected=await page.locator('.play-reading').getAttribute('data-play-reading-highlight');await original(page,selected as string);
});
