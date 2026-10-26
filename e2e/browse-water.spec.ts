import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import type {Snapshot} from '../src/domain/types.ts';
import {topicMembers} from '../src/domain/playWorld.ts';
const snapshot=JSON.parse(readFileSync('.private/local-snapshot.json','utf8')) as Snapshot;
const evidence=process.env.TEXT_FLOW_EVIDENCE??'.private/review/browse-water/final';
mkdirSync(evidence,{recursive:true});
for(const width of [1440,390])test(`encounter forms preserve identity, original, scope and real map at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:980});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'一句一句',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('browse-single')).toBeVisible();await expect(page.getByTestId('text-flow')).toHaveCount(0);
 const text=await page.getByTestId('stage-passage').innerText();expect(snapshot.highlights.some(h=>h.text===text)).toBe(true);
 await expect(page).toHaveURL(/h=/);const first=snapshot.highlights.find(h=>h.id===new URL(page.url()).searchParams.get('h'));if(first===undefined)throw Error('Missing real original');
 await page.getByRole('button',{name:'河流',exact:true}).click();await expect(page.locator('.play-original blockquote > p')).toHaveText(first.text);
 await page.getByRole('button',{name:'潮汐',exact:true}).click();await expect(page.locator('.play-original')).toHaveAttribute('data-play-reading-highlight',first.id);
 await page.getByRole('button',{name:'一句一句',exact:true}).click();await expect(page.getByTestId('stage-passage')).toHaveText(first.text);
 await expect(page.locator('.browse-single .stage')).toHaveAttribute('data-phase','idle');await page.getByTestId('browse-single').screenshot({path:`${evidence}/${info.project.name}-${width}-single.png`});
 const next=page.locator('.browse-single .stage-actions button').first();await next.click();await expect(page.getByTestId('stage-passage')).not.toHaveText(first.text);await expect(page.locator('.browse-single .stage')).toHaveAttribute('data-phase','idle');
 const second=await page.getByTestId('stage-passage').innerText();
 await page.getByRole('button',{name:'潮汐',exact:true}).click();await expect(page.locator('.play-original blockquote > p')).toHaveText(second);
 const before=page.url();await page.getByRole('link',{name:'去这本书',exact:true}).click();await expect(page).toHaveURL(/\/books\/b-/);await page.goBack();await expect(page.locator('.play-original blockquote > p')).toHaveText(second);expect(page.url()).toBe(before);
 await page.getByRole('button',{name:'一句一句',exact:true}).click();await expect(page.getByTestId('stage-passage')).toHaveText(second);await expect(page.locator('.browse-single .stage')).toHaveAttribute('data-commit-count','1');
 await page.getByTestId('nav-map').click();await expect(page).toHaveURL(/\/map$/);await expect(page.getByTestId('text-flow')).toHaveCount(0);await expect(page.locator('[data-room="map"]')).toBeVisible();await expect(page.getByTestId('map-canvas')).toBeVisible();
 await page.screenshot({path:`${evidence}/${info.project.name}-${width}-real-map.png`});
 await page.getByTestId('nav-books').click();await expect(page.getByRole('navigation',{name:'书架浏览方式'})).toBeVisible();await page.getByRole('link',{name:'按书籍主题',exact:true}).click();await expect(page).toHaveURL(/\/themes$/);await expect(page.getByTestId('nav-books')).toHaveAttribute('aria-current','page');
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('scope survives single draws, all three forms and a reload',async({page})=>{
 const tag=snapshot.tags.find(t=>topicMembers(snapshot.highlights,[t.id]).length>20);if(tag===undefined)throw Error('No genuine scope');
 const members=topicMembers(snapshot.highlights,[tag.id]);const first=members[0];if(first===undefined)throw Error('No genuine member');
 await page.goto(`/?view=tide&world=${tag.id}&h=${first.id}`);
 await expect(page.locator('.play-original blockquote > p')).toHaveText(first.text);
 await page.getByRole('button',{name:'一句一句',exact:true}).click();await expect(page.getByTestId('stage-passage')).toHaveText(first.text);
 for(let i=0;i<3;i++){await page.locator('.browse-single .stage-actions button').first().click();await expect(page.locator('.browse-single .stage')).toHaveAttribute('data-phase','idle');const text=await page.getByTestId('stage-passage').innerText();expect(members.some(h=>h.text===text)).toBe(true);}
 const text=await page.getByTestId('stage-passage').innerText();await page.getByRole('button',{name:'河流',exact:true}).click();await expect(page).toHaveURL(new RegExp('world='+tag.id));await expect(page.locator('.play-original blockquote > p')).toHaveText(text);await page.reload();await expect(page.locator('.play-original blockquote > p')).toHaveText(text);
});
for(const width of [1440,390])test(`paused tide catch and release never relocate other passages at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:980});await page.goto('/?view=tide');await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','ready');
 await page.getByRole('button',{name:'暂停流动',exact:true}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-paused','true');
 const poses=()=>page.locator('.text-flow-hit').evaluateAll(buttons=>buttons.map(b=>({id:(b as HTMLElement).dataset.highlightId,transform:(b as HTMLElement).style.transform,width:(b as HTMLElement).style.width,height:(b as HTMLElement).style.height})));
 const before=await poses();if(width===390)await page.locator('.play-page-menu summary').click();const target=width===390?page.locator('.play-page-strip button').nth(6):page.locator('.text-flow-hit:visible').nth(1),id=await target.getAttribute('data-highlight-id');await target.click();await expect(page.locator('.play-original')).toBeVisible();
 expect((await poses()).filter(p=>p.id!==id)).toEqual(before.filter(p=>p.id!==id));
 await page.getByTestId('text-flow').screenshot({path:`${evidence}/${info.project.name}-${width}-fixed-tide-held.png`});
 await page.getByRole('button',{name:'放回流中',exact:false}).click();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-returning','');
 expect((await poses()).filter(p=>p.id!==id)).toEqual(before.filter(p=>p.id!==id));
 await page.getByTestId('text-flow').screenshot({path:`${evidence}/${info.project.name}-${width}-fixed-tide-released.png`});
});
