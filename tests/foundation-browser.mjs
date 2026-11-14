// Synthetic upgrade, rollback and mobile performance evidence. No model calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';

const [mode,folder,other]=process.argv.slice(2);
if(!['measure','upgrade'].includes(mode)||!folder||(mode==='upgrade'&&!other)){
 throw Error('Usage: node tests/foundation-browser.mjs measure BUILD_DIR or upgrade OLD_BUILD_DIR NEW_BUILD_DIR');
}
const {chromium}=await import(process.env.MIKEE_QA_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({
 ...(process.env.OMNI_CHROMIUM?{executablePath:process.env.OMNI_CHROMIUM}:{}),
 ...(mode==='upgrade'&&process.env.OMNI_LEGACY==='1'?{args:['--disable-gpu','--disable-software-rasterizer']}:{}),
});
const initial=resolve(folder),candidate=other&&resolve(other);
const readBuild=async dir=>JSON.parse(await readFile(resolve(dir,'build-info.json'),'utf8'));
const build=await readBuild(initial);
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.xml':'application/xml','.json':'application/json'};
let serving=initial,failedNavigation=false,failedAsset='',assetFailures=0;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('cache-control','no-cache');
 if(path==='/api/providers'){
  res.writeHead(200,{'content-type':'application/json'}).end('{"providers":[],"parked":[],"ownerSetup":false}');return;
 }
 if(path===failedAsset){assetFailures++;res.writeHead(503).end('Synthetic asset failure');return}
 if(failedNavigation&&path==='/'){res.writeHead(503).end('Synthetic navigation failure');return}
 try{
  const file=resolve(serving,path==='/'?'index.html':'.'+path);
  assert.ok(file.startsWith(serving+'/'));
  const content=await readFile(file);
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(content);
 }catch{res.writeHead(404).end()}
});
await new Promise(ready=>server.listen(0,'127.0.0.1',ready));
const url='http://127.0.0.1:'+server.address().port;
const newContext=()=>browser.newContext({viewport:{width:360,height:780},hasTouch:true,isMobile:true});
const started=page=>page.locator('#startupStatus').waitFor({state:'hidden'});
const saveChat=async page=>{
 await page.locator('#newProject').tap();
 await page.waitForFunction(()=>!!window.OMNI_TEST.getProject()&&!!document.querySelector('#projectSelect').value);
 return page.locator('#projectSelect').inputValue();
};
async function installed(page,id,confirmWorker=false){
 await until('active offline shell '+id,()=>page.evaluate(async ({id:buildId,confirmWorker:verify})=>{
  const name='omniforge-shell-'+buildId;
  const registration=await navigator.serviceWorker.getRegistration();
  const worker=navigator.serviceWorker.controller;
  if(!worker||!registration||registration.installing||registration.waiting||!await caches.match('/',{cacheName:name}))return false;
  if(!verify)return true;
  return new Promise(resolve=>{
   const channel=new MessageChannel();
   const timer=setTimeout(()=>{channel.port1.close();resolve(false)},250);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data===buildId)};
   worker.postMessage('OMNIFORGE_BUILD',[channel.port2]);
  });
 },{id,confirmWorker}));
}
async function until(description,check){
 const end=performance.now()+15000;
 while(performance.now()<end){
  if(await check())return;
  await delay(100);
 }
 throw Error('Timed out waiting for '+description);
}
async function measure(){
 const samples=[];
 for(let i=0;i<5;i++){
  const context=await newContext(),page=await context.newPage();
  const session=await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate',{rate:4});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const time=async operation=>{const start=performance.now();await operation();return Math.round(performance.now()-start)};
  const cold=await time(async()=>{await page.goto(url,{waitUntil:'domcontentloaded'});await started(page)});
  const shellRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(x=>new URL(x.name).pathname.startsWith('/src/')||new URL(x.name).pathname.startsWith('/vendor/')).length);
  const newChat=await time(()=>saveChat(page));
  const fixture=await page.evaluate(async()=>{
   const core=window.OMNI,project=window.OMNI_TEST.getProject();
   project.chatOnly=false;
   project.website.rawHtml='<!doctype html><html><head><title>Fixture</title></head><body><main>Benchmark<img src="omniforge-asset://photo-0"></main></body></html>';
   project.messages=Array.from({length:100},(_,i)=>({id:'fixture-'+i,at:i,role:i%2?'assistant':'user',text:'Synthetic saved turn '+i+' '+('A short line of deterministic text. '.repeat(7))}));
   project.assets=Array.from({length:12},(_,i)=>({id:'photo-'+i,name:'Fixture '+i,mimeType:'image/png'}));
   await core.saveProject(project,project.assets.map(asset=>({id:asset.id,blob:new Blob([new Uint8Array(192*1024)],{type:'image/png'})})));
   return project.id;
  });
  await page.addInitScript(()=>{
   window.benchmarkPhotoReads=0;
   const original=IDBObjectStore.prototype.get;
   IDBObjectStore.prototype.get=function(...args){if(this.name==='assetBlobs')window.benchmarkPhotoReads++;return original.apply(this,args)};
  });
  const warm=await time(async()=>{await page.reload({waitUntil:'domcontentloaded'});await started(page)});
  const record=await page.evaluate(()=>({id:window.OMNI_TEST.getProject().id,messages:document.querySelectorAll('.message').length,
   photoReads:window.benchmarkPhotoReads,heapUsedBytes:performance.memory?.usedJSHeapSize||null}));
  assert.equal(record.id,fixture);assert.equal(record.messages,100);assert.deepEqual(errors,[]);
  samples.push({cold,newChat,warm,shellRequests,photoReads:record.photoReads,heapUsedBytes:record.heapUsedBytes});
  await context.close();
 }
 const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[2];
 return {mode,build,cpuThrottle:4,samples,mediansMs:{cold:median('cold'),newChat:median('newChat'),warm:median('warm')}};
}
async function upgrade(){
 const next=await readBuild(candidate),context=await newContext(),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const release=()=>page.locator('meta[name="omniforge-build"]').getAttribute('content');
 const reload=async()=>{await page.reload({waitUntil:'domcontentloaded'});await started(page)};
 const result=async(text,expected)=>{
  await page.locator('#prompt').fill(text);await page.locator('#sendBtn').tap();
  await page.getByText(expected,{exact:false}).waitFor();
 };
 try{
  await page.goto(url+'/?foundation');await started(page);
  const id=await saveChat(page);
  await result('/calc 19+23','Result: 42');
  await installed(page,build.buildId);
  serving=candidate;failedAsset='/src/app.js';
  const update=()=>page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();
   await registration.update();
  }).catch(()=>{});
  await update();
  await until('the injected asset failure',()=>assetFailures>0);
  await installed(page,build.buildId);
  await reload();
  assert.equal(await release(),build.buildId);
  assert.equal(await page.locator('#projectSelect').inputValue(),id);
  failedAsset='';
  await update();await installed(page,next.buildId,true);
  const upgraded=await page.goto(url+'/?foundation=upgraded',{waitUntil:'domcontentloaded'});
  await started(page);
  assert.ok(upgraded?.ok());
  assert.equal(await release(),next.buildId);
  await result('/calc 18+19','Result: 37');
  failedNavigation=true;await reload();
  assert.equal(await release(),next.buildId);
  assert.equal(await page.locator('#projectSelect').inputValue(),id);
  failedNavigation=false;await context.setOffline(true);await reload();
  await page.getByText('Result: 37',{exact:false}).waitFor();
  await context.setOffline(false);serving=initial;await reload();
  assert.equal(await release(),build.buildId);
  await page.getByText('Result: 37',{exact:false}).waitFor();
  assert.equal(await page.locator('#projectSelect').inputValue(),id);
  assert.deepEqual(errors,[]);
  return {mode,oldBuild:build,newBuild:next,failedAssetFallback:true,serverFailureFallback:true,offlineReload:true,rollbackPreservedNewData:true,pageErrors:errors};
 }finally{await context.close()}
}
try{
 const evidence=await (mode==='measure'?measure():upgrade());
 console.log(JSON.stringify({...evidence,chromium:browser.version(),viewport:[360,780]},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
