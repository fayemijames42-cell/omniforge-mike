(() => {
 'use strict';
 const api=window.omniforgeDesktop;
 const $=id=>document.getElementById(id);
 let status=null,chosen='';
 const say=(message,error=false)=>{
  $('message').textContent=message;
  $('message').classList.toggle('error',error);
 };
 function showStatus(data){
  status=data;
  const r=data.tiers.find(t=>t.id===data.recommended);
  $('machine').textContent='This device: '+data.ramGB+' GB RAM · '+data.freeGB+' GB available disk · '+data.platform+'/'+data.arch+' · local engine '+(data.engineAvailable?'ready':'not found');
  $('recommendation').textContent=r?'Suggested for this computer: '+r.name:'';
  if(!chosen)chosen=data.selected;
  $('modelCards').replaceChildren();
  data.tiers.forEach(tier=>{
   const card=document.createElement('button');
   card.type='button';card.className='model-card'+(chosen===tier.model?' selected':'');
   card.setAttribute('role','radio');card.setAttribute('aria-checked',String(chosen===tier.model));
   const title=document.createElement('strong');
   title.textContent=tier.name+(tier.id===data.recommended?' · RECOMMENDED':'');
   const details=document.createElement('span');
   details.textContent=tier.model+' · approx. '+tier.downloadGB+' GB model download · '+tier.ramGB+' GB+ RAM suggested';
   const note=document.createElement('small');note.textContent=tier.note;
   const installed=document.createElement('em');
   installed.textContent=data.installed.includes(tier.model)?'Installed ✓':tier.ramGB>data.ramGB?'May not run well on this device':'Not installed';
   card.append(title,details,note,installed);
   card.onclick=()=>{chosen=tier.model;showStatus(data)};
   $('modelCards').append(card);
  });
  const isInstalled=data.installed.includes(chosen);
  $('install').disabled=!data.engineAvailable||isInstalled;
  $('install').textContent=isInstalled?'Model installed':'Download selected AI model';
  $('open').textContent=isInstalled?'Open MICHELLE (offline ready)':'Open OMNIFORGE without AI';
  if(!data.engineAvailable)say('The local Ollama engine was not found. Use the Windows installer that bundles Ollama, or install Ollama separately. Offline notes and other tools can still open.',true);
  else if(isInstalled)say('Your selected AI model is installed. You can disconnect from the internet and use MICHELLE.');
  else say('A one-time online model download is needed. After installation, chat runs locally on your device.');
 }
 async function refresh(){
  try{showStatus(await api.status())}
  catch(error){say('Setup error: '+error.message,true)}
 }
 if(!api){say('This page must be opened inside the OMNIFORGE desktop application.',true);return;}
 api.onProgress(value=>{$('progress').textContent=value});
 $('install').onclick=async()=>{
  if(!chosen)return;
  $('install').disabled=true;$('open').disabled=true;
  $('progress').textContent='Preparing model download…';
  try{say(await api.install(chosen));await refresh()}
  catch(error){say(error.message||'Could not download model.',true)}
  finally{$('open').disabled=false; if(status)showStatus(status)}
 };
 $('open').onclick=async()=>{
  if(!chosen)return;
  $('open').disabled=true;
  try{await api.start(chosen)}
  catch(error){say('Could not open OMNIFORGE: '+error.message,true)}
  finally{$('open').disabled=false}
 };
 refresh();
})();
