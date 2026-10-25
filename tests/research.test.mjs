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
test('Unconfigured automatic current questions answer cautiously without claiming web verification',async()=>{
 let hits=0,lookups=0,system='';
 const e={...base,RESEARCH_FETCH:async()=>{lookups++;throw Error('Should not be called')},AI:{run:async(_m,input)=>{hits++;system=input.messages[0].content;return {response:'I cannot confirm the latest change from live sources.'}}}};
 const r=await realWorker.fetch(request('What is the latest breaking technology news today?'),e);
 const payload=await r.json();
 assert.equal(r.status,200);assert.equal(hits,1);assert.equal(lookups,0);
 assert.match(system,/live web search is unavailable/i);
 assert.equal(payload.research.scope,'none');
 assert.match(payload.research.note,/current facts cannot be verified/i);
 assert.equal(payload.sources,undefined);
});
test('Explicit fresh-web research without a provider fails honestly before AI',async()=>{
 let hits=0;const env={...base,AI:{run:async()=>{hits++;return {response:'incorrect'}}}};
 const r=await realWorker.fetch(request('Search the web for the latest AI news today'),env);
 assert.equal(r.status,503);assert.equal((await r.json()).researchUnavailable,true);assert.equal(hits,0);
});
test('MIKEE automatically looks up ordinary factual questions',async()=>{
 let lookups=0,aiCalls=0;
 const e={...base,RESEARCH_FETCH:async(url)=>{
   lookups++;assert.match(String(url),/search\/page/);
   return Response.json({pages:[{key:'Diode',title:'Diode',description:'Semiconductor device',excerpt:'A diode conducts current primarily in one direction.'}]});
  },AI:{run:async(_model,input)=>{
   aiCalls++;assert.match(input.messages[0].content,/CURRENT RETRIEVAL/);
   return {response:'A diode is an electronic component. [1]'};
  }}};
 const r=await realWorker.fetch(request('What is a diode?'),e);
 const payload=await r.json();
 assert.equal(r.status,200);assert.equal(lookups,1);assert.equal(aiCalls,1);
 assert.equal(payload.research.mode,'automatic');
 assert.equal(payload.sources[0].title,'Diode');
});
test('No automatic network research for private questions or requests to build websites',async()=>{
 const sent=[];
 const env={...base,RESEARCH_FETCH:async()=>{throw Error('Unexpected search')},
 AI:{run:async(_model,input)=>{sent.push(input);return {response:'A relevant answer'}}}};
 for(const q of ['What is my email address?','Create a website for a Lagos shop','Write a story about the current president','How do I measure current through a resistor?','Go on']){
  const r=await realWorker.fetch(request(q),env);
  assert.equal(r.status,200,q);assert.equal((await r.json()).sources,undefined,q);
 }
 assert.equal(sent.length,5);
 assert.equal(sent[1].max_tokens,3000);
 assert.equal(sent[3].max_tokens,2000);
});
test('Automatic evidence retrieval failure permits clearly unverified model reply',async()=>{
 let hits=0;
 const e={...base,RESEARCH_FETCH:async()=>new Response('error',{status:500}),
 AI:{run:async(_m,input)=>{hits++;assert.match(input.messages[0].content,/did not retrieve usable sources/i);return {response:'General background only.'}}}};
 const r=await realWorker.fetch(request('What is a diode?'),e);
 assert.equal(r.status,200);assert.equal(hits,1);
 assert.equal((await r.json()).research.scope,'none');
});
test('Automatic research budget exhaustion does not block normal chat',async()=>{
 let aiCalls=0,network=0;
 const env={...base,DAILY_BUDGET:{getByName:()=>({fetch:async(_url,req)=>{
  const {kind}=JSON.parse(req.body);return Response.json({allowed:kind==='chat'});
 }})},RESEARCH_FETCH:async()=>{network++;throw Error('No search')},
 AI:{run:async(_m,input)=>{aiCalls++;assert.match(input.messages[0].content,/budget has been reached/i);return {response:'Unverified explanation'};}}};
 const r=await realWorker.fetch(request('What is a diode?'),env);
 assert.equal(r.status,200);assert.equal(aiCalls,1);assert.equal(network,0);
 assert.match((await r.json()).research.note,/budget has been reached/i);
});


test('Request intent distinguishes factual lookup from personal data and creative tasks',()=>{
 const expected=[
 ['What is a diode?',true],['Explain how solar panels work',true],
 ['Who invented the transistor?',true],['What is calculus?',true],
 ['How do I measure current through a resistor?',false],
 ['Write a website about solar panels',false],
 ['Search the web for photosynthesis',true],
 ['What is my email address?',false],
 ['I feel tired today',false],
 ['Continue',false],
 ['Who is the current president of Nigeria?',true]
 ];
 for(const [q,bool] of expected)assert.equal(researchIntent(q).requested,bool,q);
 assert.equal(researchIntent('Who is the current president of Nigeria?').fresh,true);
});

test('Directly addressed MIKEE historical question triggers automatic retrieval and citations',async()=>{
 let fetched=0,modelCalls=0,query='';
 const env={...base,RESEARCH_FETCH:async(url)=>{
  fetched++;query=new URL(url).searchParams.get('q');
  return Response.json({pages:[{title:'Transistor',key:'Transistor',
   description:'Semiconductor component',excerpt:'The transistor was invented at Bell Labs in 1947.'}]});
 },AI:{run:async(_model,input)=>{
  modelCalls++;
  assert.match(input.messages[0].content,/CURRENT RETRIEVAL/);
  return {response:'Bardeen and Brattain developed the first working point-contact transistor at Bell Labs. [1]'};
 }}};
 const userPrompt='MIKEE, who invented the transistor, and how did the invention change electronics?';
 const r=await realWorker.fetch(request(userPrompt),env),data=await r.json();
 assert.equal(r.status,200);
 assert.equal(query,'transistor');
 assert.equal(fetched,1);
 assert.equal(modelCalls,1);
 assert.equal(data.research.mode,'automatic');
 assert.equal(data.sources.length,1);
 assert.equal(data.sources[0].title,'Transistor');
});
test('MIKEE polite requests and private requests use the right path',()=>{
 for(const text of ['Hey MIKEE, who invented the transistor?','Can you tell me who invented the transistor?','MIKEE, explain how solar panels work.'])
  assert.equal(researchIntent(text).requested,true,text);
 for(const text of ['MIKEE, what is my email address?','MIKEE, create a website for my business.','I have an important medical appointment'])
  assert.equal(researchIntent(text).requested,false,text);
});
