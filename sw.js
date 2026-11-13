/* Cache only the public workspace shell and its bundled reference data. */
const BUILD='__BUILD_ID__';
const PREFIX='omniforge-shell-';
const CACHE=PREFIX+BUILD;
const ASSETS='__SHELL_ASSETS__';
const MARKER=/<meta name="omniforge-build" content="([0-9]+\.[0-9]+\.[0-9]+-[a-f0-9]{12})">/;

async function workspacePage(response){
 const type=response.headers.get('content-type')||'';
 if(response.status!==200||response.redirected||!type.includes('text/html'))throw Error('Workspace page unavailable');
 const html=await response.clone().text();
 const build=html.match(MARKER)?.[1];
 // A rollback to the preceding release can still return its pre-marker page.
 if(!build&&!(html.includes('id="startupStatus"')&&html.includes('./src/app.js?v=')))throw Error('Workspace page could not be identified');
 return build;
}

async function fetchAsset(path,cache='no-cache'){
 const response=await fetch(path,{cache,integrity:ASSETS[path],redirect:'error'});
 const type=response.headers.get('content-type')||'';
 const expected=path.startsWith('/src/knowledge.xml')?/xml/i:path.includes('.css?')?/text\/css/i:/(javascript|ecmascript)/i;
 if(response.status!==200||!expected.test(type))throw Error('Offline asset unavailable: '+path);
 return response;
}

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const root=await fetch('/',{cache:'reload',redirect:'error'});
   if(await workspacePage(root)!==BUILD)throw Error('Workspace page is from a different release');
   const results=await Promise.allSettled(Object.keys(ASSETS).map(async path=>{
    await cache.put(path,await fetchAsset(path,'reload'));
   }));
   const failed=results.find(result=>result.status==='rejected');
   if(failed)throw failed.reason;
   // The root is written only once every dependency is ready.
   await cache.put('/',root);
   await self.skipWaiting();
  }catch(error){
   // An installed copy of this build may exist after a rollback and redeploy.
   if(!await cache.match('/'))await caches.delete(CACHE);
   throw error;
  }
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const previous=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
  // Keep the immediately preceding release for other tabs that are still open.
  await Promise.all(previous.slice(0,-1).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});

async function navigate(request){
 const cache=await caches.open(CACHE);
 const saved=await cache.match('/');
 try{
  const response=await fetch(request,{cache:'no-cache'});
  const build=await workspacePage(response);
  if(build&&build!==BUILD&&saved){
   const next=await caches.match('/',{cacheName:PREFIX+build});
   return next||saved;
  }
  return response;
 }catch{
  return saved||new Response('OMNIFORGE is unavailable. Reconnect and reload to try again.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
 }
}

self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&['/','/index.html'].includes(url.pathname)){
  event.respondWith(navigate(request));
  return;
 }
 const path=url.pathname+url.search;
 if(path==='/src/knowledge.xml'){
  // Check the network for updated reference data, keeping the verified bundled copy for offline use.
  event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
   if(!response.ok||!/(xml)/i.test(response.headers.get('content-type')||''))throw Error('Reference pack unavailable');
   return response;
  }).catch(async()=>await (await caches.open(CACHE)).match(path)||new Response('Knowledge pack unavailable offline',{status:503})));
  return;
 }
 if(Object.prototype.hasOwnProperty.call(ASSETS,path)){
  event.respondWith((async()=>await (await caches.open(CACHE)).match(path)||fetchAsset(path))());
 }else if(/^\/(?:src|vendor)\/[^?]+\.(?:js|css)\?v=[a-z0-9.-]+$/i.test(path)){
  event.respondWith((async()=>await caches.match(path,{cacheName:PREFIX+url.searchParams.get('v')})||fetch(request))());
 }
});
