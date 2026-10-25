import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../worker.js';
import poolHTTP from '../server/pool-http.js';
import {withTestPool} from './fixtures/pool.mjs';
import {VERSION} from '../server/config.js';
const allow={limit:async()=>({success:true})};
const guards={CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,IMAGE_VISITOR_LIMIT:allow,IMAGE_SHARED_LIMIT:allow};
const request=message=>new Request('https://mikee.test/api/chat',{method:'POST',headers:{origin:'https://mikee.test','content-type':'application/json'},body:JSON.stringify({message})});
function local(){const state={window:{},crypto,console,Date,Math,JSON,Error,Number,String,Set,Blob,TextDecoder,Uint8Array,fetch};vm.createContext(state);for(const name of ['core','projectfiles','backup'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),state);return state.window;}
test('Streamed oversized chat is cancelled before inference without trusting Content-Length',async()=>{
 let cancelled=false,hits=0;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(800001));},cancel(){cancelled=true;}});
 const req=new Request('https://mikee.test/api/chat',{method:'POST',headers:{origin:'https://mikee.test','content-type':'application/json'},body,duplex:'half'});
 const env=await withTestPool({...guards,AI:{run:async()=>{hits++;return {response:'bad'}}}});
 const response=await worker.fetch(req,env);assert.equal(response.status,413);assert.equal(cancelled,true);assert.equal(hits,0);
});
test('Audio uses the same visitor safeguards as chat',async()=>{
 let hits=0;const env=await withTestPool({AI:{run:async()=>{hits++;}}});
 const response=await worker.fetch(new Request('https://mikee.test/api/transcribe',{method:'POST'}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).protectionUnavailable,true);assert.equal(hits,0);
});
test('The media helper no longer exposes a competing chat or health implementation',async()=>{
 assert.equal((await poolHTTP.fetch(request('hello'),{})).status,404);
 assert.equal((await poolHTTP.fetch(new Request('https://mikee.test/api/health'),{})).status,404);
 const response=await worker.fetch(new Request('https://mikee.test/quick-chat'),{});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://mikee.test/');
});
test('Health and provider status use the package version',async()=>{
 const env=await withTestPool(guards),health=await(await worker.fetch(new Request('https://mikee.test/api/health'),env)).json();
 const status=await(await worker.fetch(new Request('https://mikee.test/api/providers'),env)).json();assert.equal(health.version,VERSION);assert.equal(status.version,VERSION);assert.equal(health.verified,false);
});
test('A fresh chat has no fabricated business website or mock command interpreter',()=>{
 const C=local().OMNI,p=C.makeProject('Chat');assert.equal(p.website.pages[0].sections.length,0);assert.equal(C.actionFromPrompt,undefined);assert.equal(C.callTool,undefined);
});
test('Project Undo restores the active code files and preceding chat state',()=>{
 const root=local(),C=root.OMNI,F=root.OMNI_FILES,p=C.makeProject('Static');p.chatOnly=false;p.codeWorkspace=F.fresh('Original');const before=F.exportDocument(p);
 const changed=C.change(p,n=>{n.website.rawHtml='<!doctype html><html><body>New code</body></html>';F.replaceDocument(n,n.website.rawHtml);}).project;
 assert.match(C.renderSite(changed),/New code/);assert.equal(C.renderSite(C.undo(changed)),before);
 const chat=C.makeProject('Chat');chat.chatOnly=true;const site=C.change(chat,n=>{n.chatOnly=false;n.website.rawHtml='<!doctype html><html></html>';}).project;assert.equal(C.undo(site).chatOnly,true);
});
test('The active three-file project is used for website exports and edits',()=>{
 const root=local(),p=root.OMNI.makeProject('Code');p.codeWorkspace=root.OMNI_FILES.fresh('Actual files');
 assert.match(root.OMNI.renderSite(p),/Actual files/);assert.match(root.OMNI.renderSite(p),/Hello from OMNIFORGE/);assert.doesNotMatch(root.OMNI.renderSite(p),/href="styles.css"/);
});
test('Sandbox policy applies to headless HTML while exports retain working code',()=>{
 const C=local().OMNI,source='<h1>Hi</h1><script>document.body.dataset.works="yes";</script>';
 const preview=C.sandboxHTML(source);assert.match(preview,/connect-src 'none'/);assert.match(preview,/img-src data: blob:/);assert.ok(preview.indexOf('Content-Security-Policy')<preview.indexOf('<script>'));assert.ok(preview.includes(source));
});
test('HTML imports preserve CSS and JavaScript instead of silently flattening the website',async()=>{
 const root=local(),C=root.OMNI;let saved;C.saveProject=async p=>{saved=p;};const html='<!doctype html><html><head><title>Restored</title><style>body{color:navy}</style></head><body><button>Try</button><script>document.body.dataset.ok="yes"</script></body></html>';
 const p=await C.importProject(new File([html],'site.html',{type:'text/html'}));assert.equal(saved.website.rawHtml,html);assert.equal(C.renderSite(p),html);assert.equal(p.name,'Restored');
});
test('JSON restore remaps images in chat, website and source files while preserving source code',async()=>{
 const root=local(),C=root.OMNI,F=root.OMNI_FILES,p=C.makeProject('Photo site');p.assets=[{id:'old-image',mimeType:'image/png',name:'Picture',dataUrl:'data:image/png;base64,iVBORw0KGgo='}];p.messages=[{role:'assistant',imageId:'old-image'}];p.website.rawHtml='<html><body><img src="omniforge-asset://old-image"></body></html>';p.codeWorkspace=F.fromHtml(p.website.rawHtml);
 const writes=new Map();C.saveBlob=async(id,blob)=>writes.set(id,blob);C.saveProject=async()=>{};const result=await C.importProject(new File([JSON.stringify(p)],'backup.json'));
 const id=result.assets[0].id;assert.notEqual(id,'old-image');assert.equal(result.messages[0].imageId,id);assert.match(result.website.rawHtml,new RegExp(id));assert.match(result.codeWorkspace.files['index.html'],new RegExp(id));assert.ok(writes.has(id));
});
test('A failed restore removes only its new blobs and never commits a half-restored project',async()=>{
 const root=local(),C=root.OMNI,p=C.makeProject('Incomplete');p.assets=[{id:'first',mimeType:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgo='},{id:'second',mimeType:'image/png'}];let saved=false;const created=[],removed=[];
 C.saveBlob=async id=>created.push(id);C.saveProject=async()=>{saved=true;};C.removeBlobs=async ids=>removed.push(...ids);
 await assert.rejects(C.importProject(new File([JSON.stringify(p)],'bad.json')),/missing photo/);assert.equal(saved,false);assert.equal(created.length,1);assert.deepEqual(removed,created);
});
test('Legacy project shape is normalized without changing its raw HTML',()=>{
 const C=local().OMNI,html='<html><body>Old site</body></html>',p=C.formatMigrated({id:'old',name:'Old',website:{rawHtml:html}});assert.equal(p.website.rawHtml,html);assert.ok(p.website.meta);assert.ok(p.website.theme);assert.ok(Array.isArray(p.assets));
});
