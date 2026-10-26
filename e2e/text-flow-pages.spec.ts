import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import type {Snapshot} from '../src/domain/types.ts';
const snapshot=JSON.parse(readFileSync('src/data/public-snapshot.json','utf8')) as Snapshot;const anchor=snapshot.highlights.find(h=>h.id==='h-3501')??snapshot.highlights[0];if(anchor===undefined)throw Error('Approved genuine input missing');
const evidence=process.env.TEXT_FLOW_EVIDENCE??'.private/review/text-flow/static';
mkdirSync(evidence,{recursive:true});
for(const width of [1440,390])test(`both text forms work in static Pages subpath at ${width}`,async({page,request},info)=>{
 await page.setViewportSize({width,height:980});const errors:string[]=[],requests:string[]=[],failed:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 await page.goto(`/henrys-reading-world/?view=tide&h=${anchor.id}`);await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','ready');await expect(page.locator('.play-original blockquote > p')).toHaveText(anchor.text);
 await expect(page.getByRole('button',{name:'沿这处流一会儿',exact:false})).toHaveCount(0);
 for(const label of ['一句一句','河流','潮汐']){await page.getByRole('button',{name:label,exact:true}).click();await expect(label==='一句一句'?page.getByTestId('stage-passage'):page.locator('.play-original blockquote > p')).toHaveText(anchor.text);}
 await page.locator('.play-page-menu summary').click();const b=page.locator('.play-page-strip button').nth(1);const id=await b.getAttribute('data-highlight-id');await b.click();const real=snapshot.highlights.find(h=>h.id===id);expect(real).toBeDefined();await expect(page.locator('.play-original blockquote > p')).toHaveText(real?.text??'');expect(new URL(page.url()).pathname).toBe('/henrys-reading-world/');
 await page.reload();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','ready');await expect(page.locator('.play-original blockquote > p')).toHaveText(real?.text??'');const address=page.url();
 await page.getByRole('link',{name:'去这本书',exact:true}).click();await expect(page).toHaveURL(/\/henrys-reading-world\/books\/b-.*\/$/);await page.goBack();await expect(page.getByTestId('text-flow')).toHaveAttribute('data-flow-state','ready');expect(page.url()).toBe(address);
 await page.getByRole('button',{name:'分享',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(real?.text??'');await page.keyboard.press('Escape');await page.getByRole('button',{name:'放回流中',exact:false}).click();
 await page.getByTestId('text-flow').screenshot({path:`${evidence}/${info.project.name}-${width}.png`});
 expect(requests.some(url=>url.includes('/__'))).toBe(false);expect(requests.every(url=>new URL(url).origin==='http://127.0.0.1:5316')).toBe(true);expect(failed).toEqual([]);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 expect((await request.get('/__local_snapshot')).status()).toBe(404);expect((await request.get('/__play_world_geometry')).status()).toBe(404);expect((await request.get('/henrys-reading-world/map/')).status()).toBe(200);
});
