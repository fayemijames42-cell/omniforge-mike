// One-time public production acceptance; real providers, synthetic data, no credentials.
import {writeFile,mkdir} from 'node:fs/promises';
import '../src/context.js';
const base='https://omniforge-mike.fayemijames42.workers.dev';
const expected=['dbb49499cd2191328cba5e75f3f96c33b45cbcd7','4a6c0615fa37a084218aa05a884936be230770b0'];
const output='docs/verification/one-shot-live-2026-10-30.json';
const report={at:new Date().toISOString(),base,checks:[],expected};
let failed=false,lastChat=0;
async function save(){await mkdir('docs/verification',{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
async function req(path,body){
 const res=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(105000),
  ...(body?{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)}:{})});
 return {status:res.status,data:await res.json()};
}
async function chat(name,message,context={}){
 if(lastChat&&Date.now()-lastChat<25000)await new Promise(r=>setTimeout(r,25000-(Date.now()-lastChat)));
 lastChat=Date.now();
 try{
  const {status,data}=await req('/api/chat',{message,...context});
  const item={name,status,provider:data.provider||null,live:data.live===true,code:data.code||null,
   artifact:data.artifact?.type||null,valid:data.artifact?.valid===true,diagnostics:data.diagnostics||null,
   excerpt:typeof data.reply==='string'?data.reply.slice(0,130):null};
  report.checks.push(item);await save();console.log('CHAT',name,status,item.provider||item.code||'none');
  return {status,data};
 }catch(e){report.checks.push({name,error:e.name==='TimeoutError'?'timeout':'network_error'});await save();return null;}
}
try{
 const [health,build,providers]=await Promise.all([req('/api/health'),req('/build-info.json'),req('/api/providers')]);
 report.health={status:health.status,version:health.data.version,identity:health.data.identity,aiBound:health.data.aiBound};
 report.build={status:build.status,version:build.data.version,sourceCommit:build.data.sourceCommit,buildId:build.data.buildId};
 report.providers=(providers.data.providers||[]).filter(x=>x.capabilities?.includes('chat')).map(x=>({name:x.name,state:x.state}));
 await save();console.log('METADATA',JSON.stringify({health:report.health,build:report.build}));
 if(health.status!==200||build.status!==200||!expected.includes(build.data.sourceCommit)){report.stopped='Unexpected production version';failed=true;}
 else{
  const prompt='Create a compact complete HTML website for Sunrise Bakery with a Sunrise Bakery heading, the text Fresh bread daily, and an orange background. Use inline CSS, no images or external resources. Keep HTML under 1700 characters.';
  const create=await chat('website-create',prompt);
  let html='';
  if(create?.status===200&&create.data.live===true&&create.data.artifact?.type==='website'&&create.data.artifact.valid===true){
   const parsed=globalThis.OMNI_CONTEXT.websiteDocument(create.data.reply);
   if(parsed.valid&&/Sunrise Bakery/i.test(parsed.html))html=parsed.html;
  }
  report.websiteCreationPassed=!!html;
  if(html){
   const history=[{role:'user',content:prompt},{role:'assistant',content:'[Earlier website output; use the current project when editing.]',artifactType:'website'}];
   const edit=await chat('website-edit','Make the Sunrise Bakery website background pink (#ffc0cb) and preserve the heading and Fresh bread daily.',{currentHtml:html,history});
   const parsed=globalThis.OMNI_CONTEXT.websiteDocument(edit?.data?.reply||'');
   report.websiteEditPassed=!!(edit?.status===200&&edit.data.artifact?.valid===true&&parsed.valid&&/Sunrise Bakery/i.test(parsed.html)&&/Fresh bread daily/i.test(parsed.html)&&/(#ffc0cb|pink|rgb\(\s*255\s*,\s*192\s*,\s*203\s*\))/i.test(parsed.html));
   const greet=await chat('conversation-after-website','How are you?',{history});
   report.conversationPassed=!!(greet?.status===200&&greet.data.artifact?.type==='text'&&!/<html|<!doctype|<svg/i.test(greet.data.reply||''));
  } else {report.websiteEditPassed=null;report.conversationPassed=null;}
  if(!report.websiteCreationPassed||report.websiteEditPassed===false||report.conversationPassed===false)failed=true;
  try{
   const {status,data}=await req('/api/image',{prompt:'A realistic flying cow above green farmland under a bright blue sky.'});
   const raw=String(data.image||data.dataUrl||'');
   const prefix=raw.includes('base64,')?raw.split('base64,')[1].slice(0,24):raw.slice(0,24);
   const jpg=Buffer.from(prefix,'base64').subarray(0,3).equals(Buffer.from([255,216,255]));
   report.image={status,provider:data.provider||null,code:data.code||null,live:data.live===true,validJpeg:jpg,bytesBase64:raw.length,queued:!!data.jobId,diagnostics:data.diagnostics||null};
   report.imagePassed=status===200&&data.live===true&&jpg;
   if(!report.imagePassed)failed=true;
   console.log('IMAGE',status,report.image.provider||report.image.code||'none',jpg?'JPEG':'NO_JPEG');
  }catch(e){report.image={error:e.name==='TimeoutError'?'timeout':'network_error'};report.imagePassed=false;failed=true;}
 }
}catch(e){report.fatal=(e?.name==='TimeoutError'?'timeout':String(e?.message||e)).slice(0,180);failed=true;}
report.complete=true;report.overallPassed=!failed;await save();
console.log('LIVE RESULT',JSON.stringify({passed:report.overallPassed,website:report.websiteCreationPassed,edit:report.websiteEditPassed,chat:report.conversationPassed,image:report.imagePassed,stopped:report.stopped||null}));
if(failed)process.exitCode=1;
