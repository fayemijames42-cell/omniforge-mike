/* OMNIFORGE offline/local reference controls; never makes inference calls. */
(function(root){'use strict';
const K=root.OMNI_KNOWLEDGE,$=s=>document.querySelector(s),KEY='omniforge-local-mode';
let active=false;
try{active=localStorage.getItem(KEY)==='true'}catch{}
function isOffline(){return active}
function setOffline(value){
 active=!!value;
 try{localStorage.setItem(KEY,String(active))}catch{}
 renderMode();
}
function renderMode(){
 const button=$('#modeToggle');
 if(!button)return;
 button.textContent=active?'◈ Local knowledge':'☁ Cloud AI';
 button.classList.toggle('local-active',active);
 button.setAttribute('aria-pressed',String(active));
 button.title=active?'Only stored information. No AI model is used.':'Try Cloudflare Workers AI for the next question.';
 const status=document.querySelector('.status span');
 if(active&&status)status.textContent='LOCAL KNOWLEDGE · NO AI';
 const hint=$('#composerHint');
 if(active&&hint)hint.textContent='Stored answers only · no AI';
 else if(hint&&hint.textContent==='Stored answers only · no AI')hint.textContent='Changes stay on this device';
}
function toast(value){
 const host=$('#toast');if(!host)return;
 host.textContent=String(value);host.style.display='block';
 setTimeout(()=>{if(host.textContent===String(value))host.style.display='none'},4500);
}
const enc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function updateStatus(){
 const status=$('#memoryStatus');if(!status)return;
 try{
  const stats=await K.stats(),size=n=>n==null?'unknown':(n/1048576).toFixed(1)+' MB';
  status.textContent=stats.records+' saved knowledge entries. Browser storage: '+size(stats.usage)+' used (estimated quota '+size(stats.quota)+'). Last bundled check: '+(stats.checkedAt?new Date(stats.checkedAt).toLocaleString():'not yet')+'.';
 }catch(e){status.textContent='Knowledge storage unavailable: '+e.message}
}
async function fileImport(event){
 const files=[...(event.target.files||[])];let count=0;
 try{for(const f of files)count+=await K.importFile(f);await updateStatus();toast('Imported '+count+' XML records on this device.')}
 catch(e){toast('XML import error: '+e.message)}
 finally{event.target.value=''}
}
async function saveMemory(){
 try{
  const question=$('#memoryQuestion').value.trim(),answer=$('#memoryAnswer').value.trim();
  await K.addRecord({question,answer,source:'User-entered local reference',kind:'personal'});
  $('#memoryQuestion').value='';$('#memoryAnswer').value='';
  await updateStatus();toast('Knowledge saved locally. Not independently verified.');
 }catch(e){toast(e.message)}
}
async function exportMemory(){
 const data=await K.list();
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<knowledge>\n'+data.map(e=>'  <entry id="'+enc(e.id)+'"><question>'+enc(e.question)+'</question><answer>'+enc(e.answer)+'</answer><tags>'+enc(e.tags)+'</tags><source>'+enc(e.source)+'</source></entry>').join('\n')+'\n</knowledge>\n';
 if(!root.OMNI?.download)throw Error('Download helper unavailable.');
 root.OMNI.download(new Blob([xml],{type:'application/xml;charset=utf-8'}),'omniforge-knowledge.xml');
 toast('Knowledge XML exported.');
}
async function saveReply(event){
 const button=event.target.closest('[data-memory-id]');if(!button)return;
 event.preventDefault();
 try{
  const project=root.OMNI_TEST?.getProject(),msgs=project?.messages||[];
  const index=msgs.findIndex(m=>m.id===button.dataset.memoryId);
  if(index<0)throw Error('Reply not available.');
  const assistant=msgs[index],question=msgs.slice(0,index).reverse().find(m=>m.role==='user');
  if(!question||assistant.engine!=='WORKERS AI')throw Error('No eligible question/answer pair.');
  if(assistant.text.length>6000||/<html|<!doctype/i.test(assistant.text))throw Error('Use short plain-text answers only.');
  await K.addRecord({question:question.text,answer:assistant.text,source:'User-saved MIKEE reply (not verified)',kind:'saved-ai'});
  await updateStatus();toast('Remembered on this device. AI answers should be checked for accuracy.');
 }catch(e){toast('Could not save memory: '+e.message)}
}
function bind(){
 $('#modeToggle')?.addEventListener('click',()=>{
  setOffline(!active);toast(active?'Local knowledge on — no model requests.':'Cloud AI selected for your next message.');
 });
 $('#memoryCheck')?.addEventListener('click',async()=>{
  const result=await K.syncBundled({force:true});
  await updateStatus();toast(result.status==='updated'?'Built-in reference refreshed.':'Update status: '+result.status);
 });
 $('#memoryImport')?.addEventListener('change',fileImport);
 $('#memorySave')?.addEventListener('click',saveMemory);
 $('#memoryExport')?.addEventListener('click',()=>exportMemory().catch(e=>toast(e.message)));
 $('#memoryPersist')?.addEventListener('click',async()=>{
  if(!navigator.storage?.persist){toast('Persistent storage is not available. Export your knowledge.');return}
  const permitted=await navigator.storage.persist().catch(()=>false);
  toast(permitted?'Persistent browser storage granted; keep backups.':'Storage persistence not granted; save XML backups.');
 });
 document.addEventListener('click',saveReply);
 renderMode();
 void K.syncBundled().then(updateStatus).catch(()=>{});
 setInterval(()=>{void K.syncBundled().then(updateStatus).catch(()=>{})},3600000);
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
}
root.OMNI_OFFLINE_UI={isOffline,setOffline,updateStatus};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
