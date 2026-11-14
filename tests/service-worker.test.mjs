import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const build='0.11.5-0123456789ab';
const cacheName='omniforge-shell-'+build;
const rootFor=release=>'<meta name="omniforge-build" content="'+release+'"><main>Workspace</main>';
const css='/src/style.css?v='+build;
const script='/src/core.js?v='+build;
const seed='/src/reference-seed.json?v='+build;
const assets={[css]:'text/css',[script]:'text/javascript','/src/knowledge.xml':'application/xml',[seed]:'application/json'};
const digest=text=>'sha256-'+createHash('sha256').update(text).digest('base64');
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8')
 .replaceAll('__BUILD_ID__',build)
 .replace("'__SHELL_ASSETS__'",JSON.stringify(Object.fromEntries(Object.keys(assets).map(path=>[path,digest(path)]))));
function harness(){
 const handlers={};
 const stores=new Map([
  ['other-cache',new Map()],
  ['omniforge-shell-older',new Map([['/','Older workspace']])],
  ['omniforge-shell-prior',new Map([['/','Previous workspace'],['/src/core.js?v=prior','Previous script']])]
 ]);
 const requests=[];
 let skipped=0,claimed=0;
 const cacheFor=async key=>{
  if(!stores.has(key))stores.set(key,new Map());
  return {put:async(path,response)=>stores.get(key).set(path,await response.text()),match:async path=>{
   const value=stores.get(key).get(path);
   return value===undefined?undefined:new Response(value,{headers:{'content-type':assets[path]||'text/html'}});
  }};
 };
 const network=async(input,options)=>{
  const path=typeof input==='string'?input:new URL(input.url).pathname+new URL(input.url).search;
  requests.push({path,options});
  const response=await result.respond(path);
  if(options?.integrity&&digest(await response.clone().text())!==options.integrity)throw Error('Integrity mismatch');
  return response;
 };
 const result={
  stores,requests,skipped:()=>skipped,claimed:()=>claimed,
  respond:async path=>new Response(assets[path]?path:rootFor(build),{headers:{'content-type':assets[path]||'text/html'}}),
  run:type=>{let work;handlers[type]({waitUntil:promise=>work=promise});return work},
  fetch:(path,mode='cors',method='GET')=>{
   let response;
   handlers.fetch({request:{url:new URL(path,'https://app.test').href,method,mode},respondWith:promise=>response=promise});
   return response;
  }
 };
 const cacheStorage={open:cacheFor,delete:async key=>stores.delete(key),keys:async()=>[...stores.keys()],
   match:async(path,{cacheName:key})=>stores.has(key)?(await cacheFor(key)).match(path):undefined};
 result.cacheStorage=cacheStorage;
 vm.runInNewContext(source,{URL,Response,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms/100),clearTimeout,
  self:{location:{origin:'https://app.test'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{skipped++},clients:{claim:async()=>{claimed++}}},
  fetch:network,caches:cacheStorage});
 return result;
}

test('Install waits for all assets and leaves the previous complete cache after a failed update',async()=>{
 const h=harness(),original=h.respond;
 h.respond=async path=>path===script?new Response('Unavailable',{status:503}):original(path);
 await assert.rejects(h.run('install'),/Integrity mismatch|Offline asset unavailable/);
 assert.equal(h.skipped(),0);
 assert.equal(h.stores.get('omniforge-shell-prior').get('/'),'Previous workspace');
 assert.equal(h.stores.has(cacheName),false);
});

test('Install rejects mismatched HTML and wrong JavaScript even when the server sends HTTP 200',async()=>{
 const html=harness();
 html.respond=async()=>new Response(rootFor('0.11.4-aaaaaaaaaaaa'),{headers:{'content-type':'text/html'}});
 await assert.rejects(html.run('install'),/different release/);
 assert.equal(html.skipped(),0);
 const javascript=harness(),original=javascript.respond;
 javascript.respond=path=>path===script?new Response('stale JavaScript',{headers:{'content-type':'text/javascript'}}):original(path);
 await assert.rejects(javascript.run('install'),/Integrity mismatch/);
 assert.equal(javascript.stores.has(cacheName),false);
});

test('Install caches the matching verified assets before activating and retains the previous shell',async()=>{
 const h=harness();
 await h.run('install');
 assert.equal(h.skipped(),1);
 assert.equal(h.stores.get(cacheName).get('/'),rootFor(build));
 assert.equal(h.stores.get(cacheName).get(script),script);
 assert.equal(await(await h.fetch(seed)).text(),seed);
 assert.equal(h.requests.find(request=>request.path===script).options.integrity,digest(script));
 await h.run('activate');
 assert.equal(h.claimed(),1);
 assert.deepEqual([...h.stores.keys()],['other-cache','omniforge-shell-prior',cacheName]);
 assert.equal(await(await h.fetch('/src/core.js?v=prior')).text(),'Previous script');
});

test('Navigation keeps the working shell until the next release is fully cached',async()=>{
 const h=harness();
 await h.run('install');
 for(const response of [new Response('Wrong page',{headers:{'content-type':'text/html'}}),new Response('Unavailable',{status:503})]){
  h.respond=async()=>response;
  assert.equal(await(await h.fetch('/?u','navigate')).text(),rootFor(build));
 }
 h.respond=async()=>new Response(rootFor('0.11.6-aaaaaaaaaaaa'),{headers:{'content-type':'text/html'}});
 assert.equal(await(await h.fetch('/','navigate')).text(),rootFor(build));
 h.stores.set('omniforge-shell-0.11.6-aaaaaaaaaaaa',new Map([['/',rootFor('0.11.6-aaaaaaaaaaaa')]]));
 assert.equal(await(await h.fetch('/','navigate')).text(),rootFor('0.11.6-aaaaaaaaaaaa'));
 h.respond=async()=>{throw Error('Offline')};
 assert.equal(await(await h.fetch('/index.html','navigate')).text(),rootFor(build));
});

test('The offline cache ignores API calls and unrelated URLs',()=>{
 const h=harness();
 for(const path of ['/api/admin/providers','/api/chat','/build-info.json','/quick-chat','/random.html','https://other.test/src/core.js']){
  assert.equal(h.fetch(path,'navigate'),undefined);
 }
 assert.equal(h.fetch('/','navigate','POST'),undefined);
});

test('Local reference refresh uses the network and falls back to the verified bundled copy',async()=>{
 const h=harness();
 await h.run('install');
 h.respond=async()=>new Response('<knowledge>Updated</knowledge>',{headers:{'content-type':'application/xml'}});
 assert.equal(await(await h.fetch('/src/knowledge.xml')).text(),'<knowledge>Updated</knowledge>');
 assert.equal(h.requests[h.requests.length-1].options.cache,'no-cache');
 h.respond=async()=>new Response('Unexpected page',{headers:{'content-type':'text/html'}});
 assert.equal(await(await h.fetch('/src/knowledge.xml')).text(),'/src/knowledge.xml');
});

test('A stalled navigation falls back to the installed workspace',async()=>{
 const h=harness();
 await h.run('install');
 h.respond=()=>new Promise(()=>{});
 assert.equal(await(await h.fetch('/?slow','navigate')).text(),rootFor(build));
 assert.equal(h.requests[h.requests.length-1].options.signal.aborted,true);
});

test('Cache storage failure does not block online navigation or current scripts',async()=>{
 const h=harness();
 h.cacheStorage.match=async()=>{throw Error('Cache storage denied')};
 assert.equal(await(await h.fetch('/','navigate')).text(),rootFor(build));
 assert.equal(await(await h.fetch(script)).text(),script);
});
