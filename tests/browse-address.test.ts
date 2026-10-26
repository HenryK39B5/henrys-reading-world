import {describe,it,expect} from 'vitest';
import {browseAddress,readBrowseContext} from '../src/features/play/browseAddress.ts';
import {shoreline,tideClarity} from '../src/features/play/waterWorld.ts';
describe('encounter forms and shoreline revelation',()=>{
 it('keeps stable identity, actual scope and anchor in a root Pages URL',()=>{
  const input={form:'river' as const,highlightId:'h-3501',worldTags:['tag-001','tag-002'],playAnchorId:'h-231',browseBookId:null};
  const address=browseAddress(input);expect(address.startsWith('/?')).toBe(true);
  const params=new URLSearchParams(address.slice(2));expect(params.get('h')).toBe(input.highlightId);
  expect(readBrowseContext(params)).toEqual({form:'river',worldTags:input.worldTags,playAnchorId:'h-231'});
  expect(browseAddress({highlightId:null})).toBe('/');
 });
 it('ignores unknown forms and malformed, repeated or excessive tags',()=>{
  expect(readBrowseContext(new URLSearchParams('view=map&world=tag-001,tag-001,bogus,tag-002,tag-003,tag-004'))).toEqual({worldTags:['tag-001','tag-002','tag-003']});
 });
 it('reveals near shore and submerges farther out, using the painted shoreline',()=>{
  for(const y of [.2,.5,.8])for(const surge of [0,.3,1]){
   const shore=shoreline(y,surge);
   expect(tideClarity(shore,y,surge)).toBe(1);
   expect(tideClarity(shore+.2,y,surge)).toBeGreaterThan(tideClarity(shore+.5,y,surge));
   expect(tideClarity(shore+.8,y,surge)).toBe(0);
  }
  expect(tideClarity(.5,.3,0)).not.toBe(tideClarity(.5,.3,1));
 });
 it('reduced motion reveals the complete preview and rejects invalid depth',()=>{
  expect(tideClarity(.99,.2,1,true)).toBe(1);
  expect(()=>tideClarity(NaN,.2,1)).toThrow();
 });
});
