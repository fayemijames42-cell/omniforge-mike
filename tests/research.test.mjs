import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchIntent,collectEvidence,evidenceText} from '../research.js';
import realWorker from '../worker.js';
const wiki=async(url,opts)=>{
 assert.match(String(url),/^https:\/\/en\.wikipedia\.org\/w\/rest\.php\/v1\/search\/page\?/);
 assert.equal(opts.redirect,'error');
 return Response.json({pages:[
  {key:'Photosynthesis',title:'Photosynthesis',excerpt:'<span class="searchmatch">Photosynthesis</span> is the process by which plants transform light energy.',description:'Biological process'},
  {key:'Chlorophyll',title:'Chlorophyll',excerpt:'Green pigment in plants.',description:'Plant pigment'}]});
};
const tavily=async(url,opts)=>{
 assert.equal(url,'https://api.tavily.com/search');
 assert.equal(opts.method,'POST');assert.match(opts.headers.Authorization,/^Bearer tvly-test/);
 const payload=JSON.parse(opts.body);assert.equal(payload.max_results,4);assert.equal(payload.include_raw_content,false);
 return Response.json({results:[
  {title:'Cloudflare documentation',url:'https://developers.cloudflare.com/workers-ai/',content:'Workers AI docs describe AI on Cloudflare.',score:0.9},
  {title:'Invalid source',url:'http://localhost/private',content:'Do not display localhost'}]});
};
test('Only intentional research or freshness requests enter the search path',()=>{
 assert.equal(researchIntent('Explain what a diode is').requested,false);
 assert.equal(researchIntent('Make a website for a local business').requested,false);
 assert.deepEqual(Object.keys(researchIntent('Search the web for photosynthesis')),['requested','fresh','query']);
 assert.equal(researchIntent('Search the web for photosynthesis').query,'photosynthesis');
 assert.equal(researchIntent('Who is the current president?').fresh,true);
});
test('Keyless Wikipedia reference lookup yields bounded HTTPS sources and retrieval metadata',async()=>{
 const r=await collectEvidence('Search the web for photosynthesis',{},wiki);
 assert.equal(r.scope,'wikipedia');assert.equal(r.sources.length,2);
 assert.equal(r.sources[0].url,'https://en.wikipedia.org/wiki/Photosynthesis');
 assert.ok(r.sources[0].excerpt.includes('Photosynthesis is the process'));
 assert.ok(evidenceText(r).includes('[1] Photosynthesis'));
 assert.ok(r.retrievedAt.includes('T'));
});
test('Unconfigured fresh research fails honestly without external fetch',async()=>{
 let calls=0;
 const r=await collectEvidence('Search the web for latest AI changes',{},async()=>{calls++;return Response.json({})});
 assert.equal(r.sources.length,0);assert.equal(r.scope,'encyclopedia-only');assert.ok(r.error.includes('not configured'));
 assert.equal(calls,0);
});
test('Optional Tavily is server-side and filters insecure links',async()=>{
 const r=await collectEvidence('Search the web for latest Cloudflare AI news',{TAVILY_API_KEY:'tvly-test-123456'},tavily);
 assert.equal(r.scope,'web-search');assert.equal(r.sources.length,1);
 assert.equal(r.sources[0].publisher,'developers.cloudflare.com');
});
test('Search failures produce no invented results',async()=>{
 const r=await collectEvidence('Search the web for photosynthesis',{},async()=>new Response('no',{status:500}));
 assert.equal(r.sources.length,0);assert.ok(r.error.includes('failed'));
});
const allow={limit:async()=>({success:true})};
const budget={getByName:()=>({fetch:async()=>Response.json({allowed:true})})};
const base={CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,DAILY_BUDGET:budget,AI:{run:async()=>({response:'Photosynthesis converts light into chemical energy. [1]'})},RESEARCH_FETCH:wiki};
const request=m=>new Request('https://mikee.test/api/chat',{method:'POST',headers:{origin:'https://mikee.test'},body:JSON.stringify({message:m})});
test('MIKEE web-backed chat returns references and uses exactly one model call',async()=>{
 let hits=0;
 const env={...base,AI:{run:async(_model,input)=>{hits++;assert.ok(input.messages[0].content.includes('Wikipedia'));return {response:'Plants convert sunlight to chemical energy. [1]'}}}};
 const r=await realWorker.fetch(request('Search the web for photosynthesis'),env);
 const payload=await r.json();
 assert.equal(r.status,200);assert.equal(payload.research.scope,'wikipedia');assert.equal(payload.sources.length,2);assert.equal(hits,1);
});
test('MIKEE refuses to pretend live current research is connected',async()=>{
 let hits=0;const env={...base,AI:{run:async()=>{hits++;return {response:'not allowed'}}}};
 const r=await realWorker.fetch(request('What is the latest breaking technology news today?'),env);
 assert.equal(r.status,503);assert.equal((await r.json()).researchUnavailable,true);assert.equal(hits,0);
});
