import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {DailyBudget} from '../worker.js';
import {referenceSnapshot,updateReferenceBank} from '../server/reference-bank.js';

function makeStorage() {
  const data = new Map();
  const access = {
    async get(key){return structuredClone(data.get(key));},
    async put(key,value){data.set(key,structuredClone(value));},
  };
  let pending = Promise.resolve();
  return {...access,transaction(fn){
    const result = pending.then(()=>fn(access));
    pending = result.catch(()=>{});
    return result;
  }};
}

const day = Date.parse('2026-11-14T02:15:00Z');
const oneDay = 86400000;
const extract = 'A selected public article with a long enough introductory extract to test reference storage and attribution.';
function article(title='Mathematics', pageid=31, lastrevid=40) {
  return {title,pageid,lastrevid,extract};
}
function wikipedia(pages,redirects) {
  return Response.json({query:{pages,redirects}});
}

test('Daily reference update fetches the fixed public selection once and exposes attributed records',async()=>{
  const state={storage:makeStorage()};
  let calls=0;
  const fetcher=async(url,init)=>{
    calls++;
    const request=new URL(url);
    assert.equal(request.origin,'https://en.wikipedia.org');
    assert.equal(request.pathname,'/w/api.php');
    assert.equal(request.searchParams.get('explaintext'),'1');
    assert.equal(request.searchParams.get('titles').split('|').length,8);
    assert.ok(request.searchParams.get('titles').includes('Satoru Gojo'));
    assert.match(init.headers['User-Agent'],/OMNIFORGE-Reference/);
    return wikipedia([article(),article('Unexpected user topic',32,41),article('Physics',33,42)]);
  };
  const concurrency=await Promise.all([
    updateReferenceBank(state,fetcher,day,()=>day),
    updateReferenceBank(state,fetcher,day,()=>day),
  ]);
  assert.equal(calls,1);
  assert.deepEqual(concurrency.map(x=>x.status).sort(),['already-attempted','updated']);
  const snapshot=await referenceSnapshot(state);
  assert.equal(snapshot.updatedAt,new Date(day).toISOString());
  assert.equal(snapshot.attemptedBy,'scheduled');
  assert.equal(snapshot.license,'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.deepEqual(snapshot.entries.map(x=>x.question),['Mathematics','Physics']);
  assert.equal(snapshot.entries[0].url,'https://en.wikipedia.org/w/index.php?oldid=40');
  assert.equal(snapshot.entries[0].retrievedAt,new Date(day).toISOString());
});

test('A throttled refresh keeps the last good references and waits for Retry-After',async()=>{
  const state={storage:makeStorage()};
  const first=async()=>wikipedia([article()]);
  await updateReferenceBank(state,first,day,()=>day);
  const original=await referenceSnapshot(state);
  let failed=0;
  const later=day+oneDay;
  assert.equal((await updateReferenceBank(state,async()=>{
    failed++;
    return new Response('',{status:429,headers:{'retry-after':String(2*oneDay/1000)}});
  },later,()=>later)).status,'unavailable');
  assert.equal((await updateReferenceBank(state,()=>{throw Error('Unexpected upstream call');},later+oneDay,()=>later+oneDay)).status,'already-attempted');
  assert.equal(failed,1);
  const retained=await referenceSnapshot(state);
  assert.deepEqual(retained.entries,original.entries);
  assert.equal(retained.updatedAt,original.updatedAt);
  assert.equal(retained.status,'unavailable');
  const recovered=later+2*oneDay;
  await updateReferenceBank(state,async()=>wikipedia([article('Mathematics',31,88),article('Nigeria',82,93)]),recovered,()=>recovered);
  const refreshed=await referenceSnapshot(state);
  assert.equal(refreshed.status,'updated');
  assert.equal(refreshed.entries.find(item=>item.question==='Mathematics').url,'https://en.wikipedia.org/w/index.php?oldid=88');
});

test('Public read and scheduled update use a separate Durable Object instance and no inference',async()=>{
  let outbound=0;
  const names=[];
  const storage=makeStorage();
  const database=new DailyBudget({storage},{REFERENCE_FETCH:async()=>{
    outbound++;
    return wikipedia([article()]);
  }});
  const env={DAILY_BUDGET:{getByName(name){
    names.push(name);
    return {fetch:request=>database.fetch(request)};
  }},AI:{run(){assert.fail('Reference refresh does not spend AI quota');}}};
  const route='https://unit.test/api/reference-bank';
  const response=await worker.fetch(new Request(route),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'public, max-age=300');
  const first=await response.json();
  assert.equal(first.entries.length,1);
  assert.equal(first.attemptedBy,'initial-download');
  assert.equal((await worker.fetch(new Request(route,{method:'POST'}),env)).status,405);
  assert.equal((await worker.fetch(new Request(route),{})).status,503);
  let work;
  worker.scheduled({scheduledTime:Date.now()+oneDay},env,{waitUntil(value){work=value;}});
  assert.equal((await work).status,'updated');
  assert.equal((await referenceSnapshot({storage})).attemptedBy,'scheduled');
  assert.equal(outbound,2);
  assert.deepEqual(names,['omniforge-public-reference-v1','omniforge-public-reference-v1']);
  assert.equal(await storage.get('research'),undefined);
});

test('Cloud capacity errors can return already-retrieved Wikipedia excerpts without asserting inference',async()=>{
  const permit={limit:async()=>({success:true})};
  const env={
    CHAT_VISITOR_LIMIT:permit,CHAT_SHARED_LIMIT:permit,
    DAILY_BUDGET:{getByName:()=>({fetch:async()=>Response.json({allowed:true})})},
    RESEARCH_FETCH:async()=>Response.json({pages:[{key:'Mathematics',title:'Mathematics',excerpt:extract}]}),
    MIKEE_POOL:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({error:'Capacity exhausted'},{status:429,headers:{'retry-after':'120'}})})},
  };
  const response=await worker.fetch(new Request('https://unit.test/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'What is mathematics?'})}),env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.live,false);
  assert.equal(body.toolOnly,true);
  assert.equal(body.provider,'reference-retrieval');
  assert.equal(body.cloudRetryAfter,120);
  assert.deepEqual(body.sources.map(x=>x.title),['Mathematics']);
  assert.equal(body.sources[0].excerpt,extract);
});
