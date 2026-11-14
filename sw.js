/* Cache only the public workspace shell and its bundled reference data. */
const BUILD='__BUILD_ID__';
const PREFIX='omniforge-shell-';
const CACHE=PREFIX+BUILD;
const ASSETS='__SHELL_ASSETS__';
const MARKER=/<meta name="omniforge-build" content="([0-9]+\.[0-9]+\.[0-9]+-[a-f0-9]{12})">/;

async function cached(path,build=BUILD){
 try{return await caches.match(path,{cacheName:PREFIX+build})}catch{return undefined}
}
async function network(request,options,timeout,validate){
 const controller=new AbortController();
 let timer;
 try{
  return await Promise.race([
   (async()=>{const response=await fetch(request,{...options,signal:controller.signal});await validate?.(response);return response})(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Workspace network deadline exceeded'))},timeout)})
  ]);
 }finally{clearTimeout(timer)}
}

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
 return network(path,{cache,integrity:ASSETS[path],redirect:'error'},15000,response=>{
  const type=response.headers.get('content-type')||'';
  const expected=path.startsWith('/src/knowledge.xml')?/xml/i:path.includes('.css?')?/text\/css/i:
   path.startsWith('/src/reference-seed.json?')?/application\/json/i:/(javascript|ecmascript)/i;
  if(response.status!==200||!expected.test(type))throw Error('Offline asset unavailable: '+path);
 });
}

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const root=await network('/',{cache:'reload',redirect:'error'},15000,async response=>{
    if(await workspacePage(response)!==BUILD)throw Error('Workspace page is from a different release');
   });
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
 const saved=cached('/');
 try{
  let build;
  const response=await network(request,{cache:'no-cache'},5000,async response=>{build=await workspacePage(response)});
  if(build&&build!==BUILD)return await cached('/',build)||await saved||response;
  return response;
 }catch{
  return await saved||new Response('OMNIFORGE is unavailable. Reconnect and reload to try again.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
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
  event.respondWith(network(request,{cache:'no-cache'},8000,response=>{
   if(!response.ok||!/(xml)/i.test(response.headers.get('content-type')||''))throw Error('Reference pack unavailable');
  }).catch(async()=>await cached(path)||new Response('Knowledge pack unavailable offline',{status:503})));
  return;
 }
 if(Object.prototype.hasOwnProperty.call(ASSETS,path)){
  event.respondWith((async()=>await cached(path)||fetchAsset(path))());
 }else if(/^\/(?:src|vendor)\/[^?]+\.(?:js|css)\?v=[a-z0-9.-]+$/i.test(path)||
          /^\/src\/reference-seed\.json\?v=[a-z0-9.-]+$/i.test(path)){
  event.respondWith((async()=>await cached(path,url.searchParams.get('v'))||network(request,{},15000))());
 }
});

self.addEventListener('message',event=>{
 if(event.data==='OMNIFORGE_BUILD')event.ports[0]?.postMessage(BUILD);
});
