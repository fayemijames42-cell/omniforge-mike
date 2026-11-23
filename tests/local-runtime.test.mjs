import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalHandler} from '../server/local-runtime.mjs';

async function withRuntime(fetchMock,callback){
  const directory=await mkdtemp(join(tmpdir(),'omniforge-offline-test-'));
  await writeFile(join(directory,'index.html'),'<title>OMNIFORGE</title>');
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
    const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/OMNIFORGE/);
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
