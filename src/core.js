/* OMNIFORGE core: browser-only local projects; no network/provider calls. MIT licensed. */
(function (global) {
'use strict';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const projectBases=new WeakMap();
function clone(value){
 const copy=JSON.parse(JSON.stringify(value));
 const base=projectBases.get(value);
 if(base&&copy?.id===base.id)projectBases.set(copy,base);
 return copy;
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = () => uuid();
const palettes = {
  midnight: {primary:'#181f38', secondary:'#d9c6a5', accent:'#d6b578', background:'#121727', text:'#f9f6ef', fontHeading:'Georgia,serif', fontBody:'system-ui,sans-serif'},
  light: {primary:'#fff9ef',secondary:'#234642',accent:'#d17f50',background:'#fbf7ee',text:'#182729',fontHeading:'Georgia,serif',fontBody:'system-ui,sans-serif'},
  indigo: {primary:'#191e48',secondary:'#e7e0ff',accent:'#b5a4ff',background:'#141636',text:'#fffaff',fontHeading:'system-ui,sans-serif',fontBody:'system-ui,sans-serif'},
  forest: {primary:'#144436',secondary:'#f0e8cd',accent:'#c1e19b',background:'#0f2c25',text:'#f7f6ed',fontHeading:'Georgia,serif',fontBody:'system-ui,sans-serif'}
};
const section = (type, title, content = '', children = []) => ({id:id(),type,title,content,children});
const page = (name, sections = []) => ({id:id(), name, slug:slug(name), sections});
const slug = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'home';
function makeProject(title='New Chat') {const now=Date.now();return {id:id(),type:'website',name:title,version:1,createdAt:now,updatedAt:now,website:{pages:[page('Home',[])],theme:clone(palettes.light),meta:{title,description:'',email:'',whatsappNumber:''},layout:'general',headingScale:1},assets:[],messages:[],history:[],selectedAssetId:null};}
function assertProject(p){if(!p || typeof p.id!=='string'|| !p.website ||!Array.isArray(p.website.pages)) throw Error('Invalid website project');}
function snapshot(p){return {name:p.name,website:clone(p.website),chatOnly:!!p.chatOnly,codeWorkspace:p.codeWorkspace?{...clone(p.codeWorkspace),history:[]}:null};}
function change(p,fn) {assertProject(p);const before=JSON.stringify(snapshot(p)); const next=clone(p);fn(next);if(JSON.stringify(snapshot(next))===before)return {project:p,changed:false};next.history=[...(p.history||[]),snapshot(p)].slice(-24);next.version=(p.version||0)+1;next.updatedAt=Date.now();return {project:next,changed:true};}
function undo(p) {const history=p.history||[]; if(!history.length)throw Error('No previous website version to restore.');const next=clone(p), last=history[history.length-1];next.name=last.name;next.website=last.website;if('chatOnly' in last)next.chatOnly=last.chatOnly;if('codeWorkspace' in last){if(last.codeWorkspace)next.codeWorkspace=last.codeWorkspace;else delete next.codeWorkspace;}next.history=history.slice(0,-1);next.version++;next.updatedAt=Date.now();return next;}
function safeColor(c){return /^#[0-9a-f]{3,8}$/i.test(c)?c:'#8888bb'}
function addAssetsToProject(project,assetIds){
 if(!Array.isArray(assetIds)||assetIds.length>100)throw Error('Select valid project photos.');
 return change(project,p=>{const all=new Set(p.assets.map(a=>a.id)),chosen=assetIds.filter(id=>all.has(id));if(!chosen.length)throw Error('No selected photos belong to the current project.');const pg=p.website.pages[0];if(!pg)throw Error('Create a website before adding photos.');let gallery=pg.sections.find(s=>s.type==='gallery');if(!gallery){gallery=section('gallery','Photo gallery','');pg.sections.push(gallery)}const present=new Set((gallery.children||[]).map(x=>x.props?.assetId));for(const assetId of chosen)if(!present.has(assetId)){gallery.children.push({id:id(),type:'image',props:{assetId,alt:p.assets.find(a=>a.id===assetId)?.name||'Photo'}});present.add(assetId);}});
}
const DB='omniforge-db';let dbPromise;
function openDB(){
 if(dbPromise)return dbPromise;
 let abandoned=false;
 const opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,2);
  request.onerror=()=>reject(request.error||Error('Unable to access IndexedDB'));
  request.onblocked=()=>{
   abandoned=true;
   reject(Error('Saved conversations are in use by another OMNIFORGE tab. Close that tab and reload.'));
  };
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('projects')){
    const projects=db.createObjectStore('projects',{keyPath:'id'});
    projects.createIndex('updatedAt','updatedAt',{unique:false});
   }
   if(!db.objectStoreNames.contains('assetBlobs'))db.createObjectStore('assetBlobs',{keyPath:'id'});
   if(!db.objectStoreNames.contains('prefs'))db.createObjectStore('prefs');
  };
  request.onsuccess=()=>{
   const db=request.result;
   if(abandoned){db.close();return}
   db.onversionchange=()=>{
    db.close();
    dbPromise=null;
   };
   db.onclose=()=>{dbPromise=null};
   resolve(db);
  };
 });
 dbPromise=opening.catch(error=>{dbPromise=null;throw error});
 return dbPromise;
}
async function txReq(store,mode,action){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode),os=t.objectStore(store);const req=action(os);t.oncomplete=()=>resolve(req?.result);t.onabort=()=>reject(t.error||Error('IndexedDB transaction aborted'));t.onerror=()=>reject(t.error||Error('IndexedDB transaction failed'));})}
const projectVersion=project=>project?.storageRevision;
function trackProject(project){
 if(project&&typeof project==='object'){
  const revision=projectVersion(project);
  projectBases.set(project,{id:project.id,revision,legacy:revision===undefined?JSON.stringify(project):null});
 }
 return project;
}
const getProject=async key=>trackProject(await txReq('projects','readonly',os=>os.get(key)))||null;
const listProjects=async()=>((await txReq('projects','readonly',os=>os.getAll()))||[]).sort((a,b)=>b.updatedAt-a.updatedAt);
function projectConflict(id){
 const error=Error('This conversation changed in another tab. Review the latest saved version, then retry your edit.');
 error.code='PROJECT_CONFLICT';
 error.projectId=id;
 return error;
}
function assertCurrent(id,stored,base){
 const matches=base?.id===id
  ?stored&&projectVersion(stored)===base.revision&&(base.legacy===null||JSON.stringify(stored)===base.legacy)
  :!stored;
 if(!matches)throw projectConflict(id);
}
async function saveProject(project,files=[]){
 const base=projectBases.get(project);
 const record={...clone(project),storageRevision:uuid()};
 const db=await openDB();
 await new Promise((resolve,reject)=>{
  const transaction=db.transaction(files.length?['projects','assetBlobs']:'projects','readwrite');
  const projects=transaction.objectStore('projects');
  const read=projects.get(record.id);
  let failure;
  transaction.oncomplete=resolve;
  transaction.onabort=()=>reject(failure||transaction.error||Error('Project storage transaction aborted'));
  read.onsuccess=()=>{
   try{
    assertCurrent(record.id,read.result,base);
    if(files.length){
     const blobs=transaction.objectStore('assetBlobs');
     for(const file of files)blobs.add(file);
    }
    projects.put(record);
   }catch(error){failure=error;transaction.abort()}
  };
 });
 project.storageRevision=record.storageRevision;
 return trackProject(project);
}
async function deleteProject(project){
 const id=project.id,base=projectBases.get(project);
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','assetBlobs'],'readwrite');
  const projects=tx.objectStore('projects'),blobs=tx.objectStore('assetBlobs'),read=projects.getAll();
  let failure;
  read.onsuccess=()=>{
   try{
    const removed=read.result.find(item=>item.id===id);
    assertCurrent(id,removed,base);
    const used=new Set(read.result.filter(item=>item.id!==id).flatMap(item=>(item.assets||[]).map(asset=>asset.id)));
    for(const asset of removed.assets||[])if(!used.has(asset.id))blobs.delete(asset.id);
    projects.delete(id);
   }catch(error){failure=error;tx.abort()}
  };
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(failure||tx.error||Error('Could not delete project'));
 });
}
const getBlob=async assetId=> (await txReq('assetBlobs','readonly',os=>os.get(assetId)))?.blob ||null;
const pref=async(key)=>txReq('prefs','readonly',os=>os.get(key));
const setPref=(key,value)=>txReq('prefs','readwrite',os=>os.put(value,key));
function formatMigrated(old){
 const p=clone(old);
 p.messages=Array.isArray(p.messages)?p.messages.filter(message=>message&&typeof message==='object'):[];
 p.history=Array.isArray(p.history)?p.history:[];
 p.assets=Array.isArray(p.assets)?p.assets:[];
 p.sources=Array.isArray(p.sources)?p.sources.filter(note=>note&&typeof note.name==='string'&&typeof note.content==='string'):[];
 const base=makeProject(p.name).website;
 if(!p.website||typeof p.website!=='object'||Array.isArray(p.website))p.website=base;
 p.website.pages=Array.isArray(p.website.pages)?p.website.pages:base.pages;
 p.website.theme={...base.theme,...p.website.theme};
 p.website.meta={...base.meta,...p.website.meta};
 p.website.layout=p.website.layout||'general';
 p.website.headingScale=p.website.headingScale||1;
 return p;
}

async function addAsset(p,file,{originalId,reply,signal}={}){
 if(!file.type.match(/^image\/(jpeg|png|webp)$/))throw Error('Use PNG, JPG or WebP photos.');
 if(file.size>8*1024*1024)throw Error(`“${file.name}” exceeds the 8 MB photo limit.`);
 if(p.assets.length>=60)throw Error('This project has reached the 60-photo limit.');
 const data=await imageDimensions(file);if(data.width*data.height>20000000)throw Error('Image exceeds 20 megapixels. Resize it before import.');
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const asset={id:id(),name:file.name.slice(0,100),mimeType:file.type,width:data.width,height:data.height,createdAt:Date.now(),size:file.size,...(originalId?{originalId}:{})};
 const next=clone(p);next.assets.push(asset);next.updatedAt=Date.now();
 if(reply)next.messages=[...next.messages,{...reply,imageId:asset.id}];
 // Commit the bytes, project metadata and any image reply together.
 await saveProject(next,[{id:asset.id,blob:file}]);
 p.assets=next.assets;p.messages=next.messages;p.updatedAt=next.updatedAt;p.storageRevision=next.storageRevision;
 trackProject(p);
 return asset;
}

function imageDimensions(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve({width:im.naturalWidth,height:im.naturalHeight})};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image could not be decoded.'))};im.src=url})}
function blobData(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(r.result);r.readAsDataURL(blob)})}
async function assetMap(project,strict=false,source){
 const map=Object.create(null);
 let placed;
 if(typeof source==='string'){
  placed=new Set();
  if(project.codeWorkspace||project.website.rawHtml){
   for(const match of source.matchAll(/omniforge-asset:\/\/([a-zA-Z0-9-]+)/g))placed.add(match[1]);
  }else{
   for(const page of project.website.pages){
    for(const section of page.sections){
     if(section.type!=='gallery')continue;
     for(const child of section.children||[])if(child.type==='image')placed.add(child.props?.assetId);
    }
   }
  }
 }
 for(const asset of project.assets){
  if(placed&&!placed.has(asset.id))continue;
  const blob=await getBlob(asset.id);
  if(blob)map[asset.id]=await blobData(blob);
  else if(/^data:image\/(jpeg|png|webp);base64,/i.test(asset.dataUrl||''))map[asset.id]=asset.dataUrl;
  else if(strict)throw Error('Saved photo data is missing: '+(asset.name||asset.id));
 }
 return map;
}
function renderSite(p,images={}){
 const active=p.codeWorkspace?global.OMNI_FILES.exportDocument(p):p.website.rawHtml;
 if(active)return active.replace(/omniforge-asset:\/\/([a-zA-Z0-9-]+)/g,(source,id)=>/^data:image\/(jpeg|png|webp);base64,/i.test(images[id]||'')?images[id]:source);
 const w=p.website,meta=w.meta,theme=w.theme,pages=w.pages,headingScale=Math.max(.6,Math.min(1.9,w.headingScale||1));const color=safeColor(theme.accent||'#e0b983');const nav=pages.map((pg,i)=>`<a href="#/${encodeURIComponent(pg.slug)}" data-route="${esc(pg.slug)}">${esc(pg.name)}</a>`).join('');
 const sectionHTML=s=>{const cards=(s.children||[]).filter(c=>c.type==='card').map(c=>`<article class="card"><h3>${esc(c.props?.title)}</h3><p>${esc(c.props?.text)}</p></article>`).join('');const img=(s.children||[]).filter(c=>c.type==='image').map(c=>{const src=images[c.props?.assetId]||'';return /^data:image\/(jpeg|png|webp);base64,/i.test(src)?`<figure class="tile"><img loading="lazy" src="${src}" alt="${esc(c.props?.alt||'Image')}"><figcaption>${esc(c.props?.alt||'')}</figcaption></figure>`:''}).join('');const heading=`<h2>${esc(s.title||'')}</h2>`;const content=s.content?`<p>${esc(s.content).replace(/\n/g,'<br>')}</p>`:'';if(s.type==='hero')return `<section class="hero"><div class="eyebrow">${esc(meta.title)}</div><h1>${esc(s.title||meta.title)}</h1>${content}<a class="cta" href="#/${encodeURIComponent(pages.some(p=>p.name==='Contact')?'contact':'home')}" onclick="document.getElementById('reach')?.scrollIntoView({behavior:'smooth'})">Explore →</a></section>`;
 if(s.type==='gallery')return `<section class="section gallery">${heading}${content}<div class="tiles">${img||'<div class="placeholder">Your photos will appear here.</div>'}</div></section>`;
 if(s.type==='features')return `<section class="section features">${heading}${content}<div class="cards">${cards||'<div class="card">Add cards in the editor.</div>'}</div></section>`;
 if(s.type==='contact'){const email=String(meta.email||'').trim();const wa=String(meta.whatsappNumber||'').replace(/\D/g,'');const links=[email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)?`<a href="mailto:${esc(email)}" class="cta">Email us →</a>`:'',wa.length>=8&&wa.length<=15?`<a href="https://wa.me/${wa}" class="cta" rel="noopener noreferrer" target="_blank">WhatsApp →</a>`:''].filter(Boolean).join(' ');return `<section class="section contact" id="reach">${heading}${content}${links||'<small>Contact links will appear after you add your real details.</small>'}</section>`}return `<section class="section">${heading}${content}</section>`};
 const pageHTML=pages.map(pg=>`<article class="page" data-page="${esc(pg.slug)}" hidden>${pg.sections.map(sectionHTML).join('')}</article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(meta.description||'')}"><title>${esc(meta.title)}</title><style>:root{--bg:${safeColor(theme.background)};--text:${safeColor(theme.text)};--primary:${safeColor(theme.primary)};--accent:${color};--scale:${headingScale};}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,sans-serif}header{padding:22px clamp(18px,5vw,65px);display:flex;align-items:center;gap:12px;justify-content:space-between;border-bottom:1px solid currentColor}header strong{letter-spacing:.12em;font-size:13px;max-width:40%;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:clamp(9px,2.5vw,25px)}nav a{color:inherit;text-decoration:none;opacity:.84;font-size:13px}nav a.current{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:5px}.page{margin:0 auto;max-width:1140px;padding:0 clamp(22px,5vw,65px)}.hero{min-height:360px;padding:clamp(65px,10vw,115px) 0 clamp(50px,8vw,110px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;border-bottom:1px solid currentColor}.eyebrow{letter-spacing:.18em;font-size:11px;text-transform:uppercase;color:var(--accent)}h1{font:700 calc(clamp(38px,6vw,80px)*var(--scale))/1.1 Georgia,serif;letter-spacing:-.045em;max-width:860px;margin:23px 0 11px}h2{font:600 calc(clamp(27px,3.5vw,43px)*var(--scale))/1.15 Georgia,serif;letter-spacing:-.03em;margin:0 0 16px}.hero p,.section>p{white-space:normal;max-width:620px;opacity:.78;font-size:clamp(15px,1.7vw,18px)}.cta{color:#1c2028;background:var(--accent);text-decoration:none;display:inline-flex;padding:11px 18px;border-radius:6px;font-size:14px;font-weight:700;margin-top:20px}.section{padding:65px 0;border-bottom:1px solid currentColor}.cards,.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:18px;margin-top:30px}.card,.tile,.placeholder{margin:0;padding:23px;border:1px solid currentColor;border-radius:10px;min-height:150px}.card h3{margin:0 0 10px}.card p{opacity:.78}.tile{padding:0;overflow:hidden}.tile img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.tile figcaption{font-size:13px;padding:10px 13px;opacity:.8}.placeholder{opacity:.68}footer{padding:30px;text-align:center;font-size:12px;opacity:.65}.contact small{display:block;opacity:.7}article[hidden]{display:none!important}@media(max-width:420px){header{align-items:flex-start;flex-direction:column}.hero{min-height:250px}.section{padding:44px 0}nav{gap:15px}h1{font-size:calc(40px*var(--scale))}}</style></head><body><header><strong>${esc(meta.title)}</strong><nav id="nav">${nav}</nav></header><main>${pageHTML}</main><footer>© ${new Date().getFullYear()} ${esc(meta.title)} · Created with OMNIFORGE</footer><script>(function(){function route(){var r=decodeURIComponent((location.hash.startsWith('#/')?location.hash.slice(2):''))||'${esc(pages[0]?.slug||'home')}';var a=Array.from(document.querySelectorAll('.page'));if(!a.some(x=>x.dataset.page===r))r='${esc(pages[0]?.slug||'home')}';a.forEach(x=>{x.hidden=x.dataset.page!==r});document.querySelectorAll('#nav a').forEach(x=>{x.classList.toggle('current',x.dataset.route===r)});window.scrollTo(0,0)}window.addEventListener('hashchange',route);route()})()<\/script></body></html>`;
}
function download(blob,filename){const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),6000)}
const fileSafe=t=>slug(t).slice(0,60)||'website';
async function exportHTML(p){const html=renderSite(p,await assetMap(p,false,renderSite(p)));download(new Blob([html],{type:'text/html;charset=utf-8'}),fileSafe(p.name)+'.html');return html}
function portableProject(project){
 const copy=clone(project);
 delete copy.storageRevision;
 copy.history=[];
 if(copy.codeWorkspace)copy.codeWorkspace.history=[];
 for(const note of copy.notes||[])note.history=[];
 copy.assets=copy.assets.map(asset=>({...asset,dataUrl:undefined}));
 if(!global.OMNI_BACKUP)throw Error('Backup support did not load. Refresh the page.');
 global.OMNI_BACKUP.validate(copy);
 return copy;
}
function portableAssets(project,map){
 for(const asset of project.assets){
  const encoded=map[asset.id].match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i);
  const payload=encoded?.[2]||'';
  const size=Math.floor(payload.replace(/=+$/,'').length*3/4);
  if(!encoded||encoded[1].toLowerCase()!==asset.mimeType||size===0||size>global.OMNI_BACKUP.MAX_IMAGE){
   throw Error('Saved photo cannot be included in a restorable backup: '+(asset.name||asset.id));
  }
 }
 return map;
}
function downloadBackup(blob,name){
 if(blob.size>global.OMNI_BACKUP.MAX_FILE)throw Error('The backup exceeds the 55 MB restore limit. Export the chat or website separately, or remove unused photos.');
 download(blob,name);
 return blob;
}
async function exportZIP(project){
 if(!global.JSZip)throw Error('ZIP library unavailable.');
 const zip=new global.JSZip(),portable=portableProject(project);
 const metadata=JSON.stringify(portable,null,2);
 if(new TextEncoder().encode(metadata).length>global.OMNI_BACKUP.MAX_META)throw Error('Project metadata exceeds the portable ZIP limit. Export the conversation as Markdown.');
 zip.file('project.json',metadata);
 const map=portableAssets(project,await assetMap(project,true));
 for(const asset of project.assets){
  const data=map[asset.id].split(',')[1];
  const extension=asset.mimeType==='image/png'?'png':asset.mimeType==='image/webp'?'webp':'jpg';
  zip.file('assets/'+asset.id+'.'+extension,data,{base64:true});
 }
 if(project.codeWorkspace)for(const [name,text] of Object.entries(global.OMNI_FILES.validate(project).files))zip.file(name,text);
 zip.file('site.html',renderSite(project,map));
 zip.file('README.txt','OMNIFORGE project backup. Import this ZIP from the Files & Backup tab. site.html is a standalone offline website.');
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
 return downloadBackup(blob,fileSafe(project.name)+'.zip');
}
async function exportJSON(project){
 const copy=portableProject(project),map=portableAssets(project,await assetMap(project,true));
 copy.assets=copy.assets.map(asset=>({...asset,dataUrl:map[asset.id]}));
 const blob=new Blob([JSON.stringify(copy)],{type:'application/json'});
 return downloadBackup(blob,fileSafe(project.name)+'.omniforge.json');
}

function sandboxHTML(source){
 const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none';\">";
 const html=String(source||'').replace(/<base\b[^>]*>/gi,'').replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b[^>]*>/gi,'');
 // The policy must precede even malformed markup with a script before its head.
 // The browser normalizes the following saved document; exports remain byte-faithful.
 return '<!doctype html><head>'+csp+'</head>'+html.replace(/^\s*<!doctype[^>]*>/i,'');
}
async function importProject(file){if(!global.OMNI_BACKUP)throw Error('Backup support did not load. Refresh the page.');return global.OMNI_BACKUP.importProject(file);}
async function migrateLegacySite(){
 if(await pref('legacy-site-imported'))return;
 let html;try{html=global.localStorage?.getItem('omniforge_site');}catch{return;}
 if(typeof html!=='string'||!/<html[\s>][\s\S]*<\/html>/i.test(html)||html.length>1500000)return;
 const key='omniforge-legacy-quick-chat';
 if(!await getProject(key)){
  const project=makeProject('Previous MICHELLE website');project.id=key;project.website.rawHtml=html;project.chatOnly=false;
  await saveProject(project).catch(error=>{if(error.code!=='PROJECT_CONFLICT')throw error});
 }
 await setPref('legacy-site-imported',true);
}
const API={uuid,clone,esc,palettes,section,page,slug,makeProject,change,undo,addAssetsToProject,formatMigrated,openDB,getProject,listProjects,saveProject,deleteProject,getBlob,pref,setPref,addAsset,imageDimensions,blobData,assetMap,renderSite,download,exportHTML,exportZIP,exportJSON,importProject,sandboxHTML,migrateLegacySite,snapshot};global.OMNI=API;
})(window);
