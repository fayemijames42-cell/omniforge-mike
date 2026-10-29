import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../worker.js';
import {planRequest,planGuidance,selectHistory,reviewAnswer} from '../server/nexus.js';
import {IDENTITY,VERSION} from '../server/config.js';
import {withTestPool} from './fixtures/pool.mjs';
const C=globalThis.OMNI_CONTEXT;
const html='<!doctype html><html><head><title>Sunrise Bakery</title><meta name="viewport" content="width=device-width"><style>body{background:pink}</style></head><body><h1>Sunrise Bakery</h1><p>Fresh bread.</p></body></html>';
const previous=[{role:'user',content:'Create a website for Sunrise Bakery.'},{role:'assistant',content:html}];
const request=data=>new Request('https://omniforge.test/api/chat',{method:'POST',headers:{origin:'https://omniforge.test','content-type':'application/json'},body:JSON.stringify(data)});
async function run(data,reply='Fixture conversation response.'){
 let messages,calls=0;const allow={limit:async()=>({success:true})};
 const env=await withTestPool({CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,AI:{run:async(_model,input)=>{messages=input.messages;calls++;return {response:reply};}},RESEARCH_FETCH:async()=>{throw Error('Internal context must not become an external query')}});
 const response=await worker.fetch(request(data),env);return {response,data:await response.json(),messages,calls};
}
for(const message of ['Hi','Dude.','How are you?','Never reveal your private internal code.','Who are you?','Who owns you?','Who developed you?','What is your knowledge level?','Check all your functions.','Never create a website.',"Don't edit the website.",'What website did we just create?','Check whether the website is working.']){
 test('Latest request remains conversation with a website present: '+message,()=>{
  const p=planRequest({message,currentHtml:html,history:previous,focus:'create'});
  assert.equal(p.website,false);assert.equal(p.artifact,'text');assert.notEqual(p.kind,'code');
  assert.match(planGuidance(p),/CURRENT ACTION: conversation/);
 });
}
test('Creation and edits still work after the shared history selector runs',()=>{
 const selected=selectHistory(previous);
 for(const history of [previous,selected]){
  assert.equal(planRequest({message:'Michelle, can you create a website for a bakery?',history}).action,'website-create');
  assert.equal(planRequest({message:'Make it pink.',history,currentHtml:html}).action,'website-edit');
  assert.equal(planRequest({message:'Edit the previous website.',history,currentHtml:html}).action,'website-edit');
 }
 const unrelated=[...previous,{role:'assistant',content:'A diode allows current primarily in one direction.'}];
 assert.equal(planRequest({message:'Make it simpler.',history:unrelated,currentHtml:html}).action,'chat');
});
test('Website styling and component additions include the saved source instead of creating a replacement',()=>{
 const runtime=vm.createContext({window:{},console});
 for(const file of ['context.js','workspace.js'])vm.runInContext(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),runtime);
 for(const message of ['Make the website pink.','Make my website background #000080.','Create a button for the website.','Add a contact form to the website.']){
  const route=runtime.window.OMNI_WORKSPACE.route(message,'general',true,previous);
  assert.equal(route.action,'website-edit',message);assert.equal(route.includeWebsite,true,message);
  assert.equal(planRequest({message,currentHtml:html,history:previous}).action,'website-edit',message);
 }
 assert.equal(C.websiteAction('Make the website pink.',false),'chat');
 for(const message of ['Create a responsive modern website for a bakery.','Make a new website for a bakery.','Build me a website.'])assert.equal(C.websiteAction(message,true),'website-create',message);
});
test('Mentioning a website inside a refusal, explanation, image prompt or programming task cannot replace it',()=>{
 for(const message of ['I do not want you to create a website.',"I don't want you to change the website.",'Tell me how to create a website.','The instruction says "create a website". What does it mean?'])assert.equal(planRequest({message,currentHtml:html,history:previous}).website,false,message);
 for(const message of ['Write Python code to create a website.','Create a Python script to build a website.','Write Express.js backend code for a website.']){
  const plan=planRequest({message,currentHtml:html,history:previous});assert.equal(plan.kind,'code',message);assert.equal(plan.website,false,message);
 }
 const image=planRequest({message:'Generate an image of a flying cow for my website.',currentHtml:html,history:previous});
 assert.equal(image.kind,'image');assert.equal(image.website,false);
});
test('Short follow-ups recognize saved artifact metadata without retaining repeated HTML',()=>{
 const history=[{role:'assistant',text:'Website code saved.',aiContent:'[Earlier website output; use the current project when editing.]',artifactType:'website'}];
 assert.equal(C.websiteAction('Make it pink.',true,history),'website-edit');
 assert.equal(C.websiteAction('Make it pink.',true,selectHistory(history)),'website-edit');
});
for(const message of ['Write a Node.js Express backend.','Generate Cloudflare Worker routes.','Write Python code to sort a list.','Explain this HTML code.','Write SQL for the customers table.']){
 test('Programming uses its requested runtime without activating the site builder: '+message,()=>{
  const p=planRequest({message,history:previous,currentHtml:html});
  assert.equal(p.kind,'code');assert.equal(p.website,false);assert.equal(p.research.researchMode,'none');assert.match(planGuidance(p),/never browser scripts/);
 });
}
test('All identity questions use common pre-routing Michelle guidance, without old aliases',async()=>{
 for(const message of ['Who are you?','Who owns you?','Who developed you?','What is your name?','What company owns OMNIFORGE?']){
  const result=await run({message,history:previous});
  assert.equal(result.response.status,200);assert.equal(result.calls,1);
  assert.match(result.messages[0].content,/You are Michelle/);assert.match(result.messages[0].content,/ADEN INC\./);
  assert.doesNotMatch(result.messages[0].content,/You are MIKEE|called Aden|cutoff (?:is |in )?2021/);
  assert.equal(result.messages.at(-1).content,message);
 }
 assert.equal(IDENTITY.displayName,'MICHELLE');
});
test('Provider fallback preserves the exact prepared history, active source, identity and current request',async()=>{
 const captured=[],allow={limit:async()=>({success:true})};
 const env=await withTestPool({CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,ZAI_API_KEY:'fixture-key',AI:{run:async(_m,input)=>{captured.push(input.messages);throw Error('quota exceeded');}}});
 env.POOL_FIXTURE.data.config.zai={enabled:true,freeConfirmed:true};
 env.POOL_FIXTURE.fetcher=async(_url,init)=>{captured.push(JSON.parse(init.body).messages);return Response.json({choices:[{message:{content:html},finish_reason:'stop'}]});};
 const response=await worker.fetch(request({message:'Make the website pink.',currentHtml:html,history:previous}),env);
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.provider,'zai');assert.equal(captured.length,2);
 assert.deepEqual(captured[0],captured[1]);assert.match(captured[1][0].content,/You are Michelle/);assert.equal(captured[1].at(-1).content,'Make the website pink.');
});
test('Project recall gets bounded saved-state data, not unrelated HTML or a missing-project assertion',async()=>{
 const summary=C.projectSummary({name:'Bakery Website',chatOnly:false},html);
 const result=await run({message:'Describe the current website style in words.',history:selectHistory(previous),projectContext:{...summary,secret:'MUST NOT BE FORWARDED'}});
 assert.equal(result.response.status,200);
 const sent=result.messages.map(x=>x.content).join('\n');
 assert.match(sent,/Sunrise Bakery/);assert.match(sent,/savedLocally/);assert.doesNotMatch(sent,/MUST NOT BE FORWARDED|No existing website is attached/);
 assert.doesNotMatch(sent,/<html/);assert.equal(result.messages.at(-1).content,'Describe the current website style in words.');
 assert.equal(C.projectSummary({name:'Other chat',chatOnly:true},html),null);
});
test('The authoritative edit source follows old conversation and precedes the latest request',async()=>{
 const result=await run({message:'Make the website pink.',currentHtml:html,history:previous},html);
 const sourceIndex=result.messages.findIndex(m=>m.content.startsWith('CURRENT PROJECT'));
 assert.ok(sourceIndex>1);assert.match(result.messages[sourceIndex].content,/background:pink/);
 assert.equal(result.messages.at(-1).content,'Make the website pink.');assert.equal(result.data.artifact.valid,true);
});
test('Unsolicited HTML, SVG and code fences are blocked even after conversational preambles',async()=>{
 for(const reply of ['Sure, here it is: '+html,'Okay. ```html\n'+html+'\n```','Here: <svg viewBox="0 0 10 10"><circle r="3"/></svg>','```javascript\nconsole.log("wrong task")\n```']){
  const result=await run({message:'How are you?',history:previous,focus:'code'},reply);
  assert.equal(result.data.artifact.type,'text');assert.doesNotMatch(result.data.reply,/<html|<svg|```/);
  assert.ok(result.data.quality.warnings.length);
 }
});
test('Explicit programming output is preserved and never becomes a website',async()=>{
 const reply='```js\nimport express from "express";\nconst app=express();\napp.get("/",(req,res)=>res.json({ok:true}));\napp.listen(3000);\n```';
 const result=await run({message:'Write a Node.js Express backend.',history:previous,currentHtml:html},reply);
 assert.equal(result.data.reply,reply);assert.equal(result.data.artifact.type,'text');assert.equal(result.data.orchestration.kind,'code');
});
test('Browser artifacts reject server-side code; explicit vector requests stay available',()=>{
 const invalid=html.replace('</body>','<script>import express from "express";const app=express();app.listen(3000);</script></body>');
 const reviewed=reviewAnswer(invalid,planRequest({message:'Create a website.'}));
 assert.equal(reviewed.artifact.complete,true);assert.equal(reviewed.artifact.valid,false);assert.match(reviewed.quality.warnings.join(' '),/Server-side/);
 assert.equal(planRequest({message:'Draw an SVG vector illustration of a flying cow.'}).kind,'vector');
});
test('Polite Michelle image requests use the raster workflow, not SVG chat',async()=>{
 for(const message of ['Generate an image of a flying cow.','Michelle, can you please generate an image of a flying cow?','Create a picture of a blue bird.'])assert.ok(C.imagePrompt(message),message);
 assert.equal(C.imagePrompt('Draw an SVG illustration of a cow.'),null);
 const result=await run({message:'Generate an image of a flying cow.'});
 assert.equal(result.response.status,409);assert.equal(result.data.code,'IMAGE_WORKFLOW_REQUIRED');assert.equal(result.calls,0);
});
test('Website diagnostics report exactly their static scope',()=>{
 const runtime=vm.createContext({window:{OMNI_CONTEXT:C}});
 vm.runInContext(readFileSync(new URL('../src/projectfiles.js',import.meta.url),'utf8'),runtime);
 const result=runtime.window.OMNI_FILES.inspectDocument(html);
 assert.equal(result.checks.every(x=>x.ok),true);assert.match(result.limits,/not tested/);
 const incomplete=runtime.window.OMNI_FILES.inspectDocument('<html><body>Broken');
 assert.equal(incomplete.checks[0].ok,false);
 assert.equal(C.websiteCheckRequest('Check whether the website is working.'),true);
 assert.equal(C.websiteCheckRequest('Explain how to check a website.'),false);
});
test('Health identifies this release and owner without renaming stored infrastructure',async()=>{
 const response=await worker.fetch(new Request('https://omniforge.test/api/health'),{});
 const data=await response.json();assert.equal(data.version,VERSION);assert.equal(data.identity.name,'Michelle');assert.equal(data.identity.owner,'ADEN INC.');
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.ok(config.durable_objects.bindings.some(x=>x.name==='MIKEE_POOL'&&x.class_name==='MikeeCoordinator'));
});
test('An invalid raster provider payload is a failure, never a completed image',async()=>{
 const allow={limit:async()=>({success:true})};
 const env=await withTestPool({IMAGE_VISITOR_LIMIT:allow,IMAGE_SHARED_LIMIT:allow,AI:{run:async()=>({image:'A'.repeat(200)})}});
 const response=await worker.fetch(new Request('https://omniforge.test/api/image',{method:'POST',headers:{origin:'https://omniforge.test','content-type':'application/json'},body:JSON.stringify({prompt:'A flying cow'})}),env);
 const data=await response.json();assert.equal(response.status,429);assert.notEqual(data.live,true);assert.ok(!data.image&&!data.dataUrl);assert.ok(data.attempts.some(x=>x.reason==='invalid_image'));
});
test('Preview security policy precedes scripts even in malformed saved documents',()=>{
 const runtime=vm.createContext({window:{},crypto});vm.runInContext(readFileSync(new URL('../src/core.js',import.meta.url),'utf8'),runtime);
 const guarded=runtime.window.OMNI.sandboxHTML('<html><script>fetch("https://example.invalid")</script><head><title>Example</title></head><body>Saved page</body></html>');
 assert.ok(guarded.indexOf('Content-Security-Policy')<guarded.indexOf('<script>'));
 assert.match(guarded,/connect-src 'none'/);
});
test('An actual live model self-description cannot invent a 2024 cutoff',()=>{
 const result=reviewAnswer('I am an AI assistant developed for OMNIFORGE. My knowledge level is up to 2024, as of my last update. I can help with science and writing.',planRequest({message:'What is your knowledge level?'}));
 assert.doesNotMatch(result.reply,/2024/);assert.match(result.reply,/verified training cutoff is not supplied/);assert.match(result.reply,/science and writing/);assert.ok(result.quality.checks.includes('knowledge-metadata'));
});
test('Unsupported self-reported dates are corrected without removing ordinary historical facts or code',()=>{
 const plan=planRequest({message:'Explain your training limitations.'});
 for(const reply of ['My training data ends in 2021.','I was trained on information through December 2023.','My knowledge cutoff is April 2024.'])assert.doesNotMatch(reviewAnswer(reply,plan).reply,/2021|2023|2024/);
 const history='The transistor was invented in 1947.';assert.equal(reviewAnswer(history,plan).reply,history);
 const code='```js\nconst sample="My knowledge cutoff is 2021.";\n```';assert.equal(reviewAnswer(code,planRequest({message:'Write JavaScript code.'})).reply,code);
});
test('An unsolicited artifact gets one budgeted model recovery with saved-project facts',async()=>{
 const seen=[],allow={limit:async()=>({success:true})};let clock=Date.now();
 const env=await withTestPool({CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,AI:{run:async(_m,input)=>{seen.push(input.messages);clock+=2000;return {response:seen.length===1?html:'We created the Sunrise Bakery website.'};}}});
 env.POOL_FIXTURE.now=()=>clock;
 const response=await worker.fetch(request({message:'Tell me about the current website style.',history:previous,projectContext:C.projectSummary({name:'Sunrise Bakery Website'},html)}),env);
 const data=await response.json();assert.equal(response.status,200);assert.equal(seen.length,2);assert.match(data.reply,/Sunrise Bakery/);assert.doesNotMatch(data.reply,/<html/);
 assert.equal(data.orchestration.modelAttempts,2);assert.ok(data.quality.checks.includes('format-recovery'));
 assert.ok(seen[1].some(m=>String(m.content).startsWith('ACTIVE LOCALLY SAVED PROJECT SUMMARY')));
 assert.ok(!seen[1].some(m=>m.content==='Create a website for Sunrise Bakery.'));
 assert.equal(seen[1].at(-1).content,'Tell me about the current website style.');
 assert.equal(env.POOL_FIXTURE.data.ledger.cloudflare.requests,2);
});

test('Code focus does not inject programming instructions into an ordinary identity question',async()=>{
 const result=await run({message:'Who are you?',focus:'code',history:previous});
 assert.equal(result.data.orchestration.kind,'chat');assert.match(result.messages[0].content,/CURRENT ACTION: conversation/);
 assert.doesNotMatch(result.messages[0].content,/Provide correct, minimal, testable code/);
});
test('Active-project recall reads supplied state without a model or an AI budget',async()=>{
 const summary=C.projectSummary({name:'Wrong conversation title'},html);
 const response=await worker.fetch(request({message:'What website did we just create?',projectContext:summary,history:previous}),{});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.reply,'The active website in this conversation is “Sunrise Bakery”.');
 assert.equal(data.live,false);assert.equal(data.toolOnly,true);assert.equal(data.provider,'local-project-context');assert.deepEqual(data.orchestration.toolsUsed,['project-context']);
 assert.equal(C.projectRecallQuestion('Which website is best for learning?'),false);assert.equal(C.projectRecallQuestion('What is the name of the current website?'),true);
});
