import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8').replaceAll('__BUILD_ID__','fixture-new');
function harness(fail=false){
 const events={},stores=new Map([['omniforge-shell-old',new Map([['/','old offline page']])]]);let skipped=0;
 const context={URL,Response,Promise,Error,self:{location:{origin:'https://app.test'},addEventListener:(type,handler)=>{events[type]=handler;},skipWaiting:async()=>{skipped++;},clients:{claim:async()=>{}}},fetch:async path=>new Response('fixture',{status:fail&&String(path).includes('/backup.js')?503:200}),caches:{open:async key=>{if(!stores.has(key))stores.set(key,new Map());return {put:async(url,response)=>stores.get(key)?.set(url,await response.text())};},delete:async key=>stores.delete(key),keys:async()=>[...stores.keys()]}};
 vm.runInNewContext(source,context);return {events,stores,skipped:()=>skipped};
}
test('Incomplete offline updates preserve the previous cache and do not activate',async()=>{
 const h=harness(true);let promise;h.events.install({waitUntil:p=>promise=p});await assert.rejects(promise,/Offline asset unavailable/);assert.equal(h.skipped(),0);assert.equal(h.stores.get('omniforge-shell-old').get('/'),'old offline page');assert.equal(h.stores.has('omniforge-shell-fixture-new'),false);
});
test('Complete updates cache the same versioned modules as the new page',async()=>{
 const h=harness();let promise;h.events.install({waitUntil:p=>promise=p});await promise;assert.equal(h.skipped(),1);assert.ok(h.stores.get('omniforge-shell-fixture-new').has('/src/backup.js?v=fixture-new'));assert.ok(h.stores.get('omniforge-shell-fixture-new').has('/src/core.js?v=fixture-new'));
});
test('API requests and credentials are never intercepted by the offline cache',()=>{
 const h=harness();let intercepted=false;h.events.fetch({request:{method:'GET',url:'https://app.test/api/admin/providers'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
});
