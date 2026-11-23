import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {startLocalServer} from '../../server/local-runtime.mjs';
test('A desktop launcher can select a larger local model on an isolated loopback port',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'omniforge-desktop-'));
 await writeFile(join(folder,'index.html'),'<html><head></head><body>MICHELLE</body></html>');
 const server=startLocalServer({host:'127.0.0.1',port:0,model:'qwen3.5:9b',publicDir:folder});
 try{
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/');
  assert.equal(response.status,200);
  assert.match(await response.text(),/omniforge-local-runtime/);
  const health=await(await fetch(base+'/api/health')).json();
  assert.equal(health.model,'qwen3.5:9b');
  assert.equal(health.cloudflare,false);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await rm(folder,{recursive:true,force:true});
 }
});
