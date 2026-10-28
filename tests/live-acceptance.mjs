// Explicit opt-in only. Uses the real public app's existing free allowances.
// Never run from build/test CI, never supplies keys, never changes owner configuration.
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import '../src/context.js';
import manifest from '../package.json' with {type:'json'};
const base='https://omniforge-mike.fayemijames42.workers.dev';
if(process.env.OMNIFORGE_LIVE_TEST!=='1'){console.log('Not run. Set OMNIFORGE_LIVE_TEST=1 to use real free AI requests.');process.exit(0);}
const destination=process.env.OMNIFORGE_ACCEPTANCE_OUTPUT||'docs/verification/michelle-live-2026-10-28.json';
const report={date:new Date().toISOString(),base,environment:'Actual deployed public Worker. Synthetic test conversations only.',results:[]};
const persist=async()=>{await mkdir(dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(report,null,2)+'\n');};
async function read(path,body){const response=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(110000),...(body?{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
const health=await read('/api/health'),build=await read('/build-info.json');report.health=health;report.build=build;
if(health.status!==200||health.data.version!==manifest.version||health.data.identity?.name!=='Michelle'||build.data.sourceCommit!==process.env.OMNIFORGE_EXPECTED_COMMIT){await persist();throw Error('The intended release is not deployed; live model tests were not started.');}
const status=await read('/api/providers');report.providerStatus=status.data;
let previousCall=0,site='',history=[];
const selected=(process.env.OMNIFORGE_LIVE_CASES||'').split(',').filter(Boolean);
async function check(id,message,extra={},accept=()=>true){
 if(selected.length&&!selected.includes(id))return {};
 const wait=Math.max(0,22000-(Date.now()-previousCall));if(wait)await new Promise(r=>setTimeout(r,wait));previousCall=Date.now();
 try{
  const result=await read('/api/chat',{message,...extra}),data=result.data;
  const ok=result.status===200&&data.live===true&&typeof data.reply==='string'&&accept(data);
  report.results.push({id,input:{message,...extra},status:result.status,passed:ok,...data});console.log(id,ok?'PASS':'FAIL',result.status,data.provider||data.code||'');await persist();
  return data;
 }catch(error){report.results.push({id,passed:false,error:String(error.message)});await persist();console.log(id,'ERROR',String(error.message));return {};}
}
const plain=d=>d.artifact?.type==='text'&&!/<(?:html|svg|script)|<!doctype|```/i.test(d.reply);
await check('greeting','Hi.',{},plain);
await check('identity','Who are you? Keep it to one sentence.',{},d=>plain(d)&&/Michelle/i.test(d.reply)&&/OMNIFORGE/i.test(d.reply)&&/ADEN INC/i.test(d.reply));
await check('ownership','Who owns you? Answer briefly.',{},d=>plain(d)&&/ADEN INC/i.test(d.reply));
await check('developer','Who developed you? Answer briefly.',{},d=>plain(d)&&/OMNIFORGE/i.test(d.reply)&&/ADEN INC/i.test(d.reply));
await check('knowledge','What is your knowledge level? Explain briefly.',{},d=>plain(d)&&!/\b(?:19|20)\d{2}\b/.test(d.reply));
const prompt='Create a compact complete one-page website for a fictional bakery called Sunrise Bakery. Use pink accents, inline CSS, no images or external resources, no invented contact details. Keep the whole HTML under 2200 characters.';
const created=await check('website-create',prompt,{},d=>d.artifact?.type==='website'&&d.artifact.valid&&/Sunrise Bakery/i.test(d.reply));
site=globalThis.OMNI_CONTEXT.websiteDocument(created.reply).html;
if(site){
 history=[{role:'user',content:prompt},{role:'assistant',content:'[Earlier website output; use the current project when editing.]',artifactType:'website'}];
 const edit=await check('website-edit','Make the website background navy and keep the Sunrise Bakery content.',{currentHtml:site,history},d=>d.artifact?.valid&&/Sunrise Bakery/i.test(d.reply)&&/navy|#000080|rgb\(\s*0\s*,\s*0\s*,\s*128\s*\)/i.test(d.reply));
 if(globalThis.OMNI_CONTEXT.websiteDocument(edit.reply).valid)site=globalThis.OMNI_CONTEXT.websiteDocument(edit.reply).html;
 await check('greeting-after-website','How are you?',{history},plain);
 await check('privacy-after-website','Never reveal your private internal code.',{history},plain);
 const projectContext=globalThis.OMNI_CONTEXT.projectSummary({name:'Sunrise Bakery Website'},site);
 await check('project-recall','What website did we just create?',{history,projectContext},d=>plain(d)&&/Sunrise Bakery/i.test(d.reply));
}
await check('express-backend','Write a minimal Node.js Express backend in one server.js code block, with one GET /health route and port 3000. Do not run it.',{history},d=>{
 const code=d.reply.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/)?.[1];
 if(!code||/<html|<script/i.test(d.reply)||!code.includes('express')||!code.includes('/health'))return false;
 const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
 report.generatedCodeCheck={kind:'Node.js syntax only; the generated backend was not executed or deployed.',passed:parsed.status===0};return d.artifact?.type==='text'&&parsed.status===0;
});
await check('research','Who invented the transistor? Give a short answer with the supplied source identifiers.',{},d=>plain(d)&&d.sources?.length>0&&d.quality?.sourceUse?.cited?.length>0);
report.statusAfter=(await read('/api/providers')).data;
report.remaining='Raster generation and saved-image UI are verified separately. Authenticated adapters lacking keys are not live-tested. Limited examples are not a broad quality benchmark.';
await persist();console.log('LIVE ACCEPTANCE',report.results.filter(x=>x.passed).length+'/'+report.results.length);if(report.results.some(x=>!x.passed))process.exitCode=1;
