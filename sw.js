/* Offline app shell only: never cache /api/chat or store private AI requests. */
const CACHE='omniforge-shell-v1.3-budget-visibility';
const ASSETS=['/','/index.html','/src/style.css','/src/core.js','/src/workspace.js','/src/calculator.js','/src/offline.js','/src/offline-ui.js','/src/vector.js','/src/projectfiles.js','/src/knowledge.xml','/src/app.js','/vendor/jszip.min.js'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled(ASSETS.map(async path=>{const response=await fetch(path,{cache:'reload'});if(response.ok)await cache.put(path,response)}));await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('omniforge-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/quick-chat'||url.pathname==='/sw.js')return;
 if(url.pathname==='/src/knowledge.xml'){
  // Network-first here matters: an hourly check must not just retrieve yesterday's cached XML.
  event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
    return response;
  }).catch(async()=>await caches.match(request)||new Response('Knowledge pack unavailable offline',{status:503})));
  return;
 }
 if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/',clone)))}return response}).catch(async()=>await caches.match('/')||new Response('Offline shell unavailable',{status:503})));return}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)))}return response})));
});
