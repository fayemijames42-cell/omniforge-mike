/* OMNIFORGE mobile UI - local/manual MVP. No fabricated AI or hosted uploads. */
(function(){'use strict';const C=window.OMNI,W=window.OMNI_WORKSPACE;const $=s=>document.querySelector(s);let project=null,all=[],activeView='preview',mobileView=innerWidth>800?'preview':'chat',preferences={name:'MIKEE',mock:false},selectedAsset=null,originalURL=null,renderedURL=null,previewToken=0,queue=Promise.resolve(),aiState='AI — NOT TESTED YET',requestPending=false,pendingStartedAt=0,pendingTimer=null,pendingKind='message';
const ui={chat:$('#chatStream'),chips:$('#chips'),edit:$('#editControls'),grid:$('#assetGrid'),photoEditor:$('#photoEditor'),frame:$('#siteFrame'),previewEmpty:$('#previewEmpty'),select:$('#projectSelect')};
const E=C.esc, uid=C.uuid;function notify(s){const t=$('#toast');t.textContent=s;t.style.display='block';clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>t.style.display='none',3600)}
function fail(e){const msg=e?.name==='QuotaExceededError'?'Device storage is full. Export a backup, remove unused photos, then try again.':e?.message||String(e);notify(msg);console.warn('OMNIFORGE action failed:',e)}
function queued(fn){queue=queue.catch(()=>{}).then(fn).catch(fail);return queue}
function autoChatTitle(input){
 let s=String(input||'').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
 if(!s||/^(hi|hello|hey|yo|ok|okay|thanks|thank you|good morning|good afternoon)[!.,? ]*$/i.test(s))return '';
 s=s.replace(/^(?:hi|hello|hey)[!,.\s]+/i,'').replace(/^(?:(?:mikee|please)[!,.:\s]+|can you\s+|could you\s+|would you\s+|i (?:want|need) (?:you )?to\s+|help me (?:to |with )?)/i,'');
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
 const transcript=['# '+project.name,'','OMNIFORGE · Conversation export','',...(project.messages||[]).flatMap(m=>[(m.role==='user'?'## You':'## MIKEE')+(m.engine?' ('+m.engine+')':''),'',String(m.text||''),''])].join('\n');
 const name=String(project.name||'conversation').replace(/[^a-z0-9 -]/gi,'').replace(/\s+/g,'-').slice(0,55)||'conversation';
 C.download(new Blob([transcript],{type:'text/markdown;charset=utf-8'}),name+'-chat.md');
 notify('Conversation exported as Markdown.');
}
async function renderChatSearch(){
 const q=$('#chatSearchInput').value.trim().toLowerCase();
 const saved=await C.listProjects();
 const matches=saved.filter(item=>!q||String(item.name||'').toLowerCase().includes(q)||(item.messages||[]).some(m=>String(m.text||'').toLowerCase().includes(q))).slice(0,25);
 $('#chatSearchResults').innerHTML=matches.length?matches.map(item=>{
  const found=q?(item.messages||[]).find(m=>String(m.text||'').toLowerCase().includes(q)):null;
  const short=found?String(found.text).replace(/\s+/g,' ').slice(0,125):(item.messages?.length||0)+' saved messages';
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
 if(!project){project=C.makeProject('New Chat');project.chatOnly=true;await C.setPref('lastProjectId',project.id)}
 const next=[...(project.sources||[])];
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
 project.sources=next;project.useSources=true;project.updatedAt=Date.now();
 await C.saveProject(project);await refreshList();renderSources();
 $('#sourceShelf').hidden=false;$('#toggleSources').setAttribute('aria-expanded','true');
 notify(next.length+' reference note(s) attached. Note contents are sent only when you send a message with Include notes enabled.');
}
async function refreshList(){all=await C.listProjects();ui.select.innerHTML=all.length?all.map(p=>`<option value="${E(p.id)}">${E(p.name||'Untitled')} · ${new Date(p.updatedAt).toLocaleDateString()}</option>`).join(''):'<option value="">No projects yet</option>';if(project)ui.select.value=project.id;$('#deleteProject').disabled=!project;$('#renameChat').disabled=!project}
async function activate(projectId){project=projectId?await C.getProject(projectId):null;if(project)project=C.formatMigrated(project);selectedAsset=null;if(originalURL)URL.revokeObjectURL(originalURL);originalURL=null;await refreshList();await showAll();if(project)await C.setPref('lastProjectId',project.id)}
function switchMobile(tab){mobileView=tab;const mobile=innerWidth<=800;const a=tab==='chat'?'chat':'result';$('.workarea').className='workarea mobile-'+a;document.querySelectorAll('[data-mobile]').forEach(b=>b.classList.toggle('active',b.dataset.mobile===tab));if(tab!=='chat')changeTab(tab==='preview'?'preview':tab);if(!mobile){$('.workarea').className='workarea'} }
function changeTab(tab){activeView=tab;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===tab));['preview','edit','photos','notes','files'].forEach(v=>{const el=$('#'+v+'Panel');el.classList.toggle('active',tab===v)});if(tab==='photos')renderPhotos();if(tab==='edit')renderEditor();if(tab==='notes')renderNotes()}
function drawMessages(){ui.chat.innerHTML='';const messages=project?.messages||[];ui.chips.hidden=!!messages.length;if(!messages.length){ui.chat.innerHTML=`<div class="welcome"><div class="sparkle">✦</div><h1>What would you like to explore?</h1><p>Talk to <span class="assistantName">${E(preferences.name)}</span> about any subject. Learn, write, solve problems, plan projects, or create something new.</p><div class="local-note">Chat uses Cloudflare Workers AI. Conversations are saved in this browser. Your messages and relevant project text are sent to the AI provider. Photo editing uses local tools. For instant offline arithmetic, type <code>/calc (5+3)*2</code>.</div></div>`;return}for(const m of messages){const node=document.createElement('article');node.className='message '+(m.role==='user'?'user':'assistant');const copying=m.role==='assistant'?`<button class="copy-message" type="button" data-copy-id="${E(m.id||'')}" aria-label="Copy reply">Copy</button><button class="note-from-reply" type="button" data-save-note="${E(m.id||'')}" aria-label="Save reply as a note">Save note</button>`:'';const route=m.role==='user'&&m.route?`<span class="nexus-route" title="Local NEXUS routing; no extra AI call">· ${E(m.route)}</span>`:'';node.innerHTML=`<div class="by"><span>${m.role==='user'?'You':E(preferences.name)+' · '+(m.engine||'RULE-BASED / NOT LIVE AI')}</span>${route}${copying}</div><div class="body">${m.role==='user'?E(m.text):formatReply(m.text)}</div>`;ui.chat.appendChild(node)}if(requestPending)renderPendingBubble();ui.chat.scrollTop=ui.chat.scrollHeight}
async function preview(){const stamp=++previewToken;if(!project?.website||project.chatOnly){ui.frame.style.display='none';ui.previewEmpty.style.display='grid';$('#previewPageName').textContent='No website yet';return}try{const doc=project.website.rawHtml||C.renderSite(project,await C.assetMap(project));if(stamp!==previewToken)return;ui.frame.sandbox='allow-scripts';ui.frame.srcdoc=doc.replace(/<head([^>]*)>/i,`<head$1><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src data:;">`);ui.frame.style.display='block';ui.previewEmpty.style.display='none';$('#previewPageName').textContent=project.website.pages?.length+' page(s) · '+project.website.layout; }catch(e){fail(e)}}
async function showAll(){drawMessages();$('#activeArtifact').textContent=project?.name||'No active conversation';$('#undoBtn').disabled=!!project?.chatOnly||!(project?.history?.length);$('#exportBtn').disabled=!project||!!project.chatOnly;$('#zipBtn').disabled=!project||!!project.chatOnly;$('#fileHTML').disabled=!project||!!project.chatOnly;$('#fileZIP').disabled=!project||!!project.chatOnly;$('#fileJSON').disabled=!project;$('#exportChat').disabled=!project?.messages?.length;renderSources();document.querySelectorAll('.assistantName').forEach(x=>x.textContent=preferences.name);$('.status span').textContent=preferences.mock?'LOCAL RULES — NOT AI':aiState;$('.status').title=preferences.mock?'Local rules only.':'A real reply is required before AI is marked verified.';if(activeView==='edit')renderEditor();if(activeView==='photos')renderPhotos();if(activeView==='notes')renderNotes();await preview()}
function msg(role,text,engine){return {id:uid(),at:Date.now(),role,text,engine}}

function renderPendingBubble(){
 const node=document.createElement('article');
 node.className='message assistant typing-message';
 node.id='aiWorking';
 node.setAttribute('role','status');
 node.setAttribute('aria-label','MIKEE is preparing a response');
 node.innerHTML='<div class="by">MIKEE · WORKERS AI</div><div class="typing-row"><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="typing-label">Preparing your response…</span></div>';
 ui.chat.appendChild(node);
 updatePendingText();
}
function updatePendingText(){
 if(!requestPending)return;
 const elapsed=Math.floor((Date.now()-pendingStartedAt)/1000);
 let label=pendingKind==='website'?'MIKEE is creating your website…':'MIKEE is thinking…';
 if(elapsed>=45)label='Taking longer than usual — still processing your request…';
 else if(elapsed>=15)label=pendingKind==='website'?'Still generating your website…':'Still working on your reply…';
 $('#typingText').textContent=label;
 $('#typingElapsed').textContent=elapsed+'s';
 const message=ui.chat.querySelector('#aiWorking .typing-label');
 if(message)message.textContent=label;
}
function setPending(busy,text=''){
 requestPending=busy;
 const indicator=$('#typingIndicator'),prompt=$('#prompt'),sendButton=$('#sendBtn');
 indicator.hidden=!busy;
 prompt.disabled=busy;
 sendButton.disabled=busy;
 sendButton.textContent=busy?'…':'➤';
 sendButton.setAttribute('aria-label',busy?'MIKEE is responding':'Send');
 ui.select.disabled=busy;
 $('#newProject').disabled=busy;
 $('#deleteProject').disabled=busy||!project;$('#chatSearchBtn').disabled=busy;$('#renameChat').disabled=busy||!project;$('#chatFocus').disabled=busy;$('#toggleSources').disabled=busy;$('#sourceFiles').disabled=busy;
 ui.chips.querySelectorAll('button').forEach(button=>button.disabled=busy);
 $('#composerHint').textContent=busy?'AI request in progress':'Changes stay on this device';
 if(pendingTimer!==null){clearInterval(pendingTimer);pendingTimer=null}
 if(busy){
  pendingKind=/website|landing page|webpage|build a site|create a site/i.test(text)?'website':'message';
  pendingStartedAt=Date.now();
  updatePendingText();
  pendingTimer=setInterval(updatePendingText,1000);
 }else{
  ui.chat.querySelector('#aiWorking')?.remove();
  $('.status span').textContent=preferences.mock?'LOCAL RULES — NOT AI':aiState;
 }
}
async function saveMessage(text){if(!project)return;project.messages=[...(project.messages||[]),msg('assistant',text,preferences.mock?'MOCK — NOT LIVE AI':'RULE-BASED / NOT LIVE AI')].slice(-100);await C.saveProject(project);await showAll()}
async function sendCalculation(text){
 const expr=window.OMNI_CALC.expressionFromCommand(text);
 if(expr===null)return;
 $('#prompt').value='';
 if(!project){project=C.makeProject('New Chat');project.chatOnly=true;await C.setPref('lastProjectId',project.id)}
 if(project.chatOnly&&!project.chatTitleSet){project.name=('Calculation: '+expr).slice(0,60)||'Calculator';project.chatTitleSet=true;project.updatedAt=Date.now()}
 const user=msg('user',text);user.route='NEXUS local calculation · no AI call';project.messages.push(user);
 let reply;
 try{const answer=window.OMNI_CALC.calculate(expr);reply='Result: '+answer.formatted+'\nExpression: '+answer.expression+'\nCalculated locally on your device. No AI request was made.'}
 catch(error){reply='Calculation error: '+error.message+'\nTry /calc (5+3)*2 or /calc sin(deg(30)).'}
 project.messages.push(msg('assistant',reply,'NEXUS · LOCAL CALCULATOR'));
 project.messages=project.messages.slice(-100);
 await C.saveProject(project);await refreshList();await showAll();
}
async function send(text){
 text=text.trim();if(!text||requestPending)return;
 if(window.OMNI_CALC?.expressionFromCommand(text)!==null)return sendCalculation(text);
 if(preferences.mock)return sendLocal(text);
 $('#prompt').value='';
 aiState='MIKEE IS GENERATING…';
 setPending(true,text);
 $('.status span').textContent=aiState;
 try{
  if(!project){project=C.makeProject('New Chat');project.chatOnly=true;await C.saveProject(project);await C.setPref('lastProjectId',project.id)}
  if(project.chatOnly&&!project.chatTitleSet){const name=autoChatTitle(text);if(name){project.name=name;project.chatTitleSet=true;project.updatedAt=Date.now()}}
  const history=(project.messages||[]).filter(m=>['user','assistant'].includes(m.role)&&m.engine!=='ERROR').slice(-8).map(m=>({role:m.role,content:m.aiContent||m.text}));
  const route=W.route(text,project.focus||'general',!project.chatOnly);
  const currentHtml=(!project.chatOnly&&route.includeWebsite)?C.renderSite(project):'';if(currentHtml.length>24000)throw Error('This website exceeds the current AI editing limit (24,000 characters). Export a backup; manual tools remain available.');
  const userMessage=msg('user',text);userMessage.route=route.label;project.messages.push(userMessage);await C.saveProject(project);await refreshList();await showAll();
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),90000);
  let response;try{response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history,currentHtml,focus:route.focus,sources:project.useSources===false?[]:(project.sources||[]).slice(0,3)}),signal:controller.signal})}finally{clearTimeout(deadline)}
  let data;try{data=await response.json()}catch{throw Error('The server returned an unreadable response. Please try a smaller website request.')}
  if(!response.ok)throw Error(data.error||'AI request failed');
  if(data.live!==true||typeof data.reply!=='string')throw Error('No verified provider response was received.');
  aiState='AI RESPONSE VERIFIED';
  const match=data.reply.match(/<!doctype html[\s\S]*?<\/html>/i)||data.reply.match(/<html[\s\S]*?<\/html>/i);
  let answer=data.reply;
  if(match){project=C.change(project,p=>{p.website.rawHtml=match[0]}).project;project.chatOnly=false;answer='Your website is updated. Open Preview to try it, or export HTML. Continue chatting to make changes.';}
  else if(/<!doctype html|<html/i.test(data.reply)){answer='The AI returned incomplete HTML. Your previous website is unchanged. Ask for a shorter complete website.';}
  const m=msg('assistant',answer,'WORKERS AI');m.aiContent=data.reply;project.messages.push(m);project.messages=project.messages.slice(-100);
  await C.saveProject(project);await refreshList();await showAll();if(match&&innerWidth<=800)switchMobile('preview');
 }catch(e){aiState='AI REQUEST FAILED';const error=e?.name==='AbortError'?'The website request timed out. Your earlier site is unchanged. Try requesting a smaller page first, then add sections in follow-up messages.':e.message;if(project){project.messages.push(msg('assistant',error,'ERROR'));await C.saveProject(project);await showAll()}else fail(e)}finally{setPending(false)}
}
async function sendLocal(text){text=text.trim();if(!text)return;$('#sendBtn').disabled=true;try{const [tool,args]=C.actionFromPrompt(text,project);if(tool==='create_website'){const result=C.callTool(tool,null,args);result.messages=[msg('user',text)];await C.saveProject(result);project=result;await C.setPref('lastProjectId',project.id);project.messages.push(msg('assistant',`Website created locally: “${project.name}” (${project.website.pages.length} pages). Open Preview or Edit. This is a rule-based layout, not a live AI-generated website.`,preferences.mock?'MOCK — NOT LIVE AI':'RULE-BASED / NOT LIVE AI'));await C.saveProject(project);await refreshList()}
 else {project.messages=[...(project.messages||[]),msg('user',text)].slice(-100);const result=C.callTool(tool,project,args);if(result.export){await C.exportHTML(project);project.messages.push(msg('assistant','Exported the current website as an offline HTML file.','LOCAL TOOL'))}else if(result.details){project.messages.push(msg('assistant',`Current site: ${result.details.pages} page(s), ${result.details.photos} photo(s), ${result.details.versions} saved undo versions.`, 'LOCAL TOOL'))}else if(result.changed){project=result.project;project.messages.push(msg('assistant',`Updated “${project.name}”. This is version ${project.version}. Preview, refresh or Undo to check the actual change.`,preferences.mock?'MOCK — NOT LIVE AI':'RULE-BASED / NOT LIVE AI'))}else project.messages.push(msg('assistant','No change was necessary.','LOCAL TOOL'));project.messages=project.messages.slice(-100);await C.saveProject(project)}
$('#prompt').value='';await showAll();if(innerWidth<=800)switchMobile('preview')}
catch(e){if(project){project.messages=[...(project.messages||[]),msg('user',text),msg('assistant',`Could not make that change: ${e.message}`, 'LOCAL TOOL')].slice(-100);try{await C.saveProject(project)}catch(saveError){fail(saveError)}await showAll()}else fail(e)}finally{$('#sendBtn').disabled=false}}
async function doUndo(){if(!project)return;const result=C.callTool('revert_version',project,{});project=result.project;project.messages.push(msg('assistant','Reverted the last website version. Photos remain in the project asset library.','LOCAL TOOL'));await C.saveProject(project);await showAll();notify('Previous website version restored')}
async function commitSite(mutator,note){if(!project)throw Error('Select a website first.');const ret=C.change(project,mutator);if(!ret.changed)return;const next=ret.project;await C.saveProject(next);project=next;if(note){project.messages.push(msg('assistant',note,'MANUAL EDIT · LOCAL'));await C.saveProject(project)}await showAll();notify('Changes saved locally')}

function renderNotes(){
 const host=$('#notesWorkspace');
 if(!host)return;
 if(!project){host.innerHTML='<h2>Notes</h2><div class="note-empty">Start a conversation to save and edit notes.</div>';return;}
 const notes=W.notesOf(project);
 let selected=W.findNote(project,project.activeNoteId);
 if(!selected&&notes.length){selected=notes[0];project.activeNoteId=selected.id}
 const options='<div class="note-toolbar">'+(notes.length?'<select id="noteSelect" aria-label="Select note">'+notes.map(n=>'<option value="'+E(n.id)+'" '+(selected?.id===n.id?'selected':'')+'>'+E(n.title)+'</option>').join('')+'</select>':'')+'<button type="button" id="newNote">＋ New note</button>'+(selected?'<button type="button" id="removeNote">Delete note</button>':'')+'</div>';
 if(!selected){host.innerHTML='<h2>Notes</h2><p>Write and save notes on this device. Replies can also become editable notes.</p>'+options+'<div class="note-empty">No notes yet. Choose New note or Save note on any MIKEE reply.</div>';}
 else{
  host.innerHTML='<h2>Notes</h2><p>Private notes attached to this conversation. Nothing is sent to the AI unless you copy it into a chat.</p>'+options+'<div class="note-editor"><label for="noteTitle">Title</label><input id="noteTitle" maxlength="80" value="'+E(selected.title)+'"><label for="noteBody">Your note</label><textarea id="noteBody" maxlength="16000" placeholder="Write your notes here…">'+E(selected.body)+'</textarea><div class="note-actions"><button type="button" class="note-action note-primary" id="saveNote">Save note</button><button type="button" class="note-action" id="undoNote" '+(!selected.history?.length?'disabled':'')+'>↶ Undo edit</button><button type="button" class="note-action" id="downloadNote">↓ Markdown</button><button type="button" class="note-action" id="downloadNoteTxt">↓ Text</button></div><div id="noteSaved" class="note-saved" role="status">Saved locally · '+selected.body.length+' characters</div><div class="note-preview"><h3>Preview</h3><div class="body" id="notePreview"></div></div></div>';
  const title=$('#noteTitle'),body=$('#noteBody'),preview=$('#notePreview'),feedback=$('#noteSaved');
  title.addEventListener('input',()=>{feedback.textContent='Unsaved changes · press Save note'});
  body.addEventListener('input',()=>{preview.textContent=body.value;feedback.textContent='Unsaved changes · press Save note'});
  preview.textContent=selected.body;
  $('#saveNote').onclick=()=>queued(async()=>{const updated=W.updateNote(project,selected.id,title.value,body.value);if(updated){await C.saveProject(project);await refreshList()}renderNotes();notify(updated?'Note saved on this device.':'Note already saved.')});
  $('#undoNote').onclick=()=>queued(async()=>{if((title.value!==selected.title||body.value!==selected.body)&&!confirm('Discard unsaved changes?'))return;W.undoNote(project,selected.id);await C.saveProject(project);renderNotes();notify('Previous saved version restored.')});
  const download=ext=>{const txt=ext==='md'?'# '+title.value+'\n\n'+body.value:body.value;C.download(new Blob([txt],{type:'text/plain;charset=utf-8'}),W.filename(title.value,ext));notify('Note exported locally.')};
  $('#downloadNote').onclick=()=>download('md');$('#downloadNoteTxt').onclick=()=>download('txt');
 }
 $('#newNote').onclick=()=>queued(async()=>{if(selected&&(document.querySelector('#noteTitle')?.value!==selected.title||document.querySelector('#noteBody')?.value!==selected.body)&&!confirm('Discard unsaved changes?'))return;W.createNote(project);await C.saveProject(project);renderNotes();$('#noteTitle')?.focus()});
 if(selected){
  $('#removeNote').onclick=()=>queued(async()=>{if(!confirm('Delete "'+selected.title+'"? This cannot be undone.'))return;W.deleteNote(project,selected.id);await C.saveProject(project);renderNotes();notify('Note deleted.')});
  $('#noteSelect').onchange=event=>queued(async()=>{if((document.querySelector('#noteTitle')?.value!==selected.title||document.querySelector('#noteBody')?.value!==selected.body)&&!confirm('Discard unsaved changes?')){event.target.value=selected.id;return}project.activeNoteId=event.target.value;await C.saveProject(project);renderNotes()});
 }
}
function renderEditor(){if(!project||project.chatOnly){ui.edit.innerHTML='<div class="editor"><h2>General conversation</h2><p>Ask MIKEE about any topic. Website editing tools appear only when a website is created.</p></div>';return}const w=project.website;if(w.rawHtml){ui.edit.innerHTML=`<div class="editor"><h2>AI / imported HTML</h2><p>Use the conversation to edit this website. HTML and ZIP export preserve the document. The section editor only supports structured starter projects. Converting replaces this HTML with a starter; Undo restores it.</p><button class="primary-action" id="convertHTML">Convert to editable starter</button></div>`;$('#convertHTML').onclick=()=>queued(()=>commitSite(p=>{delete p.website.rawHtml},'Converted the import to an editable starter page. Imported HTML was not retained in the structured editor.'));return}
 const pageSelect=w.pages.map((p,i)=>`<option value="${E(p.id)}" ${i===+(w.selectedPageIndex||0)?'selected':''}>${E(p.name)}</option>`).join(''),idx=Math.min(w.pages.length-1,+w.selectedPageIndex||0),pg=w.pages[idx];ui.edit.innerHTML=`<div class="editor"><h2>Website editor</h2><p>Every edit changes the active project's saved document. Use Undo to restore an earlier version.</p><div class="editor-row"><label>Website title<input data-property="title" maxlength="90" value="${E(w.meta.title)}"></label><label>Theme <select data-property="palette">${['midnight','light','indigo','forest'].map(k=>`<option value="${k}" ${JSON.stringify(w.theme)===JSON.stringify(C.palettes[k])?'selected':''}>${k}</option>`).join('')}</select></label></div><div class="editor-row"><label>Contact email<input data-property="email" type="email" maxlength="120" value="${E(w.meta.email||'')}"></label><label>WhatsApp (international digits)<input data-property="whatsapp" inputmode="tel" maxlength="20" placeholder="e.g. 234..." value="${E(w.meta.whatsappNumber||'')}"></label></div><div class="editor-row"><label>Page<select id="editPage">${pageSelect}</select></label><label>Heading size <input data-property="scale" type="range" min="0.7" max="1.9" step="0.1" value="${w.headingScale||1}"></label></div><div class="field-actions"><button data-editor-action="newpage">＋ Add page</button><button data-editor-action="deletepage" ${w.pages.length<=1?'disabled':''}>Delete selected page</button></div><h3>Sections on “${E(pg.name)}”</h3>${pg.sections.map((s,i)=>`<details class="editor-card" data-section="${E(s.id)}" ${i===0?'open':''}><summary>${i+1}. ${E(s.type)} — ${E(s.title||'Untitled')}</summary><label>Heading<input data-section-field="title" maxlength="140" value="${E(s.title||'')}"></label><label>Text<textarea data-section-field="content" maxlength="4000">${E(s.content||'')}</textarea></label>${s.type==='features'?`<label>Cards (title | description, one per line)<textarea data-section-field="cards" maxlength="6000">${E((s.children||[]).filter(c=>c.type==='card').map(c=>(c.props.title||'')+' | '+(c.props.text||'')).join('\n'))}</textarea></label>`:''}<div class="field-actions"><button data-section-action="up" ${i===0?'disabled':''}>↑ Move</button><button data-section-action="down" ${i===pg.sections.length-1?'disabled':''}>↓ Move</button><button data-section-action="delete">Remove</button></div></details>`).join('')}<div class="field-actions"><button data-editor-action="addsection">＋ Add section</button><button data-editor-action="renamepage">Rename page</button></div></div>`;
 ui.edit.querySelectorAll('[data-property]').forEach(input=>input.addEventListener('change',()=>queued(()=>commitSite(p=>{const x=p.website;switch(input.dataset.property){case'title':x.meta.title=input.value.trim()||p.name;p.name=x.meta.title;break;case'email':x.meta.email=input.value.trim();break;case'whatsapp':x.meta.whatsappNumber=input.value.replace(/[^+\d]/g,'');break;case'scale':x.headingScale=Number(input.value);break;case'palette':x.theme=C.clone(C.palettes[input.value]);break}},'Updated website settings.'))));
 $('#editPage').addEventListener('change',e=>queued(async()=>{project.website.selectedPageIndex=project.website.pages.findIndex(x=>x.id===e.target.value);await C.saveProject(project);renderEditor()}));
 ui.edit.querySelectorAll('[data-section-field]').forEach(input=>input.addEventListener('change',()=>queued(()=>commitSite(p=>{const active=p.website.pages[idx].sections.find(x=>x.id===input.closest('[data-section]').dataset.section);if(!active)throw Error('Section not found.');if(input.dataset.sectionField==='cards'){active.children=input.value.split('\n').filter(Boolean).slice(0,12).map(line=>({id:uid(),type:'card',props:{title:line.split('|')[0]?.trim(),text:line.split('|').slice(1).join('|').trim()}}))}else active[input.dataset.sectionField]=input.value},'Saved section changes.'))));
 ui.edit.querySelectorAll('[data-section-action]').forEach(btn=>btn.addEventListener('click',()=>queued(()=>commitSite(p=>{const secs=p.website.pages[idx].sections,index=secs.findIndex(s=>s.id===btn.closest('[data-section]').dataset.section),act=btn.dataset.sectionAction;if(act==='delete'){if(!confirm('Remove this section? You can undo afterward.'))return;secs.splice(index,1)}else if(act==='up'&&index>0)[secs[index-1],secs[index]]=[secs[index],secs[index-1]];else if(act==='down'&&index<secs.length-1)[secs[index],secs[index+1]]=[secs[index+1],secs[index]]},'Updated page section order.'))));
 ui.edit.querySelectorAll('[data-editor-action]').forEach(btn=>btn.addEventListener('click',()=>queued(()=>commitSite(p=>{const w=p.website,action=btn.dataset.editorAction;let name;if(action==='newpage'){name=prompt('Name of new page (e.g. About)');if(!name)return;name=name.trim().slice(0,50);if(w.pages.some(pg=>pg.name.toLowerCase()===name.toLowerCase()))throw Error('Page already exists');w.pages.push(C.page(name,[C.section('hero',name,'Edit your page content here.')]))}else if(action==='addsection'){const type=prompt('Section type: text, hero, features, gallery, contact','text');if(!type)return;if(!['text','hero','features','gallery','contact'].includes(type.toLowerCase().trim()))throw Error('Choose a supported section type');w.pages[idx].sections.push(C.section(type.toLowerCase().trim(),'New section','Edit this text.'))}else if(action==='renamepage'){name=prompt('New page name',w.pages[idx].name);if(!name)return;w.pages[idx].name=name.trim().slice(0,50);w.pages[idx].slug=C.slug(name)}else if(action==='deletepage'){if(!confirm('Delete this page? Undo is available.'))return;w.pages.splice(idx,1);w.selectedPageIndex=0}},'Updated site pages or sections.'))));
}
async function uploadFiles(fileList){if(!project)throw Error('Create a website before uploading photos.');const files=Array.from(fileList);if(!files.length)return;const target=project.id;let n=0;for(const file of files){if(project?.id!==target)throw Error('Active project changed during upload; stopped to avoid misplacing photos.');const a=await C.addAsset(project,file);selectedAsset=a.id;n++}notify(`Added ${n} photo(s) to ${project.name}. Select “Add to this website” in Photos.`);await showAll();switchMobile('photos')}
function photoURL(what){if(what)URL.revokeObjectURL(what)}
async function renderPhotos(){const stamp=project?.id;if(!project){ui.grid.innerHTML='<p>Create a website first.</p>';ui.photoEditor.innerHTML='';return}const srcs=await Promise.all(project.assets.map(async a=>{const blob=await C.getBlob(a.id);return {asset:a,url:blob?URL.createObjectURL(blob):a.dataUrl||''}}));if(project?.id!==stamp)return;ui.grid.innerHTML=srcs.map(({asset:a,url})=>`<button class="asset-tile ${a.id===selectedAsset?'selected':''}" data-asset="${E(a.id)}"><img loading="lazy" src="${url}" alt="${E(a.name)}"><small>${E(a.name)}</small></button>`).join('')||'<p>No photos uploaded yet.</p>';const urls=srcs.map(x=>x.url).filter(u=>u.startsWith('blob:'));setTimeout(()=>urls.forEach(url=>URL.revokeObjectURL(url)),9000);ui.grid.querySelectorAll('[data-asset]').forEach(b=>b.addEventListener('click',()=>{selectedAsset=b.dataset.asset;renderPhotos()}));if(selectedAsset && project.assets.some(a=>a.id===selectedAsset))await showPhotoEditor();else ui.photoEditor.innerHTML='<p>Select a photo to edit, or use the Add photos button.</p>'}
let imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};
async function showPhotoEditor(){photoURL(originalURL);originalURL=null;const a=project.assets.find(a=>a.id===selectedAsset);const blob=await C.getBlob(a.id);if(!blob){ui.photoEditor.textContent='This legacy asset is unavailable. Export your project and reimport it to repair.';return}originalURL=URL.createObjectURL(blob);imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};ui.photoEditor.innerHTML=`<div class="photo-editor"><h3>${E(a.name)}</h3><div class="before-after"><figure><img id="beforeImg" src="${originalURL}" alt="Original photograph"><figcaption>ORIGINAL</figcaption></figure><figure><canvas id="afterCanvas"></canvas><figcaption>LOCAL EDIT PREVIEW</figcaption></figure></div>${[['brightness','Brightness'],['contrast','Contrast'],['saturation','Saturation']].map(([k,t])=>`<div class="range-row"><label for="filter_${k}">${t}</label><input id="filter_${k}" data-filter="${k}" type="range" min="0" max="200" value="100"><output id="output_${k}">100</output></div>`).join('')}<div class="editor-row"><label>Crop<select id="cropSelect"><option value="original">Full image</option><option value="square">Square (1:1)</option><option value="portrait">Portrait (4:5)</option><option value="landscape">Landscape (16:9)</option></select></label><label>Output max size<select id="resizeSelect"><option value="800">800 px</option><option value="1200" selected>1200 px</option><option value="1600">1600 px</option></select></label></div><div class="field-actions"><button id="rotateBtn">↻ Rotate 90°</button><button id="resetPhoto">↶ Reset edits</button><button id="saveEdited" class="primary-action">Save edited copy</button><button id="addPhoto" class="primary-action">＋ Add to this website</button></div><p>Project: <b>${E(project.name)}</b>. Saving creates a new photo asset and keeps the original.</p></div>`;
 const im=new Image();im.onload=()=>{const can=$('#afterCanvas');if(can)drawImageToCanvas(im,can,imageOps)};im.src=originalURL;
 ui.photoEditor.querySelectorAll('[data-filter]').forEach(f=>f.addEventListener('input',()=>{imageOps[f.dataset.filter]=Number(f.value);$('#output_'+f.dataset.filter).textContent=f.value;drawImageToCanvas(im,$('#afterCanvas'),imageOps)}));$('#cropSelect').onchange=e=>{imageOps.crop=e.target.value;drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#resizeSelect').onchange=e=>{imageOps.max=Number(e.target.value);drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#rotateBtn').onclick=()=>{imageOps.rotate=(imageOps.rotate+90)%360;drawImageToCanvas(im,$('#afterCanvas'),imageOps)};$('#resetPhoto').onclick=()=>{imageOps={brightness:100,contrast:100,saturation:100,rotate:0,crop:'original',max:1200};showPhotoEditor()};$('#saveEdited').onclick=()=>queued(async()=>{const can=$('#afterCanvas');if(!can)throw Error('Canvas preview is unavailable');const blob=await new Promise(resolve=>can.toBlob(resolve,'image/jpeg',.87));if(!blob)throw Error('Could not save image');const asset={id:uid(),name:a.name.replace(/\.[^.]+$/,'')+'-edited.jpg',mimeType:'image/jpeg',size:blob.size,width:can.width,height:can.height,createdAt:Date.now(),originalId:a.originalId||a.id};await C.saveBlob(asset.id,blob);project.assets.push(asset);selectedAsset=asset.id;await C.saveProject(project);await renderPhotos();notify('Edited copy saved; original is preserved')});$('#addPhoto').onclick=()=>queued(async()=>{if(project.website.rawHtml)throw Error('Photo editing is available, but automatic photo placement into AI-generated HTML is not connected yet.');const expected=project.id;const res=C.callTool('add_asset_to_project',project,{assetIds:[a.id]});if(!res.changed)throw Error('Image is already in the gallery.');if(project.id!==expected)throw Error('Active project changed.');await C.saveProject(res.project);project=res.project;await showAll();switchMobile('preview');notify('Photo added to the correct website gallery')})}
function drawImageToCanvas(image,canvas,settings){if(!image.complete||!canvas)return;const ratio=({square:1,portrait:4/5,landscape:16/9})[settings.crop];let sw=image.naturalWidth,sh=image.naturalHeight,sx=0,sy=0;if(ratio){if(sw/sh>ratio){const nw=sh*ratio;sx=(sw-nw)/2;sw=nw}else{const nh=sw/ratio;sy=(sh-nh)/2;sh=nh}}const max=Math.min(1600,Math.max(300,settings.max)),size=Math.min(1,max/Math.max(sw,sh)),dw=Math.max(1,Math.round(sw*size)),dh=Math.max(1,Math.round(sh*size)),turn=settings.rotate%180!==0;canvas.width=turn?dh:dw;canvas.height=turn?dw:dh;const ctx=canvas.getContext('2d',{alpha:false});ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(settings.rotate*Math.PI/180);ctx.filter=`brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`;ctx.drawImage(image,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);ctx.restore()}
async function exportAction(action){if(!project)throw Error('Create or open a project first.');if(action==='html'){await C.exportHTML(project);notify('Offline HTML exported')}if(action==='zip'){await C.exportZIP(project);notify('ZIP backup exported')}if(action==='json'){await C.exportJSON(project);notify('JSON backup exported')}}
async function init(){try{await C.openDB();preferences={name:(await C.pref('assistantName'))||'MIKEE',mock:!!(await C.pref('mock'))};$('#assistantNameInput').value=preferences.name;$('#mockToggle').checked=preferences.mock;const items=await C.listProjects(),last=await C.pref('lastProjectId'),target=items.some(p=>p.id===last)?last:items[0]?.id;await activate(target||null);switchMobile(mobileView);$('#storageState').textContent=`Saved projects: ${items.length} · Current storage: this browser on this device`;}catch(e){fail(e);ui.chat.innerHTML=`<p style="padding:20px;color:#f7c0af">Browser storage is unavailable (${E(e.message)}). Open this page on Chrome using HTTPS or localhost. No changes will be saved.</p>`}}
$('#composer').addEventListener('submit',e=>{e.preventDefault();queued(()=>send($('#prompt').value))});$('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit()}});ui.chips.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{queued(()=>send(b.dataset.prompt))});
$('#newProject').onclick=()=>queued(async()=>{const p=C.makeProject('New Chat');p.chatOnly=true;await C.saveProject(p);await activate(p.id);switchMobile('chat');notify('New conversation ready. The title will be chosen from your topic.')});$('#deleteProject').onclick=()=>queued(async()=>{if(!project)return;const name=project.name,id=project.id;if(!confirm(`Delete “${name}”? This cannot be undone. Export a ZIP backup first if you need one.`))return;await C.deleteProject(id);const next=(await C.listProjects())[0];await activate(next?.id||null);notify('Project deleted. Its orphan photo blobs may remain until browser data is cleared.')});$('#renameChat').onclick=()=>queued(async()=>{if(!project)return;const input=prompt('Rename this chat:',project.name);if(input===null)return;const title=input.trim().replace(/\s+/g,' ').slice(0,60);if(!title)return;project.name=title;project.chatTitlePinned=true;project.updatedAt=Date.now();await C.saveProject(project);await refreshList();await showAll();notify('Chat renamed')});ui.select.onchange=e=>queued(()=>activate(e.target.value));$('#undoBtn').onclick=()=>queued(doUndo);
$('#chatSearchBtn').onclick=()=>queued(async()=>{await renderChatSearch();$('#chatSearchDialog').showModal();$('#chatSearchInput').focus()});
$('#closeChatSearch').onclick=()=>$('#chatSearchDialog').close();
$('#chatSearchInput').addEventListener('input',()=>renderChatSearch().catch(fail));
$('#chatSearchResults').addEventListener('click',event=>{const target=event.target.closest('[data-open-chat]');if(!target)return;queued(async()=>{await activate(target.dataset.openChat);$('#chatSearchDialog').close();switchMobile('chat')})});
ui.chat.addEventListener('click',event=>{
 const save=event.target.closest('[data-save-note]');
 if(save){queued(async()=>{if(!project)return;const message=(project.messages||[]).find(m=>m.id===save.dataset.saveNote);if(!message)return;const note=W.createNote(project,W.replyTitle(message.text),message.text);await C.saveProject(project);changeTab('notes');switchMobile('notes');notify('Reply saved as note: '+note.title)});return}
 const btn=event.target.closest('[data-copy-id]');if(!btn)return;const message=(project?.messages||[]).find(m=>m.id===btn.dataset.copyId);if(!message)return;navigator.clipboard.writeText(message.text||'').then(()=>notify('Reply copied.')).catch(()=>notify('Unable to copy automatically on this browser.'));
});
$('#exportChat').onclick=()=>queued(()=>saveChatTranscript());
$('#exportBtn').onclick=()=>queued(()=>exportAction('html'));$('#zipBtn').onclick=()=>queued(()=>exportAction('zip'));$('#fileHTML').onclick=()=>queued(()=>exportAction('html'));$('#fileZIP').onclick=()=>queued(()=>exportAction('zip'));$('#fileJSON').onclick=()=>queued(()=>exportAction('json'));

$('#chatFocus').addEventListener('change',event=>queued(async()=>{
 if(requestPending)return;
 if(!project){project=C.makeProject('New Chat');project.chatOnly=true;await C.setPref('lastProjectId',project.id)}
 const focus=event.target.value;
 if(!['general','learn','write','code','create'].includes(focus))return;
 project.focus=focus;project.updatedAt=Date.now();
 await C.saveProject(project);await refreshList();
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
 project.useSources=$('#useSources').checked;await C.saveProject(project);renderSources();
});
$('#sourceList').onclick=event=>queued(async()=>{
 const button=event.target.closest('[data-remove-source]');
 if(!button||!project||requestPending)return;
 const index=Number(button.dataset.removeSource);
 project.sources=(project.sources||[]).filter((_,i)=>i!==index);
 await C.saveProject(project);renderSources();
 notify('Reference note removed.');
});
$('#settingsButton').onclick=()=>$('#settingsDialog').showModal();$('#saveSettings').onclick=()=>queued(async()=>{preferences.name=($('#assistantNameInput').value.trim()||'MIKEE').slice(0,32);preferences.mock=$('#mockToggle').checked;await C.setPref('assistantName',preferences.name);await C.setPref('mock',preferences.mock);await showAll();notify('Settings saved')});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeTab(b.dataset.view));document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>switchMobile(b.dataset.mobile));window.addEventListener('resize',()=>switchMobile(mobileView));
for(const id of ['chatPhotoFiles','photoFiles'])$('#'+id).onchange=e=>queued(async()=>{await uploadFiles(e.target.files);e.target.value=''});
$('#importFile').onchange=e=>queued(async()=>{const file=e.target.files[0];if(!file)return;const p=await C.importProject(file);await activate(p.id);switchMobile('preview');notify('Project imported. Changes are local to this device.');e.target.value=''});
init();window.OMNI_TEST={getProject:()=>project,getUI:()=>({mobileView,activeView}),queue:()=>queue};
})();
