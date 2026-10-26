import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import type {Snapshot,MapLayout,MapContour} from '../src/domain/types.ts';
import {mapToScreen} from '../src/domain/map.ts';
import {indexSnapshot} from '../src/domain/snapshot.ts';
import {mapReadingWindow} from '../src/domain/mapReading.ts';
const original=JSON.parse(readFileSync('.private/local-snapshot.json','utf8')) as Snapshot;
const selected=JSON.parse(readFileSync('.private/research/map/coordinate-polish/selected-local.json','utf8')) as {map:MapLayout;terrain:{pointsHash:string;contours:MapContour[]}};
const snapshot={...original,map:selected.map},index=indexSnapshot(snapshot);
const evidence=process.env.MAP_POLISH_EVIDENCE??'.private/review/map-coordinate-polish/first';mkdirSync(evidence,{recursive:true});
for(const width of [1440,390,320])test(`new geography keeps zoom, originals, compare, detail and return at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/map');const canvas=page.getByTestId('map-canvas');await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study','ready');await expect(canvas).toBeVisible();
 await page.screenshot({path:`${evidence}/${info.project.name}-${width}-world.png`,fullPage:false});
 const anchor=selected.map.points.find(p=>p.highlightId==='h-4648')!;
 await page.evaluate(({x,y})=>sessionStorage.setItem('reading-world:map:world-view:v1',JSON.stringify({centerX:x,centerY:y,zoom:3.4})),anchor);
 await page.reload();await expect(canvas).toHaveAttribute('data-map-zoom','3.400');await canvas.scrollIntoViewIfNeeded();await canvas.focus();await canvas.press('+');await expect(page.getByTestId('map-reading-window')).toBeVisible();
 const box=await canvas.boundingBox();if(!box)throw Error('Missing map canvas');
 const view={centerX:Number(await canvas.getAttribute('data-map-center-x')),centerY:Number(await canvas.getAttribute('data-map-center-y')),zoom:Number(await canvas.getAttribute('data-map-zoom')),scaleBasis:Number(await canvas.getAttribute('data-map-scale-basis'))};
 const first=mapReadingWindow(index,view,box.width,box.height).entries[0];if(!first)throw Error('Expected genuine local originals');
 await expect(page.locator('.map-reading-window > .map-reading-passage p')).toHaveText(first.highlight.text);
 const choice=page.locator('.map-reading-books > li > button').first();await expect(choice).toBeVisible();await choice.click();await expect(page.getByTestId('map-reading-comparison')).toBeVisible();
 const compared=await canvas.getAttribute('data-map-compare-highlight');expect(snapshot.highlights.some(h=>h.id===compared)).toBe(true);
 const comparisonText=await page.getByTestId('map-reading-comparison').locator('.map-reading-passage p').innerText();expect(snapshot.highlights.find(h=>h.id===compared)?.text).toBe(comparisonText);
 await page.screenshot({path:`${evidence}/${info.project.name}-${width}-reading.png`,fullPage:false});
 await page.getByTestId('map-reading-comparison').locator('a.map-reading-focus').click();await expect(page.locator('.map-detail-passage')).toHaveText(comparisonText);
 await page.getByRole('link',{name:'关闭划线详情，返回地图'}).click();await expect(canvas).toHaveAttribute('data-map-compare-highlight',compared!);await expect(page.getByTestId('map-reading-comparison')).toBeVisible();
 await page.reload();await expect(canvas).toBeVisible();await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study','ready');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});
for(const width of [1440,390])test(`actual contour and passage hover survive the new geography at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/map');const canvas=page.getByTestId('map-canvas');await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study','ready');await canvas.scrollIntoViewIfNeeded();
 const box=await canvas.boundingBox();if(!box)throw Error('Missing canvas');
 const view={centerX:Number(await canvas.getAttribute('data-map-center-x')),centerY:Number(await canvas.getAttribute('data-map-center-y')),zoom:Number(await canvas.getAttribute('data-map-zoom')),scaleBasis:Number(await canvas.getAttribute('data-map-scale-basis'))};
 const midpoints=selected.terrain.contours.flatMap(c=>c.segments).map(s=>mapToScreen({x:(s[0]!+s[2]!)/2,y:(s[1]!+s[3]!)/2},view,box.width,box.height)).filter(p=>p.x>30&&p.x<box.width-30&&p.y>30&&p.y<box.height-30);
 let hit=false;for(const p of midpoints.slice(0,60)){await page.mouse.move(box.x+p.x,box.y+p.y);if(await canvas.getAttribute('data-map-hover-contour')!==null){hit=true;break;}}expect(hit).toBe(true);
 const anchor=selected.map.points.find(p=>p.highlightId==='h-4648')!;await page.evaluate(({x,y})=>sessionStorage.setItem('reading-world:map:world-view:v1',JSON.stringify({centerX:x,centerY:y,zoom:4.2})),anchor);await page.reload();await expect(canvas).toHaveAttribute('data-map-zoom','4.200');await expect(page.locator('.map-canvas-wrap')).toHaveAttribute('data-map-study','ready');await canvas.scrollIntoViewIfNeeded();
 const close=await canvas.boundingBox();if(!close)throw Error('Missing close canvas');const closeView={...view,centerX:anchor.x,centerY:anchor.y,zoom:4.2,scaleBasis:Number(await canvas.getAttribute('data-map-scale-basis'))};
 const positions=selected.map.points.map(p=>mapToScreen(p,closeView,close.width,close.height)).filter(p=>p.x>30&&p.x<close.width-30&&p.y>30&&p.y<close.height-30);
 let id:string|null=null;for(const p of positions.slice(0,60)){await page.mouse.move(close.x+p.x,close.y+p.y);id=await canvas.getAttribute('data-map-hover-point');if(id!==null)break;}expect(snapshot.highlights.some(h=>h.id===id)).toBe(true);await expect(page.locator('.map-hover-readout')).not.toBeEmpty();
});
test('candidate serves unchanged originals and matching terrain, never accepts writes',async({request})=>{
 const response=await request.get('/__local_snapshot');expect(response.status()).toBe(200);const served=await response.json() as Snapshot;
 expect(served.map).toEqual(selected.map);expect(served.highlights).toEqual(original.highlights);expect(served.books).toEqual(original.books);expect(served.tags).toEqual(original.tags);
 const terrain=await request.get('/__local_map_terrain');expect(terrain.status()).toBe(200);expect((await terrain.json() as {pointsHash:string}).pointsHash).toBe(selected.terrain.pointsHash);
 expect((await request.post('/__local_snapshot',{data:{}})).status()).toBe(405);expect((await request.post('/__local_map_terrain',{data:{}})).status()).toBe(405);
 expect((await request.get('/.private/research/map/coordinate-polish/selected-local.json')).status()).toBe(403);
});
test('reduced motion deep-link uses actual new point, full original and all tags',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const h=snapshot.highlights.find(h=>h.id==='h-4504')!,p=selected.map.points.find(p=>p.highlightId===h.id)!;
 await page.goto('/map?h='+h.id);await expect(page.locator('.map-detail-passage')).toHaveText(h.text);const canvas=page.getByTestId('map-canvas');
 await expect(canvas).toHaveAttribute('data-map-center-x',String(p.x));await expect(canvas).toHaveAttribute('data-map-center-y',String(p.y));
 for(const tagId of h.tagIds){const title=snapshot.tags.find(t=>t.id===tagId)!.title;await expect(page.locator('.map-detail').getByText('#'+title,{exact:true})).toBeVisible();}
 await page.screenshot({path:`${evidence}/${info.project.name}-390-detail.png`,fullPage:false});await page.getByRole('link',{name:'关闭划线详情，返回地图'}).click();await expect(canvas).toHaveAttribute('data-map-reading-highlight',h.id);
});
