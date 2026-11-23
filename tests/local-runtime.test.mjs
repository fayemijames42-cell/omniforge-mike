import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalHandler} from '../server/local-runtime.mjs';

async function withRuntime(fetchMock,callback){
  const directory=await mkdtemp(join(tmpdir(),'omniforge-offline-test-'));
  await writeFile(join(directory,'index.html'),'<html><head><title>OMNIFORGE</title></head><body>Local workspace</body></html>');
  const srv=createServer(createLocalHandler({publicDir:directory,model:'qwen2.5:0.5b',ollamaFetch:fetchMock}));
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  try{await callback('http://127.0.0.1:'+srv.address().port)}finally{await new Promise(resolve=>srv.close(resolve));await rm(directory,{recursive:true,force:true});}
}
const fake=(url,opts)=>{
  assert.match(url,/^http:\/\/127\.0\.0\.1:11434\/api\//);
  if(url.endsWith('/tags'))return Promise.resolve(Response.json({models:[{name:'qwen2.5:0.5b'}]}));
  const payload=JSON.parse(opts.body);
  assert.equal(payload.model,'qwen2.5:0.5b');
  assert.equal(payload.stream,false);
  assert.equal(payload.messages.at(-1).content,'Hello, Michelle');
  return Promise.resolve(Response.json({message:{content:'Hello! I am a local model.'}}));
};
test('Local runtime serves workspace, identifies local model and uses no paid endpoint',async()=>{
  await withRuntime(fake,async base=>{
    const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/omniforge-local-runtime/);
    const status=await (await fetch(base+'/api/health')).json();assert.equal(status.cloudflare,false);assert.equal(status.modelReady,true);
    const providers=await (await fetch(base+'/api/providers')).json();assert.equal(providers.localOnly,true);assert.equal(providers.providers[0].state,'ready');
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Hello, Michelle'})});
    assert.equal(r.status,200);const data=await r.json();assert.equal(data.live,true);assert.equal(data.provider,'local-ollama');assert.equal(data.reply,'Hello! I am a local model.');
  });
});
test('Unconfigured offline model is reported, not fabricated',async()=>{
  await withRuntime(()=>Promise.reject(Error('offline')),async base=>{
    const status=await (await fetch(base+'/api/health')).json();assert.equal(status.modelReady,false);
    const providers=await(await fetch(base+'/api/providers')).json();assert.equal(providers.providers[0].state,'needs_model');
    const response=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Hello'})});
    assert.equal(response.status,503);assert.equal((await response.json()).code,'LOCAL_MODEL_UNAVAILABLE');
  });
});
test('API is local-only and unsupported features clearly disclose limitations',async()=>{
  await withRuntime(fake,async base=>{
    assert.equal((await fetch(base+'/api/image',{method:'POST'})).status,501);
    const denied=await fetch(base+'/api/chat',{method:'POST',headers:{origin:'https://malicious.example','content-type':'application/json'},body:JSON.stringify({message:'Hello'})});
    assert.equal(denied.status,403);
    const missing=await fetch(base+'/missing.txt');assert.equal(missing.status,404);
    const invalid=await fetch(base+'/api/chat',{method:'POST',body:'invalid'});assert.equal(invalid.status,400);
  });
});

test('Complex tasks get two local inference passes and honest metadata',async()=>{
  const calls=[];const fakeReview=async (url,opts)=>{
    assert.match(url,/^http:\/\/127\.0\.0\.1:11434\/api\/chat$/);
    calls.push(JSON.parse(opts.body));
    return Response.json({message:{content:calls.length===1?'Draft about storage.':'IndexedDB uses browser object stores; SQLite uses relational tables.'}});
  };
  await withRuntime(fakeReview,async base=>{
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({message:'Compare SQLite and IndexedDB, then explain the tradeoffs.'})});
    assert.equal(r.status,200);const data=await r.json();
    assert.equal(data.reasoning.mode,'careful');assert.equal(data.reasoning.passes,2);
    assert.equal(data.reasoning.selfReviewed,true);assert.equal(data.reasoning.factChecked,false);
    assert.equal(calls.length,2);assert.match(data.reply,/relational tables/);
  });
});
test('Failed local self-review keeps draft',async()=>{
  let calls=0;
  await withRuntime(async()=>++calls===1?Response.json({message:{content:'Useful first draft.'}}):Promise.reject(Error('Unavailable')),async base=>{
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({message:'Carefully analyse this architecture.'})});
    assert.equal(r.status,200);const data=await r.json();
    assert.equal(data.reply,'Useful first draft.');assert.equal(data.reasoning.selfReviewed,false);
  });
});
test('Arithmetic goes through a deterministic local parser without a model call',async()=>{
  let called=0;
  await withRuntime(()=>{called++;throw Error('Model called');},async base=>{
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({message:'Calculate (12 + 8) * 3^2'})});
    assert.equal(r.status,200);const data=await r.json();
    assert.equal(data.reply,'(12 + 8) * 3^2 = 180');
    assert.equal(data.provider,'local-calculator');assert.equal(data.toolOnly,true);
    assert.equal(called,0);
  });
});
test('Incomplete review cannot replace complete website HTML',async()=>{
  let count=0;const html='<!doctype html><html><head><title>Demo</title></head><body>Demo</body></html>';
  await withRuntime(async()=>Response.json({message:{content:++count===1?html:'Looks good.'}}),async base=>{
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Create a website for a library'})});
    assert.equal(r.status,200);const data=await r.json();
    assert.equal(data.reply,html);assert.equal(data.artifact.type,'website');assert.equal(data.reasoning.selfReviewed,false);
  });
});
test('Null JSON input returns validation error instead of HTTP 500',async()=>{
  await withRuntime(fake,async base=>{
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:'null'});
    assert.equal(r.status,400);
  });
});

test('Pro desktop model uses non-thinking Qwen inference without remote dependencies',async()=>{
 let calls=0;
 const directory=await mkdtemp(join(tmpdir(),'omniforge-desktop-pro-'));
 const server=createServer(createLocalHandler({publicDir:directory,model:'qwen3.5:9b',ollamaFetch:(url,options)=>{
   if(url.endsWith('/tags'))return Promise.resolve(Response.json({models:[{name:'qwen3.5:9b'}]}));
   const data=JSON.parse(options.body);
   assert.equal(data.model,'qwen3.5:9b');
   assert.equal(data.think,false);
   assert.equal(data.options.num_ctx,8192);
   assert.equal(data.options.num_predict,2400);
   calls++;
   return Promise.resolve(Response.json({message:{content:'A local Qwen response.'}}));
 }}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
   const base='http://127.0.0.1:'+server.address().port;
   const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Explain circuits'})});
   assert.equal(r.status,200);
   assert.equal((await r.json()).reply,'A local Qwen response.');
   assert.equal(calls,1);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true})}
});
