/* OMNIFORGE mobile UI - local/manual MVP. No fabricated AI or hosted uploads. */
(function(){'use strict';const C=window.OMNI,W=window.OMNI_WORKSPACE,F=window.OMNI_FILES,Pool=window.MIKEE_POOL;const $=s=>document.querySelector(s);
if(!C||!W||!F||!window.OMNI_CONTEXT||!window.OMNI_CALC)return;
const mobileLayout=matchMedia('(max-width: 800px)');
let project=null,activeView='preview',mobileView=mobileLayout.matches?'chat':'preview',preferences={name:'MICHELLE'},selectedAsset=null,originalURL=null,previewToken=0,queue=Promise.resolve(),aiState='AI — NOT TESTED YET',requestPending=false,messageQueued=false,pendingStartedAt=0,pendingTimer=null,pendingKind='message',pendingImage=null,activeAbort=null,imageJob=null,providerRetryUntil={chat:0,image:0,audio:0,reference:0};
const ui={chat:$('#chatStream'),chips:$('#chips'),edit:$('#editControls'),grid:$('#assetGrid'),photoEditor:$('#photoEditor'),frame:$('#siteFrame'),previewEmpty:$('#previewEmpty'),select:$('#projectSelect')};
const E=C.esc, uid=C.uuid, K=window.OMNI_KNOWLEDGE;const imagePreviewURLs=new Set(), photoURLs=new Set();let photoRender=0;function notify(s){const t=$('#toast');t.textContent=s;t.style.display='block';clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>t.style.display='none',3600)}
function fail(e){const msg=e?.name==='QuotaExceededError'?'Device storage is full. Export a backup, remove unused photos, then try again.':e?.message||String(e);notify(msg);console.warn('OMNIFORGE action failed',e?.code==='PROJECT_CONFLICT'?'PROJECT_CONFLICT':e?.name||'Error')}
function providerFailureDetails(error){
 if(!['FREE_POOL_WAIT','FREE_POOL_NOT_CONNECTED','FREE_POOL_REQUEST_TOO_LARGE'].includes(error?.code))return '';
 const lines=[];
 if(error.sharedDiagnostic)lines.push('Shared limit: '+error.sharedDiagnostic);
 const providers=Array.isArray(error.providerDiagnostics)?error.providerDiagnostics:[];
 for(const item of providers.slice(0,5))lines.push(item.provider+': '+item.reason+(item.retryAt?' · '+new Date(item.retryAt).toLocaleString():''));
 if(!lines.length)lines.push('Detailed provider reasons were not supplied by the server.');
 const seconds=Number(error.retryAfter);
 if(error.code==='FREE_POOL_WAIT'&&Number.isFinite(seconds)&&seconds>0){
  lines.push('Earliest retry across connected services: '+new Date(Date.now()+seconds*1000).toLocaleString()+'.');
  if(providers.some(item=>/daily free usage limit reached|daily free usage limit|daily budget/i.test(item.reason)))lines.push('Services at their daily limit cannot respond until their separate daily allowance resets.');
 }
 if(error.code==='FREE_POOL_NOT_CONNECTED')lines.push('An owner must connect an eligible free AI provider.');
 return '\n\nAI provider checks (no credentials):\n'+lines.join('\n');
}
function queued(fn){queue=queue.catch(()=>{}).then(fn).catch(recoverAction);return queue}
async function recoverAction(error){
 if(error?.code==='PROJECT_CONFLICT'&&project?.id===error.projectId){
  try{
   await activate(error.projectId,undefined,{preserveDraft:true});
   if(!project){fail(Error('This conversation was deleted in another tab. Open another conversation or start a new chat.'));return}
  }catch(loadError){fail(loadError);return}
 }
 fail(error);
}
function conversationDraft(){
 if(project)return C.clone(project);
 const draft=C.makeProject('New Chat');
 draft.chatOnly=true;
 return draft;
}
async function saveConversation(draft){
 const isNew=project?.id!==draft.id;
 project=await C.saveProject(draft);
 if(isNew)await C.setPref('lastProjectId',project.id).catch(fail);
}
function clearSubmittedPrompt(text){
 const prompt=$('#prompt');
 if(prompt.value.trim()===text)prompt.value='';
}
function queueMessage(text){
 if(requestPending||messageQueued||!text.trim())return;
 messageQueued=true;
 queued(async()=>{
  try{await send(text)}finally{messageQueued=false}
 });
}
function autoChatTitle(input){
 let s=String(input||'').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
 if(!s||/^(hi|hello|hey|yo|ok|okay|thanks|thank you|good morning|good afternoon)[!.,? ]*$/i.test(s))return '';
 s=s.replace(/^(?:hi|hello|hey)[!,.\s]+/i,'').replace(/^(?:(?:michelle|mikee|please)[!,.:\s]+|can you\s+|could you\s+|would you\s+|i (?:want|need) (?:you )?to\s+|help me (?:to |with )?)/i,'');
 const website=s.match(/(?:website|landing page|webpage)\s+(?:for|called|about)\s+([a-z0-9][a-z0-9 -]{2,40})/i);
 if(website)return (website[1].split(/[.,!?;:]/)[0].trim().split(/\s+/).slice(0,3).join(' ')+' Website').slice(0,60);
 s=s.replace(/^(?:explain|tell me about|teach me about|what is|what are|how do i|how can i|write about|research|summarize|study)\s+/i,'').replace(/^(?:a|an|the)\s+/i,'');
 return s.replace(/[.!?]+$/,'').split(/\s+/).slice(0,7).join(' ').slice(0,60)||'New Chat';
}

/* Format model text safely. No remote Markdown scripts or third-party dependencies. */
function formatReply(text){
 return String(text||'').split(/(```[\s\S]*?```)/g).map(part=>{
  const block=part.match(/^```[^\n]*\n([\s\S]*?)```$/);
  if(block)return '<pre><code>'+E(block[1])+'</code></pre>';
  return E(part).replace(/\*\*([^*\n]+)\*\*/g,'<strong class="formatted-bold">$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
 }).join('');
}
function saveChatTranscript(){
 if(!project?.messages?.length)throw Error('There are no messages to export yet.');
 const transcript=['# '+project.name,'','OMNIFORGE · Conversation export','',...(project.messages||[]).flatMap(m=>[(m.role==='user'?'## You':'## MICHELLE')+(m.engine?' ('+m.engine+')':''),'',String(m.text||''),''])].join('\n');
 const name=String(project.name||'conversation').replace(/[^a-z0-9 -]/gi,'').replace(/\s+/g,'-').slice(0,55)||'conversation';
 C.download(new Blob([transcript],{type:'text/markdown;charset=utf-8'}),name+'-chat.md');
 notify('Conversation exported as Markdown.');
}
async function renderChatSearch(){
 const q=$('#chatSearchInput').value.trim().toLowerCase();
 const saved=await C.listProjects();
 const messages=item=>Array.isArray(item.messages)?item.messages:[];
 const matches=saved.filter(item=>!q||String(item.name||'').toLowerCase().includes(q)||messages(item).some(m=>String(m?.text||'').toLowerCase().includes(q))).slice(0,25);
 $('#chatSearchResults').innerHTML=matches.length?matches.map(item=>{
  const found=q?messages(item).find(m=>String(m?.text||'').toLowerCase().includes(q)):null;
  const short=found?String(found.text).replace(/\s+/g,' ').slice(0,125):messages(item).length+' saved messages';
  return '<button type="button" data-open-chat="'+E(item.id)+'"><strong>'+E(item.name||'New Chat')+'</strong><small>'+E(short)+'</small></button>';
 }).join(''):'<div class="search-empty">No saved conversations match this search.</div>';
}


/* Sources and focus are local-first, opt-in and never invoke an extra model. */
function renderSources(){
 const notes=project?.sources||[];
 $('#sourceCount').textContent=String(notes.length);
 $('#useSources').checked=project?.useSources!==false;
 $('#chatFocus').value=['general','learn','write','code','create'].includes(project?.focus)?project.focus:'general';
 $('#sourceList').innerHTML=notes.map((note,i)=>'<div class="source-chip"><span title="'+E(note.name)+'">'+E(note.name)+'</span><button type="button" data-remove-source="'+i+'" aria-label="Remove reference note '+E(note.name)+'">×</button></div>').join('')||'<small>No notes attached to this conversation.</small>';
}
async function addReferenceNotes(fileList){
 if(requestPending)throw Error('Finish the current AI request before editing reference notes.');
 const files=Array.from(fileList||[]);
 if(!files.length)return;
 const draft=conversationDraft();
 const next=[...(draft.sources||[])];
 for(const file of files){
  if(!/\.(txt|md|markdown|csv|json)$/i.test(file.name))throw Error('Use plain text, Markdown, CSV, or JSON notes. PDF parsing is not available yet.');
  if(file.size>24000)throw Error('Each note must be 24 KB or smaller. Copy a relevant excerpt for longer documents.');
  const content=(await file.text()).replace(/\u0000/g,'').slice(0,3200).trim();
  if(!content)throw Error('The attached note is empty.');
  const item={name:file.name.slice(0,75),content};
  const index=next.findIndex(n=>n.name===item.name);
  if(index>=0)next[index]=item;
  else{if(next.length>=3)throw Error('Use up to 3 short reference notes per conversation. Remove an older note first.');next.push(item)}
 }
 draft.sources=next;draft.useSources=true;draft.updatedAt=Date.now();
 await saveConversation(draft);await refreshList();renderSources();
 $('#sourceShelf').hidden=false;$('#toggleSources').setAttribute('aria-expanded','true');
 notify(next.length+' reference note(s) attached. Note contents are sent only when you send a message with Include notes enabled.');
}
async function refreshList(saved){
 const items=saved??await C.listProjects();
 const placeholder=project?'':`<option value="">${items.length?'Choose a conversation':'No projects yet'}</option>`;
 ui.select.innerHTML=placeholder+items.map(p=>`<option value="${E(p.id)}">${E(p.name||'Untitled')} · ${new Date(p.updatedAt).toLocaleDateString()}</option>`).join('');
 ui.select.value=project?.id||'';
 $('#deleteProject').disabled=requestPending||!project;
 $('#renameChat').disabled=requestPending||!project;
 $('#storageState').textContent=`Saved projects: ${items.length} · Current storage: this browser on this device`;
}
async function activate(projectId,saved,{preserveDraft=false}={}){
 const previous=project;
 const code=preserveDraft&&$('#codeFileEditor')?{file:$('#codeFileSelect').value,text:$('#codeFileEditor').value}:null;
 const note=preserveDraft&&$('#noteTitle')?{id:$('#noteSelect').value,title:$('#noteTitle').value,body:$('#noteBody').value}:null;
 try{
  const stored=projectId?await C.getProject(projectId):null;
  project=stored?C.formatMigrated(stored):null;
  clearVision();
  clearPhotos();
  selectedAsset=null;
  if(originalURL)URL.revokeObjectURL(originalURL);
  originalURL=null;
  await showAll();
 }catch(error){
  project=previous;
  await showAll();
  await refreshList(saved);
  throw error;
 }
 if(project&&previous?.id===project.id){
  if(code&&$('#codeFileEditor')){
   project.codeSelectedFile=code.file;
   renderCodeWorkspace();
   $('#codeFileEditor').value=code.text;
  }
  if(note&&$('#noteTitle')&&W.findNote(project,note.id)){
   project.activeNoteId=note.id;
   renderNotes();
   $('#noteTitle').value=note.title;
   $('#noteBody').value=note.body;
  }
 }
 await refreshList(saved);
 if(project)await C.setPref('lastProjectId',project.id).catch(fail);
 $('#startupStatus').hidden=true;
}
function setMobileDrawer(open,restoreFocus=true){
 const layer=$('#mobileDrawerLayer');
 if(!mobileLayout.matches)open=false;
 if(layer.hidden===!open)return;
 layer.hidden=!open;
 const menu=$('#mobileMenuButton');
 menu.setAttribute('aria-expanded',String(open));
 menu.setAttribute('aria-label',open?'Close workspace menu':'Open workspace menu');
 if(open){$('#drawerFocus').value=$('#chatFocus').value;$('#closeMobileDrawer').focus()}
 else if(restoreFocus&&mobileLayout.matches)menu.focus();
}
function switchMobile(tab){
 if(!['chat','preview','edit','photos','notes','files'].includes(tab))tab='chat';
 mobileView=tab;
 const mobile=mobileLayout.matches;
 $('.workarea').className=mobile?'workarea mobile-'+(tab==='chat'?'chat':'result'):'workarea';
 document.querySelectorAll('[data-mobile]').forEach(b=>{
  const active=b.dataset.mobile===tab;
  b.classList.toggle('active',active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 if(tab!=='chat')changeTab(tab);
 setMobileDrawer(false);
}
function changeTab(tab){activeView=tab;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===tab));['preview','edit','photos','notes','files'].forEach(v=>{const el=$('#'+v+'Panel');el.classList.toggle('active',tab===v)});if(tab==='photos')void renderPhotos().catch(fail);if(tab==='edit')renderEditor();if(tab==='notes')renderNotes();if(tab==='files')renderCodeWorkspace()}
function drawMessages({showEarlier=false}={}){
 const all=project?.messages||[];
 if(ui.chat.dataset.project!==project?.id){ui.chat.dataset.project=project?.id||'';ui.chat.dataset.visibleCount='100'}
 const count=Number(ui.chat.dataset.visibleCount)||100;
 const scrollHeight=ui.chat.scrollHeight,scrollTop=ui.chat.scrollTop;
 const visibleCount=showEarlier?count+100:count;
 ui.chat.dataset.visibleCount=String(visibleCount);
 const messages=all.slice(-visibleCount);
for(const url of imagePreviewURLs)URL.revokeObjectURL(url);imagePreviewURLs.clear();ui.chat.innerHTML='';ui.chips.hidden=!!messages.length;if(!messages.length){ui.chat.innerHTML=`<div class="welcome"><div class="sparkle">✦</div><p class="creator-badge">OMNIFORGE · OWNED BY ADEN INC.</p><h1>What would you like to explore?</h1><p>Talk to <span class="assistantName">${E(preferences.name)}</span> about any subject. Learn, write, solve problems, plan projects, or create something new.</p><div class="local-note">MICHELLE uses connected free AI services. Conversations are saved in this browser. Your messages and relevant project text are sent to the AI provider. Photo editing uses local tools. For instant offline arithmetic, type <code>/calc (5+3)*2</code>.</div></div>`;return}
 if(all.length>messages.length){
  const earlier=document.createElement('button');
  earlier.type='button';earlier.className='small-btn';earlier.textContent='Load earlier messages';
  earlier.onclick=()=>drawMessages({showEarlier:true});ui.chat.append(earlier);
 }
 for(const m of messages){const node=document.createElement('article');node.className='message '+(m.role==='user'?'user':'assistant');const copying=m.role==='assistant'?`<button class="copy-message" type="button" data-copy-id="${E(m.id||'')}" aria-label="Copy reply">Copy</button><button class="note-from-reply" type="button" data-save-note="${E(m.id||'')}" aria-label="Save reply as a note">Save note</button>${['WORKERS AI','LIVE AI'].includes(m.engine)&&!/<html|<!doctype/i.test(m.text)?`<button class="note-from-reply" type="button" data-memory-id="${E(m.id||'')}" aria-label="Save reply as knowledge">Remember</button>`:''}`:'';const route=m.role==='user'&&m.route?`<span class="nexus-route" title="Local NEXUS routing; no extra AI call">· ${E(m.route)}</span>`:'';node.innerHTML=`<div class="by"><span>${m.role==='user'?'You':E(preferences.name)+' · '+E(m.engine||'SAVED REPLY')+(m.model&&!m.receipt?' · '+E(m.model):'')+(['WORKERS AI','LIVE AI'].includes(m.engine)?' · '+(Array.isArray(m.sources)&&m.sources.length?(m.sources.length+' sources'):''):'')}</span>${route}${copying}</div><div class="body">${m.role==='user'?E(m.text):formatReply(m.svgSummary||m.text)}</div>`;if(m.role==='assistant'&&Array.isArray(m.sources)&&m.sources.length){
  const section=document.createElement('div');section.className='research-sources';
  const title=document.createElement('strong');title.textContent=m.researchScope==='saved-wikipedia'?'Saved reference · Wikipedia':'Sources consulted · '+(m.researchScope==='wikipedia'?'Wikipedia reference search':'web search');
  section.append(title);
  const list=document.createElement('ol');
  m.sources.slice(0,4).forEach(source=>{
    try{const u=new URL(source.url);if(u.protocol!=='https:')return;
     const li=document.createElement('li'),link=document.createElement('a');
     link.href=u.toString();link.target='_blank';link.rel='noopener noreferrer';
     link.textContent=String(source.title||u.hostname).slice(0,110);
     const detail=document.createElement('small');detail.textContent=' · '+String(source.publisher||u.hostname).slice(0,80)+(source.retrievedAt?' · retrieved '+String(source.retrievedAt).slice(0,10):'');
     li.append(link,detail);list.append(li);
    }catch{}
  });
  section.append(list);
  if(m.retrievedAt){
   const stamp=document.createElement('small');stamp.textContent='Retrieved '+String(m.retrievedAt).slice(0,24);section.append(stamp);
  }
  node.append(section);
  if(m.researchScope==='saved-wikipedia'||m.engine==='WIKIPEDIA RETRIEVAL · NO AI'){
   const license=document.createElement('a');
   license.href='https://creativecommons.org/licenses/by-sa/4.0/';license.rel='noopener noreferrer';license.target='_blank';
   license.textContent=' · CC BY-SA 4.0 (excerpt)';
   section.append(license);
  }
 }
 if(m.role==='assistant'&&(m.researchNote||m.uncitedSources)){
  // Keep retrieval diagnostics accessible without interrupting ordinary answers.
  const details=document.createElement('details');details.className='research-caveat';
  const summary=document.createElement('summary');summary.textContent='Research details';details.append(summary);
  if(m.researchNote){const note=document.createElement('p');note.textContent=String(m.researchNote).slice(0,360);details.append(note)}
  if(m.uncitedSources){const note=document.createElement('p');note.textContent='Sources were retrieved but not cited in the answer. Check the linked references for claims that require verification.';details.append(note)}
  node.append(details);
 }
 const vector=m.role==='assistant'&&['WORKERS AI','LIVE AI'].includes(m.engine)?(m.svgMarkup?{svg:window.OMNI_VECTOR?.sanitize(m.svgMarkup),explanation:m.svgSummary||''}:m.text?.includes('<svg')?window.OMNI_VECTOR?.convertResponse(m.text):null):null;if(vector?.svg){const figure=document.createElement('figure');figure.className='vector-artifact';const caption=document.createElement('figcaption');caption.textContent='Vector illustration (SVG) · created from AI-generated code, not a raster image model';const img=document.createElement('img');img.src=window.OMNI_VECTOR.dataURI(vector.svg);img.alt='Generated vector illustration';img.loading='lazy';const button=document.createElement('button');button.type='button';button.textContent='↓ Save SVG';button.dataset.downloadSvg=m.id;figure.append(caption,img,button);node.querySelector('.body').textContent=vector.explanation||'MICHELLE created a vector illustration. This is an SVG drawing, not photorealistic image generation.';node.append(figure);
 const upgrade=document.createElement('button');upgrade.type='button';upgrade.className='image-upgrade';upgrade.dataset.upgradeImage=m.id;upgrade.textContent='Create real AI image instead';node.append(upgrade);
 }if(m.imageId&&m.role==='assistant'){
 const figure=document.createElement('figure');figure.className='real-image-artifact';
 const caption=document.createElement('figcaption');caption.textContent='AI-generated image · stored locally'+(m.receipt?.attribution?' · '+m.receipt.attribution:'');
 const img=document.createElement('img');img.alt='AI-generated image: '+String(m.imagePrompt||'illustration').slice(0,120);img.loading='lazy';
 const actions=document.createElement('div');actions.className='image-artifact-actions';
 const download=document.createElement('button');download.type='button';download.textContent='↓ Save image';download.dataset.downloadImage=m.id;
 actions.append(download);figure.append(caption,img,actions);node.append(figure);
 const expectedProject=project?.id;
 void C.getBlob(m.imageId).then(blob=>{
  if(!blob||project?.id!==expectedProject||!img.isConnected)return;
  const url=URL.createObjectURL(blob);imagePreviewURLs.add(url);img.src=url;
 }).catch(()=>{img.alt='Saved image is unavailable on this device.'});
}
if(m.receipt&&Pool)node.insertAdjacentHTML('beforeend',Pool.receipt(m.receipt));ui.chat.appendChild(node)}if(requestPending)renderPendingBubble();ui.chat.scrollTop=showEarlier?ui.chat.scrollHeight-scrollHeight+scrollTop:ui.chat.scrollHeight}
function showEmptyPreview(message,title){
 ui.frame.style.display='none';
 ui.previewEmpty.style.display='grid';ui.previewEmpty.textContent=message;
 $('#previewPageName').textContent=title;
}
async function preview(){
 const stamp=++previewToken;
 if(!project?.website||project.chatOnly){showEmptyPreview('No creation to preview yet. Chat freely, or ask MICHELLE to build a website.','No website yet');return}
 try{
  const current=project,source=C.renderSite(current);
  const assets=await C.assetMap(current,false,source);
  if(stamp!==previewToken)return;
  ui.frame.sandbox='allow-scripts';
  ui.frame.srcdoc=C.sandboxHTML(C.renderSite(current,assets));
  ui.frame.style.display='block';ui.previewEmpty.style.display='none';
  $('#previewPageName').textContent=current.codeWorkspace?'3 local files · sandboxed':current.website.pages?.length+' page(s) · '+current.website.layout;
 }catch(error){
  if(stamp!==previewToken)return;
  showEmptyPreview('This preview could not load. Open the saved source in the editor or try again.','Preview unavailable');
  fail(error);
 }
}

async function showAll(){drawMessages();$('#activeArtifact').textContent=project?.name||'No active conversation';$('#undoBtn').disabled=!!project?.chatOnly||!(project?.history?.length);$('#exportBtn').disabled=!project||!!project.chatOnly;$('#zipBtn').disabled=!project||!!project.chatOnly;$('#fileHTML').disabled=!project||!!project.chatOnly;$('#fileZIP').disabled=!project||!!project.chatOnly;$('#fileJSON').disabled=!project;$('#exportChat').disabled=!project?.messages?.length;renderSources();document.querySelectorAll('.assistantName').forEach(x=>x.textContent=preferences.name);$('.status span').textContent=window.OMNI_OFFLINE_UI?.isOffline()?'LOCAL KNOWLEDGE · NO AI':aiState;$('.status').title='Response details identify the service or tool that answered.';if(activeView==='edit')renderEditor();if(activeView==='photos')void renderPhotos().catch(fail);if(activeView==='notes')renderNotes();if(activeView==='files')renderCodeWorkspace();await preview()}
function msg(role,text,engine){return {id:uid(),at:Date.now(),role,text,engine}}

function renderPendingBubble(){
 const node=document.createElement('article');
 node.className='message assistant typing-message';
 node.id='aiWorking';
 node.setAttribute('role','status');
 node.setAttribute('aria-label','MICHELLE is preparing a response');
 node.innerHTML='<div class="by">MICHELLE</div><div class="typing-row"><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="typing-label">Preparing your response…</span></div>';
 ui.chat.appendChild(node);
 updatePendingText();
}
function updatePendingText(){
 if(!requestPending)return;
 const elapsed=Math.floor((Date.now()-pendingStartedAt)/1000);
 let label=imageJob?'Waiting for a free image worker…':pendingKind==='audio'?'MICHELLE is transcribing your audio…':pendingKind==='website'?'MICHELLE is creating your website…':pendingKind==='image'?'MICHELLE is generating your image…':pendingKind==='reference'?'Looking up Wikipedia references…':'MICHELLE is thinking…';
 if(elapsed>=45&&!imageJob)label='Taking longer than usual — still processing your request…';
 else if(elapsed>=15&&!imageJob&&pendingKind!=='audio')label=pendingKind==='website'?'Still generating your website…':pendingKind==='image'?'Still generating your image…':'Still working on your reply…';
 $('#typingText').textContent=label;
 $('#typingElapsed').textContent=elapsed+'s';
 const message=ui.chat.querySelector('#aiWorking .typing-label');
 if(message)message.textContent=label;
}
function setPending(busy,text=''){
 requestPending=busy;
 const indicator=$('#typingIndicator'),prompt=$('#prompt'),sendButton=$('#sendBtn');
 indicator.hidden=!busy;$('#cancelRequest').hidden=!busy;$('#chooseVision').disabled=busy;$('#composerMode').disabled=busy;
 prompt.disabled=busy;
 sendButton.disabled=busy;
 sendButton.textContent=busy?'…':'➤';
 sendButton.setAttribute('aria-label',busy?'MICHELLE is responding':'Send');
 ui.select.disabled=busy;
 $('#newProject').disabled=busy;$('#modeToggle').disabled=busy||!K;
 $('#deleteProject').disabled=busy||!project;$('#chatSearchBtn').disabled=busy;$('#renameChat').disabled=busy||!project;$('#chatFocus').disabled=busy;$('#toggleSources').disabled=busy;$('#sourceFiles').disabled=busy;
 ui.chips.querySelectorAll('button').forEach(button=>button.disabled=busy);
 $('#composerHint').textContent=busy?'AI request in progress':'Changes stay on this device';
 if(pendingTimer!==null){clearInterval(pendingTimer);pendingTimer=null}
 if(busy){
  pendingKind=text==='audio'?'audio':/website|landing page|webpage|build a site|create a site/i.test(text)?'website':'message';
  pendingStartedAt=Date.now();
  updatePendingText();
  pendingTimer=setInterval(updatePendingText,1000);
 }else{
  ui.chat.querySelector('#aiWorking')?.remove();
  $('.status span').textContent=window.OMNI_OFFLINE_UI?.isOffline()?'LOCAL KNOWLEDGE · NO AI':aiState;
 }
}


function waitingForProvider(capability){
 const next=providerRetryUntil[capability];
 if(next<=Date.now())return false;
 notify((capability==='reference'?'Wikipedia is waiting before the next lookup.':'This service is waiting for free capacity.')+' Next estimated retry: '+new Date(next).toLocaleString()+'.');
 return true;
}
function rememberProviderDelay(capability,error){
 if(error?.status===429&&error.retryAfter>0)providerRetryUntil[capability]=Date.now()+error.retryAfter*1000;
}
async function sendImage(text,promptText,{reuse=false}={}){
 if(window.OMNI_OFFLINE_UI?.isOffline()||navigator.onLine===false){
  return localReply(text,'Image generation','Image generation needs a connected image provider. You can still open and download existing images in Photos.','IMAGE GENERATION UNAVAILABLE',{existing:reuse});
 }
 if(requestPending)return;
 if(!Pool)throw Error('Cloud AI could not load. Reload to reconnect. Local tools are available.');
 if(waitingForProvider('image'))return;
 let promptSaved=reuse;
 setPending(true,'create image');activeAbort=new AbortController();
 pendingKind='image';updatePendingText();
 try{
  if(!reuse){
   const draft=conversationDraft();
   if(!draft.chatTitleSet&&draft.chatOnly){draft.name=autoChatTitle(text)||'Image creation';draft.chatTitleSet=true;draft.updatedAt=Date.now()}
   const message=msg('user',text);message.route='Image generation';draft.messages.push(message);
   await saveConversation(draft);promptSaved=true;clearSubmittedPrompt(text);
   await refreshList();await showAll();
  }
  let data=await Pool.request('/api/image',{body:{prompt:promptText},signal:activeAbort.signal,timeout:90000});
  if(data.jobId){imageJob=data.jobId;const deadline=Date.now()+600000;while(data.state!=='done'){
   if(data.state==='cancelled'||data.state==='failed')throw Error('The image job stopped before producing an image.');const remaining=deadline-Date.now();
   if(remaining<=0)throw Error('The free image queue took too long. Try again later.');
   const delay=Math.min(remaining,Math.max(1,Math.min(30,Number(data.pollAfter)||10))*1000);
   await waitForPoll(delay,activeAbort.signal);
   if(Date.now()>=deadline)throw Error('The free image queue took too long. Try again later.');
   data=await Pool.request('/api/image/'+imageJob,{signal:activeAbort.signal,timeout:Math.min(25000,deadline-Date.now())});
   if(data.state==='cancelled')throw new DOMException('Cancelled','AbortError');
  }}
  if(data.live!==true)throw Error(data.error||'No completed image was returned.');
 if(activeAbort.signal.aborted)throw new DOMException('Cancelled','AbortError');
  let blob;
  if(data.image||data.dataUrl){const url=data.dataUrl||'data:'+(data.mime||'image/jpeg')+';base64,'+data.image;const response=await fetch(url);blob=await response.blob();}
  else if(data.imageUrl)blob=await Pool.downloadImage(data.imageUrl,activeAbort.signal);
  if(activeAbort.signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(!blob||blob.size<100||blob.size>2250000||!/^image\/(jpeg|png|webp)$/.test(blob.type))throw Error('The service returned an unsupported or oversized image.');
  const result=msg('assistant','Your generated image is saved in this conversation and in Photos. You can edit it and add it to your website.','LIVE AI');result.model=typeof data.model==='string'?data.model.slice(0,100):'';result.imagePrompt=promptText;
  result.receipt={provider:data.provider,providerName:data.providerName,model:data.model,attribution:data.attribution};
  const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
  const file=new File([blob],'michelle-image-'+Date.now()+'.'+extension,{type:blob.type});
  const asset=await C.addAsset(project,file,{reply:result,signal:activeAbort.signal});
  selectedAsset=asset.id;
  aiState='AI IMAGE GENERATED';await refreshList();await showAll();
 }catch(error){
  aiState='IMAGE REQUEST FAILED';
  if(!imageJob)rememberProviderDelay('image',error);
  if(!promptSaved||error?.code==='PROJECT_CONFLICT')throw error;
  const description=activeAbort?.signal.aborted?'Request cancelled.':error?.name==='AbortError'?'Image request timed out.':String(error?.message||error);
  if(project){const draft=conversationDraft();draft.messages.push(msg('assistant','Image generation unavailable: '+description+providerFailureDetails(error),'ERROR'));await saveConversation(draft);await showAll()}else fail(error);
 }finally{if(imageJob&&aiState==='IMAGE REQUEST FAILED')Pool.request('/api/image/'+imageJob,{method:'DELETE',timeout:15000}).catch(()=>{});imageJob=null;activeAbort=null;setPending(false);Pool?.refresh().catch(()=>{})}
}

async function sendCalculation(text,displayText=text){
 const expr=window.OMNI_CALC.expressionFromCommand(text);
 if(expr===null)return;
 const draft=conversationDraft();
 if(draft.chatOnly&&!draft.chatTitleSet){draft.name=('Calculation: '+expr).slice(0,60)||'Calculator';draft.chatTitleSet=true;draft.updatedAt=Date.now()}
 const user=msg('user',displayText);user.route='NEXUS local calculation · no AI call';draft.messages.push(user);
 let reply;
 try{const answer=window.OMNI_CALC.calculate(expr);reply='Result: '+answer.formatted+'\nExpression: '+answer.expression+'\nCalculated locally on your device. No AI request was made.'}
 catch(error){reply='Calculation error: '+error.message+'\nTry /calc (5+3)*2 or /calc sin(deg(30)).'}
 draft.messages.push(msg('assistant',reply,'NEXUS · LOCAL CALCULATOR'));
 await saveConversation(draft);clearSubmittedPrompt(displayText);await refreshList();await showAll();
}

async function sendSymbolic(text){
 // Execute only recognized, bounded symbolic maths: no Workers AI request or mock reasoning.
 const request=window.OMNI_SYMBOLIC?.command(text);
 if(!request)return;
 const draft=conversationDraft();
 if(draft.chatOnly&&!draft.chatTitleSet){draft.name=(request.op==='solve'?'Equation: ':'Calculus: '+request.op+' ')+request.expr.slice(0,40);draft.name=draft.name.slice(0,60);draft.chatTitleSet=true;draft.updatedAt=Date.now()}
 const user=msg('user',text);user.route='NEXUS symbolic maths · offline · no AI call';draft.messages.push(user);
 let reply;
 try{
  const answer=window.OMNI_SYMBOLIC.compute(request);
  reply=answer.operation+'\nInput: '+answer.input+'\n\nResult: '+answer.result+'\n\nMethod:\n'+answer.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\nComputed locally using a bounded polynomial engine. No AI request was made.';
 }catch(e){
  reply='Local symbolic maths cannot complete this expression: '+String(e.message||e)+'\n\nCurrently supports polynomial differentiation, indefinite integration (including x^-1), and linear/quadratic equations in x. For other functions or a detailed explanation, ask MICHELLE in a separate Cloud AI question.';
 }
 draft.messages.push(msg('assistant',reply,'NEXUS · LOCAL SYMBOLIC MATH'));
 aiState='LOCAL SYMBOLIC MATH · NO AI';
 await saveConversation(draft);clearSubmittedPrompt(text);await refreshList();await showAll();
}
async function localReply(text,route,body,engine,{existing=false,data,retrieval}={}){
 const draft=conversationDraft();
 if(draft.chatOnly&&!draft.chatTitleSet){const title=autoChatTitle(text);if(title){draft.name=title;draft.chatTitleSet=true}}
 if(!existing){const user=msg('user',text);user.route=route;draft.messages.push(user)}
 const reply=msg('assistant',body,engine);
 const publicRecords=data?.records?.filter(record=>record.kind==='public');
 if(publicRecords?.length){
  reply.sources=publicRecords.map(record=>({title:record.question,publisher:record.source,url:record.url,retrievedAt:record.retrievedAt}));
  reply.researchScope='saved-wikipedia';
 }
 if(retrieval){
  reply.sources=retrieval.sources.slice(0,4).map(({title,publisher,url})=>({title,publisher,url}));
  reply.researchScope='wikipedia';reply.retrievedAt=retrieval.research?.retrievedAt;
  reply.researchNote=retrieval.research?.note;
 }
 draft.messages.push(reply);aiState=engine;
 await saveConversation(draft);clearSubmittedPrompt(text);await refreshList();await showAll();
}
async function localAnswer(text){
 if(!K)return null;
 const data=await K.answer(text).catch(()=>null);
 if(data?.found||!data)return data;
 // If a refresh is already in progress, let it finish without starting a
 // network request for this question. The latest saved copy is still usable.
 await K.pendingRefresh();
 return K.answer(text).catch(()=>data);
}
async function respondOffline(text,{query=text,existing=false,reason='',onlyIfFound=false,details=''}={}){
 const data=await localAnswer(query);
 if(onlyIfFound&&!data?.found)return false;
 const caption=data?.kind==='comparison'?'\n\nSources: '+data.records.map(record=>record.source).join(' and '):
  data?.found?'\n\nSaved topic: '+data.question+'\nSource: '+data.source:'';
 const warning=data?.records?.some(record=>['personal','import','saved-ai'].includes(record.kind))?'\nUser-saved material is unverified.':'';
 const start=reason?reason+'\n\n':'';
 const reference=data?.text||'Saved references could not be opened on this device.';
 const label=data?.kind==='comparison'?'Saved reference comparison':'Saved reference';
 const body=start+reference+caption+warning+'\n\n'+label+' · no AI inference.'+details;
 await localReply(text,'Saved reference',body,'SAVED REFERENCE · NO AI',{existing,data});
 return true;
}
function canUseSavedReference(route){
 return !pendingImage&&route.action==='chat'&&!['code','write','create'].includes(route.focus);
}
function noReferenceForTask(text,route){
 const detail=route.action==='website-create'||route.action==='website-edit'?
  'Cloud AI is needed for automatic website creation and editing. Your saved projects remain available. You can edit a saved site or start a local code project from Files & Backup.':
  pendingImage?'Photo analysis needs a connected vision provider. The image has not been identified.':
  'This request needs a connected AI provider. Your saved references and local tools remain available.';
 return localReply(text,route.label,detail,'CLOUD AI UNAVAILABLE');
}
async function searchReferences(text,topic){
 if(!topic)throw Error('Enter a public topic for Wikipedia lookup.');
 if(window.OMNI_OFFLINE_UI?.isOffline()||navigator.onLine===false)return respondOffline(text,{query:topic});
 if(!Pool)return respondOffline(text,{query:topic,reason:'Wikipedia lookup could not load.'});
 if(waitingForProvider('reference')){
  await respondOffline(text,{query:topic,reason:'Wikipedia is waiting before the next lookup. Showing saved information.',onlyIfFound:true});
  return;
 }
 activeAbort=new AbortController();setPending(true,'reference');pendingKind='reference';updatePendingText();
 $('#composerHint').textContent='Looking up a public topic on Wikipedia';
 try{
  const data=await Pool.lookupWikipedia(topic,activeAbort.signal);
  if(data.provider!=='reference-retrieval'||data.live!==false||data.toolOnly!==true||typeof data.reply!=='string'||!Array.isArray(data.sources)||!data.sources.length)
   throw Error('No usable reference was returned.');
  await localReply(text,'Wikipedia lookup',data.reply,'WIKIPEDIA RETRIEVAL · NO AI',{retrieval:data});
  await K?.saveLookups(data).then(()=>window.OMNI_OFFLINE_UI?.updateStatus()).catch(()=>notify('Wikipedia answered. Its excerpts could not be kept for offline lookup.'));
 }catch(error){
  if(activeAbort.signal.aborted)return notify('Wikipedia lookup cancelled.');
  if(error?.code==='PROJECT_CONFLICT')throw error;
  rememberProviderDelay('reference',error);
  if(!error.invalidTopic){
   if(await respondOffline(text,{query:topic,reason:'Wikipedia is unavailable. Showing saved information.',onlyIfFound:true}))return;
  }
  notify(error.message);
 }finally{activeAbort=null;setPending(false)}
}
async function checkWebsite(text){
 const result=F.inspectDocument(C.renderSite(project));
 const checks=result.checks.map(item=>(item.ok?'PASS: ':'CHECK NEEDED: ')+item.name).join('\n');
 const reply='Local website checks: '+project.name+'\n'+checks+'\nSource size: '+result.characters+' characters.\n\n'+result.limits;
 const draft=conversationDraft();
 draft.messages.push(msg('user',text),msg('assistant',reply,'LOCAL WEBSITE CHECKS · NO AI'));
 await saveConversation(draft);clearSubmittedPrompt(text);await refreshList();await showAll();
}

async function recallProject(text){
 const summary=window.OMNI_CONTEXT.projectSummary(project,C.renderSite(project));
 const draft=conversationDraft();
 draft.messages.push(msg('user',text),msg('assistant',window.OMNI_CONTEXT.projectRecallReply(summary),'LOCAL PROJECT CONTEXT · NO AI'));
 aiState='LOCAL PROJECT CONTEXT · NO AI';await saveConversation(draft);clearSubmittedPrompt(text);await refreshList();await showAll();
}
async function send(text){
 text=text.trim();if(!text||requestPending)return;
 const context=window.OMNI_CONTEXT;
 const mode=$('#composerMode');
 if(!pendingImage&&(mode.value==='reference'||/^\/wiki(?:\s|$)/i.test(text))){
  mode.value='chat';return searchReferences(text,text.replace(/^\/wiki(?:\s+|$)/i,'').trim());
 }
 const imageRequest=pendingImage?null:context.composerImagePrompt(text,mode.value);
 if(mode.value==='image')mode.value='chat';
 if(imageRequest!==null)return sendImage(text,imageRequest);
 if(!pendingImage){
  const identity=context.identityReply(text);
  if(identity)return localReply(text,'Platform information',identity,'PLATFORM INFORMATION · NO AI');
 }
 if(!pendingImage&&project&&!project.chatOnly&&window.OMNI_CONTEXT.projectRecallQuestion(text))return recallProject(text);
 if(!pendingImage&&project&&!project.chatOnly&&window.OMNI_CONTEXT.websiteCheckRequest(text))return checkWebsite(text);
 if(!pendingImage&&window.OMNI_CALC?.expressionFromCommand(text)!=null)return sendCalculation(text);
 if(!pendingImage&&window.OMNI_SYMBOLIC?.command(text))return sendSymbolic(text);
  const arithmetic=window.OMNI_CALC?.arithmeticFromText(text);
 if(!pendingImage&&arithmetic!==null&&arithmetic!==undefined)return sendCalculation('/calc '+arithmetic,text);
 const route=W.route(text,project?.focus||'general',!!project&&!project.chatOnly,project?.messages);
 const canRetrieve=canUseSavedReference(route);
 const localMode=window.OMNI_OFFLINE_UI?.isOffline()||navigator.onLine===false;
 if(localMode)return canRetrieve?respondOffline(text):noReferenceForTask(text,route);
 if(!Pool){
  if(canRetrieve&&await respondOffline(text,{reason:'Cloud AI could not load. Showing saved information.',onlyIfFound:true}))return;
  throw Error('Cloud AI could not load. Reload to reconnect. Local tools are available.');
 }
 if(waitingForProvider('chat')){
  if(canRetrieve)return respondOffline(text,{reason:'Cloud AI is waiting for capacity.'});
  return;
 }
 let promptSaved=false;
 aiState='MICHELLE IS GENERATING…';
 setPending(true,text);activeAbort=new AbortController();
 $('.status span').textContent=aiState;
 try{
  const draft=conversationDraft();
  if(draft.chatOnly&&!draft.chatTitleSet){const name=autoChatTitle(text);if(name){draft.name=name;draft.chatTitleSet=true;draft.updatedAt=Date.now()}}
  const history=window.OMNI_CONTEXT.selectHistory(draft.messages);
  const requestedProjectId=draft.id,requestedSnapshot=JSON.stringify(C.snapshot(draft));
  const currentHtml=(!draft.chatOnly&&route.includeWebsite)?C.renderSite(draft):'';
  const projectContext=route.includeProject?window.OMNI_CONTEXT.projectSummary(draft,C.renderSite(draft)):null;if(currentHtml.length>24000)throw Error('This website exceeds the current AI editing limit (24,000 characters). Export a backup; manual tools remain available.');
  const userMessage=msg('user',text);userMessage.route=route.label;draft.messages.push(userMessage);
  await saveConversation(draft);promptSaved=true;clearSubmittedPrompt(text);await refreshList();await showAll();
  const data=await Pool.request('/api/chat',{body:{message:text,history,currentHtml,...(projectContext?{projectContext}:{}),provider:'auto',focus:route.focus,sources:project.useSources===false?[]:(project.sources||[]).slice(0,3),...(pendingImage?{image:pendingImage}:{})},signal:activeAbort.signal});
  if(activeAbort.signal.aborted)throw new DOMException('Cancelled','AbortError');
  const localEngines={'local-calculator':'NEXUS CALCULATOR · NO AI','local-project-context':'LOCAL PROJECT CONTEXT · NO AI','platform-information':'PLATFORM INFORMATION · NO AI','reference-retrieval':'WIKIPEDIA RETRIEVAL · NO AI'};
  const localEngine=data.toolOnly===true&&localEngines[data.provider];
  const toolOnly=!!localEngine;
  if((data.live!==true&&!toolOnly)||typeof data.reply!=='string')throw Error('No provider response or observed tool result was received.');
  const retry=Number(data.cloudRetryAfter);
  providerRetryUntil.chat=localEngine&&Number.isFinite(retry)&&retry>0?Date.now()+retry*1000:0;
  aiState=localEngine||'MICHELLE REPLIED';
  // Both the requested action and the returned artifact must authorize a save.
  const allowsWebsite=['website-create','website-edit'].includes(route.action)&&data.artifact?.type==='website';
  const document=window.OMNI_CONTEXT.websiteDocument(data.reply);
  const match=allowsWebsite&&document.valid&&data.artifact.valid!==false;
  if(project?.id!==requestedProjectId)throw Error('The active conversation changed. The returned response was not applied to a different project.');
  if(match&&JSON.stringify(C.snapshot(project))!==requestedSnapshot)throw Error('This website changed while the AI was responding. The proposed edit was not saved over your newer work. Retry using the current website.');
  let answer=data.reply,candidate=C.clone(project);
  if(match){candidate=C.change(project,p=>{p.website.rawHtml=document.html;if(p.codeWorkspace)F.replaceDocument(p,document.html);p.chatOnly=false;}).project;answer='Website code received and saved on this device. Open Preview to inspect it, or export HTML. This has not published a live website.';}
  else if(allowsWebsite){answer=document.complete?'The AI returned website code that failed validation. Your previous website is unchanged. Ask for browser-only HTML, CSS and JavaScript.':'The AI returned incomplete HTML. Your previous website is unchanged. Ask for a shorter complete website.';}

  const m=msg('assistant',answer,localEngine||'LIVE AI');m.receipt={provider:data.provider,providerName:data.providerName,model:data.model,fallbackCount:data.fallbackCount,toolsUsed:data.orchestration?.toolsUsed,warnings:data.quality?.warnings};clearVision();m.aiContent=allowsWebsite?(match?'[Earlier website output; use the current project when editing.]':'[Website generation failed validation; the previous project was kept.]'):data.reply;if(match)m.artifactType='website';m.model=typeof data.model==='string'?data.model.slice(0,100):'';m.sources=Array.isArray(data.sources)?data.sources.slice(0,4):[];m.researchScope=data.research?.scope||'';m.retrievedAt=data.research?.retrievedAt||'';m.researchNote=typeof data.research?.note==='string'?data.research.note.slice(0,360):'';m.uncitedSources=data.quality?.sourceUse?.uncited===true;const vector=window.OMNI_VECTOR?.convertResponse(data.reply);if(vector&&!match){m.svgMarkup=vector.svg;m.svgSummary=vector.explanation.replace(/```(?:svg|xml)?/gi,'').trim();}candidate.messages.push(m);
  await C.saveProject(candidate);project=candidate;await refreshList();await showAll();if(match&&mobileLayout.matches)switchMobile('preview');
  }catch(e){
  aiState='AI REQUEST FAILED';
  if(!promptSaved||e?.code==='PROJECT_CONFLICT')throw e;
  const cancelled=activeAbort?.signal.aborted===true;
  let message=cancelled?'Request cancelled.':e?.name==='AbortError'?'Request timed out':String(e?.message||e)+providerFailureDetails(e);
  if(!cancelled){
   rememberProviderDelay('chat',e);
   if(canRetrieve&&(e?.status===429||e?.status>=500||e?.code==='REQUEST_TIMEOUT'||e?.name==='TypeError')){
    if(await respondOffline(text,{existing:true,reason:'Cloud AI is unavailable. Showing saved information.',onlyIfFound:true,details:providerFailureDetails(e)}))return;
    message+='\n\nFor a public topic, choose Wikipedia lookup. The local calculator and saved projects are also available.';
   }
  }
  if(project){const draft=conversationDraft();draft.messages.push(msg('assistant',message,'ERROR'));await saveConversation(draft);await showAll()}else fail(e)
 }finally{activeAbort=null;setPending(false);Pool?.refresh().catch(()=>{})}
}
async function doUndo(){if(!project)return;const next=C.undo(project);next.messages.push(msg('assistant','Reverted the last website version. Photos remain in the project asset library.','LOCAL TOOL'));project=await C.saveProject(next);await showAll();notify('Previous website version restored')}
async function commitSite(mutator,note){if(!project)throw Error('Select a website first.');const ret=C.change(project,mutator);if(!ret.changed)return;const next=ret.project;if(note)next.messages.push(msg('assistant',note,'MANUAL EDIT · LOCAL'));project=await C.saveProject(next);await showAll();notify('Changes saved locally')}


function renderCodeWorkspace(){
 const host=$('#codeWorkspace');if(!host)return;
 if(!project?.codeWorkspace){
  host.innerHTML='<p>Create a three-file HTML/CSS/JavaScript project, or convert an existing website into editable files. No AI calls.</p><div class="code-tools"><button id="createCodeProject" type="button">＋ New static project</button><button id="convertCodeProject" type="button" '+(!project||project.chatOnly?'disabled':'')+'>Convert website</button></div>';
  $('#createCodeProject').onclick=()=>queued(async()=>{
   const p=C.makeProject('Static Code Project');p.chatOnly=false;p.codeWorkspace=F.fresh('Static Code Project');
   await C.saveProject(p);await activate(p.id);switchMobile('files');notify('New code project created locally.');
  });
  $('#convertCodeProject').onclick=()=>queued(async()=>{
   if(!project||project.chatOnly)throw Error('Open an existing website first.');
   const html=C.renderSite(project,await C.assetMap(project));
   const next=C.clone(project);next.codeWorkspace=F.fromHtml(html);next.updatedAt=Date.now();
   project=await C.saveProject(next);renderCodeWorkspace();await preview();notify('Website copied into editable files.');
  });return;
 }
 let workspace;try{workspace=F.validate(project)}catch(e){host.textContent=e.message;return}
 const selected=F.KEYS.includes(project.codeSelectedFile)?project.codeSelectedFile:F.KEYS[0];
 host.innerHTML='<div class="code-tools"><strong>Version '+workspace.version+'</strong><span>'+workspace.history.length+' saved snapshot(s)</span></div>'+
 '<label for="codeFileSelect">File</label><select id="codeFileSelect">'+F.KEYS.map(k=>'<option value="'+k+'" '+(selected===k?'selected':'')+'>'+k+'</option>').join('')+'</select>'+
 '<label for="codeFileEditor">Local code editor · Save to keep edits</label><textarea id="codeFileEditor" spellcheck="false"></textarea>'+
 '<div class="code-tools"><button id="codeDiff" type="button">View diff</button><button id="codeSave" type="button">Save version</button><button id="codeUndo" type="button" '+(!workspace.history.length?'disabled':'')+'>Undo</button><button id="codePreview" type="button">Preview</button><button id="codeZip" type="button">Export code ZIP</button></div><pre id="codeDiffOutput" hidden></pre>'+
 '<p class="muted">Only local HTML/CSS/JS. Preview runs in an isolated sandbox with network connections blocked. AI website edits use the current combined document and update these files.</p>';
 const editor=$('#codeFileEditor');editor.value=workspace.files[selected];
 $('#codeDiff').onclick=()=>{$('#codeDiffOutput').textContent=F.diff(workspace.files[selected],editor.value);$('#codeDiffOutput').hidden=false};
 $('#codeFileSelect').onchange=event=>{
  if(editor.value!==workspace.files[selected]&&!confirm('Discard unsaved changes?')){event.target.value=selected;return}
  project.codeSelectedFile=event.target.value;renderCodeWorkspace();
 };
 $('#codeSave').onclick=()=>queued(async()=>{
  const next=C.clone(project);
  if(!F.write(next,selected,editor.value)){notify('No changes to save.');return}
  project=await C.saveProject(next);await preview();renderCodeWorkspace();notify('Saved code version '+project.codeWorkspace.version);
 });
 $('#codeUndo').onclick=()=>queued(async()=>{
  if(editor.value!==workspace.files[selected]&&!confirm('Discard unsaved changes?'))return;
  const next=C.clone(project);next.codeSelectedFile=F.undo(next);
  project=await C.saveProject(next);await preview();renderCodeWorkspace();notify('Code reverted to previous snapshot.');
 });
 $('#codePreview').onclick=()=>queued(async()=>{if(editor.value!==workspace.files[selected]){notify('Save your file before preview.');return}await preview();switchMobile('preview')});
 $('#codeZip').onclick=()=>queued(async()=>{
  if(editor.value!==workspace.files[selected]){notify('Save your file before export.');return}
  await C.exportZIP(project);notify('Editable code ZIP exported.');
 });
}

function renderNotes(){
 const host=$('#notesWorkspace');
 if(!host)return;
 if(!project){host.innerHTML='<h2>Notes</h2><div class="note-empty">Start a conversation to save and edit notes.</div>';return;}
 const notes=W.notesOf(project);
 let selected=W.findNote(project,project.activeNoteId);
 if(!selected&&notes.length){selected=notes[0];project.activeNoteId=selected.id}
 const options='<div class="note-toolbar">'+(notes.length?'<select id="noteSelect" aria-label="Select note">'+notes.map(n=>'<option value="'+E(n.id)+'" '+(selected?.id===n.id?'selected':'')+'>'+E(n.title)+'</option>').join('')+'</select>':'')+'<button type="button" id="newNote">＋ New note</button>'+(selected?'<button type="button" id="removeNote">Delete note</button>':'')+'</div>';
 if(!selected){host.innerHTML='<h2>Notes</h2><p>Write and save notes on this device. Replies can also become editable notes.</p>'+options+'<div class="note-empty">No notes yet. Choose New note or Save note on any MICHELLE reply.</div>';}
 else{
  host.innerHTML='<h2>Notes</h2><p>Private notes attached to this conversation. Nothing is sent to the AI unless you copy it into a chat.</p>'+options+'<div class="note-editor"><label for="noteTitle">Title</label><input id="noteTitle" maxlength="80" value="'+E(selected.title)+'"><label for="noteBody">Your note</label><textarea id="noteBody" maxlength="16000" placeholder="Write your notes here…">'+E(selected.body)+'</textarea><div class="note-actions"><button type="button" class="note-action note-primary" id="saveNote">Save note</button><button type="button" class="note-action" id="undoNote" '+(!selected.history?.length?'disabled':'')+'>↶ Undo edit</button><button type="button" class="note-action" id="downloadNote">↓ Markdown</button><button type="button" class="note-action" id="downloadNoteTxt">↓ Text</button></div><div id="noteSaved" class="note-saved" role="status">Saved locally · '+selected.body.length+' characters</div><div class="note-preview"><h3>Preview</h3><div class="body" id="notePreview"></div></div></div>';
  const title=$('#noteTitle'),body=$('#noteBody'),preview=$('#notePreview'),feedback=$('#noteSaved');
  title.addEventListener('input',()=>{feedback.textContent='Unsaved changes · press Save note'});
  body.addEventListener('input',()=>{preview.textContent=body.value;feedback.textContent='Unsaved changes · press Save note'});
  preview.textContent=selected.body;
  $('#saveNote').onclick=()=>queued(async()=>{const next=C.clone(project);const updated=W.updateNote(next,selected.id,title.value,body.value);if(updated){project=await C.saveProject(next);await refreshList()}renderNotes();notify(updated?'Note saved on this device.':'Note already saved.')});
  $('#undoNote').onclick=()=>queued(async()=>{if((title.value!==selected.title||body.value!==selected.body)&&!confirm('Discard unsaved changes?'))return;const next=C.clone(project);W.undoNote(next,selected.id);project=await C.saveProject(next);renderNotes();notify('Previous saved version restored.')});
  const download=ext=>{const txt=ext==='md'?'# '+title.value+'\n\n'+body.value:body.value;C.download(new Blob([txt],{type:'text/plain;charset=utf-8'}),W.filename(title.value,ext));notify('Note exported locally.')};
  $('#downloadNote').onclick=()=>download('md');$('#downloadNoteTxt').onclick=()=>download('txt');
 }
 $('#newNote').onclick=()=>queued(async()=>{if(selected&&(document.querySelector('#noteTitle')?.value!==selected.title||document.querySelector('#noteBody')?.value!==selected.body)&&!confirm('Discard unsaved changes?'))return;const next=C.clone(project);W.createNote(next);project=await C.saveProject(next);renderNotes();$('#noteTitle')?.focus()});
 if(selected){
  $('#removeNote').onclick=()=>queued(async()=>{if(!confirm('Delete "'+selected.title+'"? This cannot be undone.'))return;const next=C.clone(project);W.deleteNote(next,selected.id);project=await C.saveProject(next);renderNotes();notify('Note deleted.')});
  $('#noteSelect').onchange=event=>queued(async()=>{if((document.querySelector('#noteTitle')?.value!==selected.title||document.querySelector('#noteBody')?.value!==selected.body)&&!confirm('Discard unsaved changes?')){event.target.value=selected.id;return}const next=C.clone(project);next.activeNoteId=event.target.value;project=await C.saveProject(next);renderNotes()});
 }
}
function renderEditor(){if(!project||project.chatOnly){ui.edit.innerHTML='<div class="editor"><h2>General conversation</h2><p>Ask MICHELLE about any topic. Website editing tools appear only when a website is created.</p></div>';return}const w=project.website;if(w.rawHtml||project.codeWorkspace){ui.edit.innerHTML='<div class="editor"><h2>Edit website code</h2><p>Edit the actual HTML, CSS and JavaScript, or describe changes in the conversation. Your current website is preserved.</p><button class="primary-action" id="editActualCode">Open code editor</button></div>';$('#editActualCode').onclick=()=>queued(async()=>{if(!project.codeWorkspace){const next=C.change(project,p=>{p.codeWorkspace=F.fromHtml(C.renderSite(p));}).project;project=await C.saveProject(next);}switchMobile('files');});return;}
 const pageSelect=w.pages.map((p,i)=>`<option value="${E(p.id)}" ${i===+(w.selectedPageIndex||0)?'selected':''}>${E(p.name)}</option>`).join(''),idx=Math.min(w.pages.length-1,+w.selectedPageIndex||0),pg=w.pages[idx];ui.edit.innerHTML=`<div class="editor"><h2>Website editor</h2><p>Every edit changes the active project's saved document. Use Undo to restore an earlier version.</p><div class="editor-row"><label>Website title<input data-property="title" maxlength="90" value="${E(w.meta.title)}"></label><label>Theme <select data-property="palette">${['midnight','light','indigo','forest'].map(k=>`<option value="${k}" ${JSON.stringify(w.theme)===JSON.stringify(C.palettes[k])?'selected':''}>${k}</option>`).join('')}</select></label></div><div class="editor-row"><label>Contact email<input data-property="email" type="email" maxlength="120" value="${E(w.meta.email||'')}"></label><label>WhatsApp (international digits)<input data-property="whatsapp" inputmode="tel" maxlength="20" placeholder="e.g. 234..." value="${E(w.meta.whatsappNumber||'')}"></label></div><div class="editor-row"><label>Page<select id="editPage">${pageSelect}</select></label><label>Heading size <input data-property="scale" type="range" min="0.7" max="1.9" step="0.1" value="${w.headingScale||1}"></label></div><div class="field-actions"><button data-editor-action="newpage">＋ Add page</button><button data-editor-action="deletepage" ${w.pages.length<=1?'disabled':''}>Delete selected page</button></div><h3>Sections on “${E(pg.name)}”</h3>${pg.sections.map((s,i)=>`<details class="editor-card" data-section="${E(s.id)}" ${i===0?'open':''}><summary>${i+1}. ${E(s.type)} — ${E(s.title||'Untitled')}</summary><label>Heading<input data-section-field="title" maxlength="140" value="${E(s.title||'')}"></label><label>Text<textarea data-section-field="content" maxlength="4000">${E(s.content||'')}</textarea></label>${s.type==='features'?`<label>Cards (title | description, one per line)<textarea data-section-field="cards" maxlength="6000">${E((s.children||[]).filter(c=>c.type==='card').map(c=>(c.props.title||'')+' | '+(c.props.text||'')).join('\n'))}</textarea></label>`:''}<div class="field-actions"><button data-section-action="up" ${i===0?'disabled':''}>↑ Move</button><button data-section-action="down" ${i===pg.sections.length-1?'disabled':''}>↓ Move</button><button data-section-action="delete">Remove</button></div></details>`).join('')}<div class="field-actions"><button data-editor-action="addsection">＋ Add section</button><button data-editor-action="renamepage">Rename page</button></div></div>`;
 ui.edit.querySelectorAll('[data-property]').forEach(input=>input.addEventListener('change',()=>queued(()=>commitSite(p=>{const x=p.website;switch(input.dataset.property){case'title':x.meta.title=input.value.trim()||p.name;p.name=x.meta.title;break;case'email':x.meta.email=input.value.trim();break;case'whatsapp':x.meta.whatsappNumber=input.value.replace(/[^+\d]/g,'');break;case'scale':x.headingScale=Number(input.value);break;case'palette':x.theme=C.clone(C.palettes[input.value]);break}},'Updated website settings.'))));
 $('#editPage').addEventListener('change',e=>queued(async()=>{project.website.selectedPageIndex=project.website.pages.findIndex(x=>x.id===e.target.value);await C.saveProject(project);renderEditor()}));
 ui.edit.querySelectorAll('[data-section-field]').forEach(input=>input.addEventListener('change',()=>queued(()=>commitSite(p=>{const active=p.website.pages[idx].sections.find(x=>x.id===input.closest('[data-section]').dataset.section);if(!active)throw Error('Section not found.');if(input.dataset.sectionField==='cards'){active.children=input.value.split('\n').filter(Boolean).slice(0,12).map(line=>({id:uid(),type:'card',props:{title:line.split('|')[0]?.trim(),text:line.split('|').slice(1).join('|').trim()}}))}else active[input.dataset.sectionField]=input.value},'Saved section changes.'))));
 ui.edit.querySelectorAll('[data-section-action]').forEach(btn=>btn.addEventListener('click',()=>queued(()=>commitSite(p=>{const secs=p.website.pages[idx].sections,index=secs.findIndex(s=>s.id===btn.closest('[data-section]').dataset.section),act=btn.dataset.sectionAction;if(act==='delete'){if(!confirm('Remove this section? You can undo afterward.'))return;secs.splice(index,1)}else if(act==='up'&&index>0)[secs[index-1],secs[index]]=[secs[index],secs[index-1]];else if(act==='down'&&index<secs.length-1)[secs[index],secs[index+1]]=[secs[index+1],secs[index]]},'Updated page section order.'))));
 ui.edit.querySelectorAll('[data-editor-action]').forEach(btn=>btn.addEventListener('click',()=>queued(()=>commitSite(p=>{const w=p.website,action=btn.dataset.editorAction;let name;if(action==='newpage'){name=prompt('Name of new page (e.g. About)');if(!name)return;name=name.trim().slice(0,50);if(w.pages.some(pg=>pg.name.toLowerCase()===name.toLowerCase()))throw Error('Page already exists');w.pages.push(C.page(name,[C.section('hero',name,'Edit your page content here.')]))}else if(action==='addsection'){const type=prompt('Section type: text, hero, features, gallery, contact','text');if(!type)return;if(!['text','hero','features','gallery','contact'].includes(type.toLowerCase().trim()))throw Error('Choose a supported section type');w.pages[idx].sections.push(C.section(type.toLowerCase().trim(),'New section','Edit this text.'))}else if(action==='renamepage'){name=prompt('New page name',w.pages[idx].name);if(!name)return;w.pages[idx].name=name.trim().slice(0,50);w.pages[idx].slug=C.slug(name)}else if(action==='deletepage'){if(!confirm('Delete this page? Undo is available.'))return;w.pages.splice(idx,1);w.selectedPageIndex=0}},'Updated site pages or sections.'))));
}
async function uploadFiles(fileList){if(!project)throw Error('Create a website before uploading photos.');const files=Array.from(fileList);if(!files.length)return;const target=project.id;let n=0;for(const file of files){if(project?.id!==target)throw Error('Active project changed during upload; stopped to avoid misplacing photos.');const a=await C.addAsset(project,file);selectedAsset=a.id;n++}notify(`Added ${n} photo(s) to ${project.name}. Select “Add to this website” in Photos.`);await showAll();switchMobile('photos')}
function clearPhotos(){
 photoRender++;
 for(const url of photoURLs)URL.revokeObjectURL(url);
 photoURLs.clear();
}
async function renderPhotos(){
 clearPhotos();
 const stamp=photoRender,current=project;
 if(!current){ui.grid.innerHTML='<p>Create a website first.</p>';ui.photoEditor.innerHTML='';return}
 const photos=await Promise.all(current.assets.map(async asset=>({asset,blob:await C.getBlob(asset.id).catch(()=>null)})));
 if(stamp!==photoRender||project?.id!==current.id)return;
 ui.grid.innerHTML='';
 for(const {asset,blob} of photos){
  const tile=document.createElement('button'),thumbnail=document.createElement('img'),label=document.createElement('small');
  tile.type='button';tile.className='asset-tile'+(asset.id===selectedAsset?' selected':'');
  thumbnail.alt=asset.name||'Saved photo';thumbnail.loading='lazy';label.textContent=thumbnail.alt;
  if(blob){
   const url=URL.createObjectURL(blob);photoURLs.add(url);thumbnail.src=url;
  }else if(/^data:image\/(jpeg|png|webp);base64,/i.test(asset.dataUrl||''))thumbnail.src=asset.dataUrl;
  else label.textContent+=' (unavailable)';
  tile.append(thumbnail,label);ui.grid.append(tile);
  tile.onclick=()=>{
   selectedAsset=asset.id;
   ui.grid.querySelector('.selected')?.classList.remove('selected');tile.classList.add('selected');
   void showPhotoEditor().catch(fail);
  };
 }
 if(!photos.length)ui.grid.innerHTML='<p>No photos uploaded yet.</p>';
 if(selectedAsset&&current.assets.some(asset=>asset.id===selectedAsset))await showPhotoEditor();
 else ui.photoEditor.innerHTML='<p>Select a photo to edit, or use the Add photos button.</p>';
}
let imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};
async function showPhotoEditor(){
 const projectId=project?.id,assetId=selectedAsset,stamp=photoRender;
 const a=project?.assets.find(asset=>asset.id===assetId);
 if(!a)return;
 const blob=await C.getBlob(a.id).catch(()=>null);
 if(stamp!==photoRender||project?.id!==projectId||selectedAsset!==assetId)return;
 if(originalURL)URL.revokeObjectURL(originalURL);
 originalURL=null;
 if(!blob){ui.photoEditor.textContent='This legacy asset is unavailable. Export your project and reimport it to repair.';return}originalURL=URL.createObjectURL(blob);imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};ui.photoEditor.innerHTML=`<div class="photo-editor"><h3>${E(a.name)}</h3><div class="before-after"><figure><img id="beforeImg" src="${originalURL}" alt="Original photograph"><figcaption>ORIGINAL</figcaption></figure><figure><canvas id="afterCanvas"></canvas><figcaption>LOCAL EDIT PREVIEW</figcaption></figure></div>${[['brightness','Brightness'],['contrast','Contrast'],['saturation','Saturation']].map(([k,t])=>`<div class="range-row"><label for="filter_${k}">${t}</label><input id="filter_${k}" data-filter="${k}" type="range" min="0" max="200" value="100"><output id="output_${k}">100</output></div>`).join('')}<div class="editor-row"><label>Crop<select id="cropSelect"><option value="original">Full image</option><option value="square">Square (1:1)</option><option value="portrait">Portrait (4:5)</option><option value="landscape">Landscape (16:9)</option></select></label><label>Output max size<select id="resizeSelect"><option value="800">800 px</option><option value="1200" selected>1200 px</option><option value="1600">1600 px</option></select></label></div><div class="field-actions"><button id="rotateBtn">↻ Rotate 90°</button><button id="resetPhoto">↶ Reset edits</button><button id="saveEdited" class="primary-action">Save edited copy</button><button id="addPhoto" class="primary-action">＋ Add to this website</button><button id="analysePhoto">Ask MICHELLE about this photo</button></div><p>Project: <b>${E(project.name)}</b>. Saving creates a new photo asset and keeps the original.</p></div>`;
 const im=new Image();im.onload=()=>{const can=$('#afterCanvas');if(can)drawImageToCanvas(im,can,imageOps)};im.src=originalURL;
 ui.photoEditor.querySelectorAll('[data-filter]').forEach(f=>f.addEventListener('input',()=>{imageOps[f.dataset.filter]=Number(f.value);$('#output_'+f.dataset.filter).textContent=f.value;drawImageToCanvas(im,$('#afterCanvas'),imageOps)}));$('#cropSelect').onchange=e=>{imageOps.crop=e.target.value;drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#resizeSelect').onchange=e=>{imageOps.max=Number(e.target.value);drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#rotateBtn').onclick=()=>{imageOps.rotate=(imageOps.rotate+90)%360;drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#resetPhoto').onclick=()=>{imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};void showPhotoEditor().catch(fail)};$('#saveEdited').onclick=()=>queued(async()=>{const can=$('#afterCanvas');if(!can)throw Error('Canvas preview is unavailable');const blob=await new Promise(resolve=>can.toBlob(resolve,'image/jpeg',.87));if(!blob)throw Error('Could not save image');const asset=await C.addAsset(project,new File([blob],a.name.replace(/\.[^.]+$/,'')+'-edited.jpg',{type:'image/jpeg'}),{originalId:a.originalId||a.id});selectedAsset=asset.id;await renderPhotos();notify('Edited copy saved; original is preserved')});$('#analysePhoto').onclick=()=>queued(async()=>{await attachVision(await C.getBlob(a.id));switchMobile('chat');notify('Photo ready. Type what you want MICHELLE to analyse.');});$('#addPhoto').disabled=!!project.chatOnly;$('#addPhoto').title=project.chatOnly?'Create a website in this conversation before placing images.':'';$('#addPhoto').onclick=()=>queued(async()=>{if(project.chatOnly)throw Error('Create a website in this conversation before placing an image.');if(project.website.rawHtml||project.codeWorkspace){const changed=C.change(project,p=>{const doc=new DOMParser().parseFromString(C.renderSite(p),'text/html');let gallery=doc.querySelector('[data-omniforge-gallery]');if(!gallery){gallery=doc.createElement('section');gallery.dataset.omniforgeGallery='true';gallery.style.cssText='padding:24px;display:flex;gap:16px;flex-wrap:wrap';(doc.querySelector('main')||doc.body).appendChild(gallery)}if(!Array.from(gallery.querySelectorAll('img')).some(im=>im.getAttribute('src')==='omniforge-asset://'+a.id)){const im=doc.createElement('img');im.src='omniforge-asset://'+a.id;im.alt=a.name;im.style.cssText='max-width:100%;width:320px;height:auto;object-fit:contain';gallery.appendChild(im)}p.website.rawHtml='<!doctype html>'+doc.documentElement.outerHTML;if(p.codeWorkspace)F.replaceDocument(p,p.website.rawHtml);});project=await C.saveProject(changed.project);await showAll();switchMobile('preview');notify('Photo added to this website. It will be embedded in HTML exports.');return;}const expected=project.id;const res=C.addAssetsToProject(project,[a.id]);if(!res.changed)throw Error('Image is already in the gallery.');if(project.id!==expected)throw Error('Active project changed.');await C.saveProject(res.project);project=res.project;await showAll();switchMobile('preview');notify('Photo added to the correct website gallery')})}
function drawImageToCanvas(image,canvas,settings){if(!image.complete||!canvas)return;const ratio=({square:1,portrait:4/5,landscape:16/9})[settings.crop];let sw=image.naturalWidth,sh=image.naturalHeight,sx=0,sy=0;if(ratio){if(sw/sh>ratio){const nw=sh*ratio;sx=(sw-nw)/2;sw=nw}else{const nh=sw/ratio;sy=(sh-nh)/2;sh=nh}}const max=Math.min(1600,Math.max(300,settings.max)),size=Math.min(1,max/Math.max(sw,sh)),dw=Math.max(1,Math.round(sw*size)),dh=Math.max(1,Math.round(sh*size)),turn=settings.rotate%180!==0;canvas.width=turn?dh:dw;canvas.height=turn?dw:dh;const ctx=canvas.getContext('2d',{alpha:false});ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(settings.rotate*Math.PI/180);ctx.filter=`brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`;ctx.drawImage(image,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);ctx.restore()}
async function exportAction(action){if(!project)throw Error('Create or open a project first.');if(action==='html'){await C.exportHTML(project);notify('Offline HTML exported')}if(action==='zip'){await C.exportZIP(project);notify('ZIP backup exported')}if(action==='json'){await C.exportJSON(project);notify('JSON backup exported')}}
function clearVision(){pendingImage=null;const badge=$('#visionAttachment');if(badge)badge.hidden=true;}
async function attachVision(blob){
 if(!blob)throw Error('Choose a photo first.');
 const url=URL.createObjectURL(blob),im=new Image();
 try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('Photo could not be read.'));im.src=url});
  const ratio=Math.min(1,640/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(im.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(im.naturalHeight*ratio));
  canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);pendingImage=canvas.toDataURL('image/jpeg',.76);
  if(pendingImage.length>500000)throw Error('Photo is too large after resizing. Choose a smaller image.');
  $('#visionAttachment').hidden=false;$('#composerMode').value='chat';
 }finally{URL.revokeObjectURL(url)}
}
function waitForPoll(ms,signal){return new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},ms);if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});});}
async function transcribeFile(file){
 if(!file||requestPending||waitingForProvider('audio'))return;if(!Pool)throw Error('Cloud AI could not load. Reload to reconnect.');if(window.OMNI_OFFLINE_UI?.isOffline())throw Error('Switch to Cloud AI to transcribe audio.');if(file.size>2097152)throw Error('Choose a short recording under 2 MB.');
 setPending(true,'audio');activeAbort=new AbortController();aiState='TRANSCRIBING AUDIO…';
 try{const form=new FormData();form.append('file',file);const result=await Pool.request('/api/transcribe',{body:form,signal:activeAbort.signal,timeout:90000});
  if(result.live!==true||!result.reply)throw Error('No transcription was received.');$('#composerMode').value='chat';$('#prompt').value=result.reply;aiState='TRANSCRIPTION RECEIVED';notify('Transcription ready. Review the text, then send it.');
 }catch(error){aiState='AUDIO REQUEST STOPPED';rememberProviderDelay('audio',error);throw error;}finally{activeAbort=null;setPending(false);Pool?.refresh().catch(()=>{});}
}


function startupMessage(message,reload=false){
 $('#startupMessage').textContent=message;
 $('#startupReload').hidden=!reload;
 $('#startupStatus').hidden=false;
}
async function init(){
 $('#startupStatus').dataset.started='true';
 switchMobile(mobileView);
 const timer=setTimeout(()=>startupMessage('Opening saved conversations is taking longer than usual.',true),4000);
 try{
  await showAll();
  await C.openDB();
  await C.migrateLegacySite().catch(fail);
  const items=await C.listProjects();
  const last=await C.pref('lastProjectId').catch(fail);
  const target=items.some(p=>p.id===last)?last:items[0]?.id;
  try{
   await activate(target||null,items);
  }catch(error){
   fail(error);
   startupMessage('The last conversation could not open. Choose another conversation or start a new chat.');
  }
 }catch(error){
  fail(error);
  startupMessage('Saved conversations could not load. '+error.message,true);
 }finally{
  clearTimeout(timer);
 }
}
$('#composer').addEventListener('submit',event=>{
 event.preventDefault();
 queueMessage($('#prompt').value);
});
$('#prompt').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
  event.preventDefault();
  $('#sendBtn').click();
 }
});
ui.chips.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>queueMessage(b.dataset.prompt));
$('#newProject').onclick=()=>queued(async()=>{const p=C.makeProject('New Chat');p.chatOnly=true;await C.saveProject(p);await activate(p.id);switchMobile('chat');notify('New conversation ready. The title will be chosen from your topic.')});$('#deleteProject').onclick=()=>queued(async()=>{if(!project)return;const name=project.name;if(!confirm(`Delete “${name}”? This cannot be undone. Export a ZIP backup first if you need one.`))return;await C.deleteProject(project);const next=(await C.listProjects())[0];await activate(next?.id||null);notify('Project and unused photo data deleted.')});$('#renameChat').onclick=()=>queued(async()=>{if(!project)return;const input=prompt('Rename this chat:',project.name);if(input===null)return;const title=input.trim().replace(/\s+/g,' ').slice(0,60);if(!title)return;const next=C.clone(project);next.name=title;next.chatTitlePinned=true;next.updatedAt=Date.now();project=await C.saveProject(next);await refreshList();await showAll();notify('Chat renamed')});ui.select.onchange=e=>queued(()=>activate(e.target.value));$('#undoBtn').onclick=()=>queued(doUndo);
$('#chatSearchBtn').onclick=()=>queued(async()=>{await renderChatSearch();$('#chatSearchDialog').showModal();$('#chatSearchInput').focus()});
$('#closeChatSearch').onclick=()=>$('#chatSearchDialog').close();
$('#chatSearchInput').addEventListener('input',()=>renderChatSearch().catch(fail));
$('#chatSearchResults').addEventListener('click',event=>{const target=event.target.closest('[data-open-chat]');if(!target)return;queued(async()=>{await activate(target.dataset.openChat);$('#chatSearchDialog').close();switchMobile('chat')})});
ui.chat.addEventListener('click',event=>{
 const downloadImage=event.target.closest('[data-download-image]');
 if(downloadImage){queued(async()=>{const m=(project?.messages||[]).find(x=>x.id===downloadImage.dataset.downloadImage);const blob=m?.imageId?await C.getBlob(m.imageId):null;if(!blob)throw Error('Image is no longer saved on this device.');C.download(blob,'omniforge-image-'+Date.now()+'.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'));notify('Image downloaded.')});return}
 const upgrade=event.target.closest('[data-upgrade-image]');
 if(upgrade){queued(async()=>{const messages=project?.messages||[],i=messages.findIndex(x=>x.id===upgrade.dataset.upgradeImage);if(i<0)return;const original=[...messages.slice(0,i)].reverse().find(x=>x.role==='user');if(!original)throw Error('Could not locate the original image request.');await sendImage(original.text,original.text,{reuse:true})});return}
 const vectorButton=event.target.closest('[data-download-svg]');if(vectorButton){queued(async()=>{const original=(project?.messages||[]).find(m=>m.id===vectorButton.dataset.downloadSvg);if(!original)return;const safe=window.OMNI_VECTOR?.sanitize(original.svgMarkup||window.OMNI_VECTOR?.extract(original.text));if(!safe)throw Error('Vector drawing is unavailable.');C.download(new Blob([safe],{type:'image/svg+xml;charset=utf-8'}),'omniforge-vector-'+Date.now()+'.svg');notify('SVG illustration saved.');});return}
 const save=event.target.closest('[data-save-note]');
 if(save){queued(async()=>{if(!project)return;const message=(project.messages||[]).find(m=>m.id===save.dataset.saveNote);if(!message)return;const next=C.clone(project);const note=W.createNote(next,W.replyTitle(message.text),message.text);project=await C.saveProject(next);changeTab('notes');switchMobile('notes');notify('Reply saved as note: '+note.title)});return}
 const btn=event.target.closest('[data-copy-id]');if(!btn)return;const message=(project?.messages||[]).find(m=>m.id===btn.dataset.copyId);if(!message)return;if(!navigator.clipboard?.writeText){notify('Unable to copy automatically on this browser.');return}navigator.clipboard.writeText(message.text||'').then(()=>notify('Reply copied.')).catch(()=>notify('Unable to copy automatically on this browser.'));
});
$('#exportChat').onclick=()=>queued(()=>saveChatTranscript());
$('#exportBtn').onclick=()=>queued(()=>exportAction('html'));$('#zipBtn').onclick=()=>queued(()=>exportAction('zip'));$('#fileHTML').onclick=()=>queued(()=>exportAction('html'));$('#fileZIP').onclick=()=>queued(()=>exportAction('zip'));$('#fileJSON').onclick=()=>queued(()=>exportAction('json'));

$('#chatFocus').addEventListener('change',event=>queued(async()=>{
 if(requestPending)return;
 const focus=event.target.value;
 if(!['general','learn','write','code','create'].includes(focus))return;
 const draft=conversationDraft();
 draft.focus=focus;draft.updatedAt=Date.now();
 await saveConversation(draft);await refreshList();
 notify(focus==='general'?'General chat selected.':'Focus changed to '+focus+'. Same AI model, no extra model calls.');
}));
$('#toggleSources').onclick=()=>{
 const panel=$('#sourceShelf');panel.hidden=!panel.hidden;
 $('#toggleSources').setAttribute('aria-expanded',String(!panel.hidden));
};
$('#sourceFiles').onchange=event=>queued(async()=>{
 try{await addReferenceNotes(event.target.files)}finally{event.target.value=''}
});
$('#useSources').onchange=()=>queued(async()=>{
 if(!project){$('#useSources').checked=false;return}
 const draft=conversationDraft();
 draft.useSources=$('#useSources').checked;
 await saveConversation(draft);renderSources();
});
$('#sourceList').onclick=event=>queued(async()=>{
 const button=event.target.closest('[data-remove-source]');
 if(!button||!project||requestPending)return;
 const index=Number(button.dataset.removeSource);
 const draft=conversationDraft();
 draft.sources=(draft.sources||[]).filter((_,i)=>i!==index);
 await saveConversation(draft);renderSources();
 notify('Reference note removed.');
});
$('#settingsButton').onclick=()=>{$('#settingsDialog').showModal();Pool?.refresh().catch(()=>{})};$('#saveSettings').onclick=()=>queued(async()=>{preferences.name=window.OMNI_CONTEXT.IDENTITY.displayName;await C.setPref('provider','auto');await showAll();notify('Settings saved')});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeTab(b.dataset.view));
 document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>switchMobile(b.dataset.mobile));
 $('#mobileMenuButton').onclick=()=>setMobileDrawer($('#mobileDrawerLayer').hidden);
 $('#closeMobileDrawer').onclick=()=>setMobileDrawer(false);
 $('#mobileDrawerBackdrop').onclick=()=>setMobileDrawer(false);
 document.querySelectorAll('[data-drawer-action]').forEach(b=>b.onclick=()=>{
  const action=b.dataset.drawerAction;
  setMobileDrawer(false);
  const target={search:'#chatSearchBtn',rename:'#renameChat',settings:'#settingsButton',delete:'#deleteProject'}[action];
  if(target)$(target).click();
 });
 $('#drawerFocus').onchange=e=>{
  const focus=$('#chatFocus');focus.value=e.target.value;
  focus.dispatchEvent(new Event('change',{bubbles:true}));
  setMobileDrawer(false);
 };
 document.addEventListener('keydown',e=>{
  const layer=$('#mobileDrawerLayer');
  if(layer.hidden)return;
  if(e.key==='Escape'){e.preventDefault();setMobileDrawer(false);return}
  if(e.key==='Tab'){
   const allowed=Array.from($('#mobileDrawer').querySelectorAll('button:not(:disabled),select:not(:disabled)'));
   const first=allowed[0],last=allowed[allowed.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 const resizeWorkspace=()=>switchMobile(mobileView);
 if(mobileLayout.addEventListener)mobileLayout.addEventListener('change',resizeWorkspace);
 else mobileLayout.addListener(resizeWorkspace);
for(const id of ['chatPhotoFiles','photoFiles'])$('#'+id).onchange=e=>queued(async()=>{await uploadFiles(e.target.files);e.target.value=''});
$('#importFile').onchange=e=>queued(async()=>{const file=e.target.files[0];if(!file)return;const p=await C.importProject(file);await activate(p.id);switchMobile('preview');notify('Project imported. Changes are local to this device.');e.target.value=''});
$('#chooseVision').onclick=()=>{if(!requestPending)$('#visionFile').click()};$('#visionFile').onchange=e=>queued(async()=>{const file=e.target.files[0];if(file)await attachVision(file);e.target.value='';});$('#removeVision').onclick=clearVision;$('#audioFile').onchange=e=>queued(async()=>{try{await transcribeFile(e.target.files[0])}finally{e.target.value=''}});$('#cancelRequest').onclick=()=>activeAbort?.abort();

queue=init();
void Pool?.mount().catch(fail);
window.OMNI_TEST={getProject:()=>project,getUI:()=>({mobileView,activeView}),queue:()=>queue};
})();
