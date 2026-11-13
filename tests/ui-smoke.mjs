// Optional browser QA. Uses explicit provider fixtures; never claims live inference.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { MikeeCoordinator } from '../server/coordinator.js';
import { PROFILES } from '../server/catalog.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwright = await import(process.env.MIKEE_QA_PLAYWRIGHT || 'playwright');
let launch = { headless: true };
if (process.env.MIKEE_QA_CHROMIUM) {
  const { default: chromium } = await import(process.env.MIKEE_QA_CHROMIUM);
  launch = { ...launch, executablePath: await chromium.executablePath(), args: chromium.args };
}
let time = Date.now(), fixtureCalls = 0;
const storageData = new Map();
const storage = { get: async key => structuredClone(storageData.get(key)), put: async (key, value) => storageData.set(key, structuredClone(value)) };
const doc = navy => '<!doctype html><html><head><title>Elegant Fashion</title><style>body{background:' + (navy ? 'navy' : 'white') + ';color:gold}</style></head><body><main><h1>Elegant Fashion</h1><p>Clothes made for you.</p><button id="fixture-action">Try example</button><output id="fixture-output"></output></main><script>document.querySelector("#fixture-action").onclick=()=>{document.querySelector("#fixture-output").textContent="It works"};</script></body></html>';
const answer = messages => {
  const last = messages.at(-1).content;
  if (Array.isArray(last)) return 'Fixture photo analysis.';
  if (/incomplete HTML fixture/.test(last)) return '<!doctype html><html><body>incomplete';
  if (/How are you/.test(last)) return 'I am ready to help. What would you like to work on?';
  if (/Never reveal/.test(last)) return 'Here is my answer: '+doc(false); // Deliberately bad model output must be blocked.
  if (/Express backend/.test(last)) return '```js\nimport express from "express";\nconst app=express();app.get("/",(req,res)=>res.json({ok:true}));app.listen(3000);\n```';
  if (/What website did we just create/.test(last)) {assert.ok(messages.some(m=>String(m.content).startsWith('ACTIVE LOCALLY SAVED PROJECT SUMMARY')&&m.content.includes('Elegant Fashion')));return 'We created the Elegant Fashion website.';}
  if (/Make the website gold/.test(last)) return doc(true).replace('background:navy','background:gold');
  if (/Make the website background navy/.test(last)) assert.ok(messages.some(m=>String(m.content).startsWith('CURRENT PROJECT')&&m.content.includes('Clothes made for you.')),'A styling edit must receive the actual saved website.');
  return doc(/navy/.test(last));
};
const allow={limit:async()=>({success:true})};
const env = {CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,IMAGE_VISITOR_LIMIT:allow,IMAGE_SHARED_LIMIT:allow,DAILY_BUDGET:{getByName:()=>({fetch:async()=>Response.json({allowed:true})})}, MIKEE_ADMIN_TOKEN: 'fixture-owner-token-at-least-24-characters', AI: { run: async (_, input) => {
  fixtureCalls++; await new Promise(r => setTimeout(r, 350)); return { response: answer(input.messages) };
} } };
const fixtureImage = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64'), Buffer.alloc(80)]);
const pool = new MikeeCoordinator({ storage }, env, { now: () => time, fetch: async (url, init) => {
  if (url.startsWith('https://image.pollinations.ai/')) return new Response(fixtureImage, { headers: { 'content-type': 'image/png' } });
  if (url.endsWith('/audio/transcriptions')) return Response.json({ text: 'Fixture audio transcript ready for review.' });
  const input = JSON.parse(init.body); fixtureCalls++;
  return Response.json({ model: input.model, choices: [{ message: { content: answer(input.messages) }, finish_reason: 'stop' }] });
} });
await pool.ready;
for (const p of PROFILES) pool.data.config[p.id] = { enabled: ['cloudflare', 'pollinations-image'].includes(p.id), freeConfirmed: true };
await pool.persist();
env.MIKEE_POOL = { idFromName: x => x, get: () => ({ fetch: request => { time += 2000; return pool.fetch(request); } }) };
env.ASSETS = { fetch: async request => {
  const path = new URL(request.url).pathname, file = resolve(root, 'public', path === '/' ? 'index.html' : '.' + path);
  if (!file.startsWith(resolve(root, 'public') + '/')) return new Response('', { status: 404 });
  try { return new Response(await readFile(file), { headers: { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.xml': 'application/xml', '.json': 'application/json' }[extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('', { status: 404 }); }
} };
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request('http://127.0.0.1:' + server.address().port + incoming.url, { method: incoming.method, headers: incoming.headers,
      ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}) });
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { outgoing.writeHead(500); outgoing.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
const go=async tab=>{await page.locator('#mobileMenuButton').click();await page.locator('[data-mobile="'+tab+'"]').click()};
const settings=async()=>{await page.locator('#mobileMenuButton').click();await page.locator('[data-drawer-action="settings"]').click()};
const errors = []; page.on('pageerror', error => errors.push(error.message));
const address = 'http://127.0.0.1:' + server.address().port;
async function submitAndReadReply(text){
 const count=await page.evaluate(()=>window.OMNI_TEST.getProject()?.messages.length||0);
 await page.locator('#prompt').fill(text);
 await page.locator('#sendBtn').click();
 await page.waitForFunction(previous=>{
  const messages=window.OMNI_TEST.getProject()?.messages;
  return messages?.length===previous+2&&messages[messages.length-1]?.role==='assistant'&&!document.querySelector('#sendBtn').disabled;
 },count);
 return page.evaluate(()=>{
  const messages=window.OMNI_TEST.getProject().messages;
  return messages[messages.length-1];
 });
}
async function verifyConcurrentSaves(){
 const context=await browser.newContext({viewport:{width:360,height:780}});
 try{
  const first=await context.newPage(),second=await context.newPage();
  await first.goto(address);
  await first.locator('#startupStatus').waitFor({state:'hidden'});
  await first.locator('#newProject').click();
  await first.waitForFunction(()=>!!window.OMNI_TEST.getProject());
  await second.goto(address);
  await second.locator('#startupStatus').waitFor({state:'hidden'});
  await first.locator('#prompt').fill('/calc 20+22');
  await first.locator('#sendBtn').click();
  await first.getByText('Result: 42',{exact:false}).waitFor();
  await second.locator('#prompt').fill('/calc 7+8');
  await second.locator('#sendBtn').click();
  await second.locator('#toast').getByText(/changed in another tab/).waitFor();
  assert.equal(await second.locator('#prompt').inputValue(),'/calc 7+8');
  await second.getByText('Result: 42',{exact:false}).waitFor();
  await second.evaluate(()=>{const send=document.querySelector('#sendBtn');send.click();send.click()});
  await second.getByText('Result: 15',{exact:false}).waitFor();
  const saved=await second.evaluate(async()=>{
   const C=window.OMNI,active=window.OMNI_TEST.getProject(),stored=await C.getProject(active.id);
   return stored.messages.filter(message=>message.role==='user').map(message=>message.text);
  });
  assert.deepEqual(saved,['/calc 20+22','/calc 7+8']);
  const deletion=await first.evaluate(async()=>{
   const C=window.OMNI;
   try{await C.deleteProject(window.OMNI_TEST.getProject());return 'removed'}
   catch(error){return error.code}
  });
  assert.equal(deletion,'PROJECT_CONFLICT');
 }finally{await context.close()}
}
async function verifyStartupRecovery() {
  const context = await browser.newContext({viewport:{width:360,height:780}});
  try {
    const blocker=await context.newPage();
    await blocker.route(address+'/storage-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage fixture</title>'}));
    await blocker.goto(address+'/storage-fixture');
    await blocker.evaluate(()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('omniforge-db',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});
      request.onsuccess=()=>{
        const db=request.result;
        const transaction=db.transaction('projects','readwrite');
        transaction.objectStore('projects').put({id:'older-chat',name:'Older chat',updatedAt:1,chatOnly:true,messages:[{role:'user',text:'Saved before the upgrade'}]});
        transaction.oncomplete=()=>resolve();
        transaction.onerror=()=>reject(transaction.error);
      };
      request.onerror=()=>reject(request.error);
    }));
    const mobile=await context.newPage();
    await mobile.goto(address);
    await mobile.locator('#startupStatus').getByText(/in use by another OMNIFORGE tab/).waitFor();
    assert.ok(await mobile.locator('#chatPane').isVisible());
    assert.ok(await mobile.locator('#startupReload').isVisible());
    await blocker.close();
    await mobile.locator('#startupReload').click();
    await mobile.getByText('Saved before the upgrade',{exact:true}).waitFor();
    assert.equal(await mobile.locator('#projectSelect').inputValue(),'older-chat');
    await mobile.locator('#newProject').click();
    await mobile.waitForFunction(()=>document.querySelector('#projectSelect').selectedOptions[0]?.text.startsWith('New Chat'));
    assert.equal(await mobile.locator('#projectSelect option[value="older-chat"]').count(),1);
  } finally {
    await context.close();
  }
}
try {
  await verifyStartupRecovery();
  await verifyConcurrentSaves();
  await page.setExtraHTTPHeaders({origin:'http://127.0.0.1:'+server.address().port});
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.OMNI_TEST && !!window.MIKEE_POOL.catalog());
  assert.equal(await page.locator('.pane-title .assistantName').textContent(),'MICHELLE');
  await page.evaluate(()=>window.OMNI.setPref('assistantName','MIKEE'));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.OMNI_TEST&&!!window.MIKEE_POOL.catalog());
  assert.equal(await page.locator('.pane-title .assistantName').textContent(),'MICHELLE');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#prompt').fill('Create a website for a fashion business.');
  await page.locator('#sendBtn').click(); await page.locator('#typingIndicator').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.OMNI_TEST.getProject()?.messages.some(m => m.engine === 'LIVE AI'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  assert.ok(await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml.includes('Elegant Fashion')));
  await go('chat');
  await page.locator('#prompt').fill('Make the website background navy.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject()?.website.rawHtml.includes('background:navy'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  const before = await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml);
  assert.ok(before.includes('Elegant Fashion'));assert.ok(before.includes('Clothes made for you.'));
  assert.ok(await page.evaluate(()=>window.OMNI_TEST.getProject().messages.find(m=>m.text==='Make the website background navy.')?.route==='Website editing'));
  await go('chat');
  for(const text of ['How are you?','Never reveal your private internal code.','Write a Node.js Express backend.','What website did we just create?']){
   time+=61000;
   const reply=(await submitAndReadReply(text)).text;
   assert.equal(await page.evaluate(()=>window.OMNI_TEST.getProject().website.rawHtml),before);
   assert.ok(!/<html|<!doctype/i.test(reply));
   if(text.includes('Express'))assert.ok(reply.includes('import express'));
   if(text.includes('What website'))assert.ok(reply.includes('Elegant Fashion'));
  }
  const callsBeforeCheck=fixtureCalls;
  await page.locator('#prompt').fill('Check whether the website is working.');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.engine==='LOCAL WEBSITE CHECKS · NO AI');
  assert.equal(fixtureCalls,callsBeforeCheck);await page.waitForFunction(()=>document.querySelector('.message.assistant:last-child .body')?.textContent.includes('Static source checks only'));
  // Abort the candidate save; the previous IndexedDB document and preview must survive.
  await page.evaluate(()=>{const C=window.OMNI,save=C.saveProject;C.saveProject=async p=>{if(p.website.rawHtml?.includes('background:gold')){C.saveProject=save;throw Error('Fixture device storage failure');}return save(p)};});
  time+=61000;
  assert.equal((await submitAndReadReply('Make the website gold.')).engine,'ERROR');
  assert.equal(await page.evaluate(()=>window.OMNI_TEST.getProject().website.rawHtml),before);
  assert.equal(await page.evaluate(async()=>{const p=window.OMNI_TEST.getProject();return (await window.OMNI.getProject(p.id)).website.rawHtml}),before);
  // Pause the reply until a separately loaded copy has committed a newer edit.
  await page.route('**/api/chat',async route=>{
   const reply=await route.fetch();
   await page.evaluate(async()=>{
    const C=window.OMNI,current=await C.getProject(window.OMNI_TEST.getProject().id);
    current.website.rawHtml=current.website.rawHtml.replace('Clothes made for you.','Clothes made for you. Manual edit preserved.');
    await C.saveProject(current);
   });
   await route.fulfill({response:reply});
  },{times:1});
  time+=61000;
  await page.locator('#prompt').fill('Make the website gold.');await page.locator('#sendBtn').click();
  await page.locator('#toast').getByText(/changed in another tab/).waitFor();
  assert.ok(await page.evaluate(()=>window.OMNI_TEST.getProject().website.rawHtml.includes('Manual edit preserved.')));
  await page.evaluate(async html=>{const p=window.OMNI_TEST.getProject();p.website.rawHtml=html;await window.OMNI.saveProject(p)},before);
  time+=61000;
  await go('chat'); await page.locator('#prompt').fill('Update the website with incomplete HTML fixture.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().messages.at(-1).text.includes('incomplete HTML'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml), before);
  time+=61000; // Move the fixture clock past the existing three-request minute allowance.
  const explanation=await submitAndReadReply('Explain how to create a website.');
  assert.equal(await page.evaluate(()=>window.OMNI_TEST.getProject().website.rawHtml),before);
  assert.ok(!explanation.text.startsWith('Your website is updated'));
  await page.route('**/api/image',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fixture image provider unavailable.'})}));
  await page.locator('#prompt').fill('Michelle, can you generate an image of a flying cow?');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.text.includes('Image generation unavailable'));
  await page.locator('#typingIndicator').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.OMNI_TEST.getProject().assets.length),0);
  assert.ok(await page.evaluate(()=>window.OMNI_TEST.getProject().messages.at(-1).engine==='ERROR'));
  await page.unroute('**/api/image');
  await page.locator('#composerMode').selectOption('image'); await page.locator('#prompt').fill('A classroom illustration.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().assets.length === 1);
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  await go('edit');await page.locator('#editActualCode').click();await page.waitForFunction(()=>!!window.OMNI_TEST.getProject().codeWorkspace);
  await go('photos');
  await page.locator('.asset-tile').click(); await page.locator('#addPhoto').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().website.rawHtml.includes('omniforge-asset://'));
  const rolledBack=await page.evaluate(async()=>{
   const C=window.OMNI,p=window.OMNI_TEST.getProject(),before=p.assets.length,id=p.assets[0].id,blob=await C.getBlob(id),original=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(names,...args){const tx=original.call(this,names,...args);if(Array.isArray(names)&&names.includes('projects')&&names.includes('assetBlobs'))queueMicrotask(()=>tx.abort());return tx;};
   let failed=false;try{await C.addAsset(p,new File([blob],'must-rollback.png',{type:blob.type}));}catch{failed=true;}finally{IDBDatabase.prototype.transaction=original;}
   const db=await C.openDB(),blobCount=await new Promise((resolve,reject)=>{const tx=db.transaction('assetBlobs','readonly'),r=tx.objectStore('assetBlobs').count();r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   return {failed,inMemory:p.assets.length===before,inDatabase:(await C.getProject(p.id)).assets.length===before,blobCount};
  });
  assert.deepEqual(rolledBack,{failed:true,inMemory:true,inDatabase:true,blobCount:1});
  const importRolledBack=await page.evaluate(async()=>{
   const C=window.OMNI,p=window.OMNI_TEST.getProject(),backup=await C.exportJSON(p);
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,...args){
    const request=original.call(this,value,...args);
    if(this.name==='projects')this.transaction.abort();
    return request;
   };
   let failed=false;
   try{await C.importProject(new File([backup],'interrupted.json'))}
   catch{failed=true}
   finally{IDBObjectStore.prototype.put=original}
   const db=await C.openDB();
   const counts=await Promise.all(['projects','assetBlobs'].map(name=>new Promise((resolve,reject)=>{
    const request=db.transaction(name,'readonly').objectStore(name).count();
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
   })));
   return {failed,counts};
  });
  assert.deepEqual(importRolledBack,{failed:true,counts:[1,1]});
  const exported = await page.evaluate(async () => window.OMNI.renderSite(window.OMNI_TEST.getProject(), await window.OMNI.assetMap(window.OMNI_TEST.getProject())));
  assert.ok(exported.includes('data:image/png;base64,'));

  const backups=await page.evaluate(async()=>{
   const C=window.OMNI,p=window.OMNI_TEST.getProject(),before=C.renderSite(p,await C.assetMap(p));
   const zip=await C.exportZIP(p),restored=await C.importProject(new File([zip],'roundtrip.zip'));
   const json=await C.exportJSON(p),fromJSON=await C.importProject(new File([json],'roundtrip.json'));
   const image=restored.messages.find(m=>m.imageId);
   return {originalId:p.id,restoredId:restored.id,jsonId:fromJSON.id,zipEqual:C.renderSite(restored,await C.assetMap(restored))===before,jsonEqual:C.renderSite(fromJSON,await C.assetMap(fromJSON))===before,imageRemapped:image?.imageId===restored.assets[0].id&&image.imageId!==p.assets[0].id,blobPresent:!!await C.getBlob(image.imageId)};
  });
  assert.equal(backups.zipEqual,true);assert.equal(backups.jsonEqual,true);assert.equal(backups.imageRemapped,true);assert.equal(backups.blobPresent,true);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.OMNI_TEST&&!!window.MIKEE_POOL.catalog());
  await page.locator('#projectSelect').selectOption(backups.restoredId);await page.waitForFunction(id=>window.OMNI_TEST.getProject()?.id===id,backups.restoredId);
  await go('preview');await page.frameLocator('#siteFrame').locator('#fixture-action').click();await page.frameLocator('#siteFrame').locator('#fixture-output').getByText('It works').waitFor();
  const css=await page.frameLocator('#siteFrame').locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(css,'rgb(0, 0, 128)');
  await page.evaluate(async originalId=>{
   const C=window.OMNI,p=await C.getProject(originalId),shared=C.clone(p);shared.id=C.uuid();await C.saveProject(shared);
   const asset=p.assets[0].id;await C.deleteProject(p);if(!await C.getBlob(asset))throw Error('Deleted a shared blob');
   await C.deleteProject(shared);if(await C.getBlob(asset))throw Error('Left an orphaned blob');
  },backups.originalId);

  await settings(); assert.equal(await page.locator('#aiProviderSelect').count(),0);
  await page.locator('.connections-section > summary').click();
  assert.equal(await page.locator('[data-connection="groq"]').count(),0);
  await page.locator('#ownerToken').fill(env.MIKEE_ADMIN_TOKEN); await page.locator('#unlockOwner').click();
  await page.locator('#ownerLock').waitFor({ state: 'visible' });
  await page.locator('[data-connection="groq"] > summary').click();
  await page.locator('[data-connection="groq"] .connection-key').fill('private-fixture-provider-key');
  await page.locator('[data-connection="groq"] .connection-free').check();
  await page.locator('[data-connection="groq"] .connection-enabled').check();
  await page.locator('[data-save-connection="groq"]').click();
  await page.waitForFunction(() => document.querySelector('#connectionNotice').textContent.includes('Connection saved'));
  assert.ok(!JSON.stringify(storageData.get('pool-v1')).includes('private-fixture-provider-key'));
  assert.equal(await page.evaluate(async () => await window.OMNI.pref('GROQ_API_KEY')), undefined);
  await page.locator('#saveSettings').click(); await go('chat');
  await page.locator('#audioFile').setInputFiles({ name: 'fixture.webm', mimeType: 'audio/webm', buffer: Buffer.from('fixture audio') });
  await page.waitForFunction(() => document.querySelector('#prompt').value === 'Fixture audio transcript ready for review.');
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });

  await page.locator('#prompt').fill('What is a diode?');
  await page.route('**/api/chat',route=>route.abort('failed'));
  await page.locator('#sendBtn').click();await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.engine==='ERROR');
  assert.equal(await page.evaluate(()=>window.OMNI_OFFLINE_UI.isOffline()),false);
  await page.unroute('**/api/chat');time+=61000;
  await page.locator('#prompt').fill('Say connection restored.');await page.locator('#sendBtn').click();await page.locator('#typingIndicator').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.engine==='LIVE AI');
  const callsBeforeOffline=fixtureCalls;await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.context().setOffline(true);
  await page.reload({waitUntil:'load'});await page.waitForFunction(()=>!!window.OMNI_TEST?.getProject());
  await page.locator('#prompt').fill('/calc 19+28');await page.locator('#sendBtn').click();await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.text.includes('Result: 47'));
  assert.ok(await page.evaluate(()=>!!window.OMNI_OFFLINE_UI&&!!window.OMNI_KNOWLEDGE));
  assert.equal(fixtureCalls,callsBeforeOffline);await page.context().setOffline(false);
  time+=61000;await page.locator('#newProject').click();await page.waitForFunction(()=>!window.OMNI_TEST.getProject()?.messages.length);
  await page.locator('#composerMode').selectOption('image');await page.locator('#prompt').fill('A flying cow.');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>window.OMNI_TEST.getProject()?.assets.length===1);await page.locator('#typingIndicator').waitFor({state:'hidden'});
  await go('photos');await page.locator('.asset-tile').click();await page.locator('#addPhoto').waitFor({state:'visible'});assert.equal(await page.locator('#addPhoto').isDisabled(),true);
  await page.screenshot({ path: resolve(root, '../mikee-mobile-qa.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS mobile UI: blocked database recovery with preserved chats, Michelle identity with legacy preferences, typing feedback, website edits, ordinary chat and Express code preserve the site, active-project recall, static diagnostics, failed saves and concurrent edits preserve newer work, incomplete HTML protection, image failure without a placeholder, image generation/save/placement/export, encrypted owner connection, audio draft, faithful ZIP/JSON restore, restored JavaScript/CSS, image remapping, safe blob cleanup, network recovery and offline reload; provider responses are fixtures. Calls:', fixtureCalls);
} catch(error) {console.log('UI failure state',JSON.stringify(await page.evaluate(()=>({messages:window.OMNI_TEST?.getProject()?.messages?.slice(-2),assets:window.OMNI_TEST?.getProject()?.assets?.length,toast:document.querySelector('#toast')?.textContent,local:window.OMNI_OFFLINE_UI?.isOffline()}))),errors);throw error;} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
