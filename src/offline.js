/* OMNIFORGE Local Knowledge — retrieval, not an offline language model.
   No AI calls, no eval, no private-chat harvesting. */
(function(root){'use strict';
const DB='omniforge-local-knowledge',HOUR=3600000,MAX_XML=2*1024*1024;
const STOP=new Set('a an and are as at be by can could do does for from how i in is it me my of on or our please the their there these this to us was were what when where which who why will with would you your tell explain about give show help know define describe into using uses used work works'.split(' '));
let dbPromise,memo=null;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const words=s=>[...new Set(clean(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>1&&!STOP.has(w)))];
function score(query,r){
 const input=words(query);if(!input.length)return 0;
 const keys=new Set(words(r.question+' '+(r.tags||''))),matches=input.filter(w=>keys.has(w)).length;
 if(input.length===1?matches!==1:matches<2)return 0;
 let value=matches/input.length;
 if(clean(query).toLowerCase()===clean(r.question).toLowerCase())value+=2;
 if(input.length>=2&&matches===input.length)value+=.3;
 return value;
}
function bestMatch(query,entries){
 let winner=null,best=0;
 for(const entry of entries){const n=score(query,entry);if(n>best){winner=entry;best=n}}
 return best>=.62?winner:null;
}
function openDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('entries'))db.createObjectStore('entries',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta')};
  req.onerror=()=>reject(req.error||Error('Knowledge storage unavailable.'));req.onsuccess=()=>resolve(req.result);
 });return dbPromise;
}
async function request(store,mode,fn){
 const db=await openDB();
 return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),op=fn(tx.objectStore(store));tx.oncomplete=()=>resolve(op?.result);tx.onerror=()=>reject(tx.error||Error('Storage failed.'));tx.onabort=()=>reject(tx.error||Error('Storage aborted.'))});
}
const getMeta=key=>request('meta','readonly',os=>os.get(key));
const setMeta=(key,v)=>request('meta','readwrite',os=>os.put(v,key));
async function list(){if(memo)return memo;memo=await request('entries','readonly',os=>os.getAll())||[];return memo}
async function addRecord(data){
 const question=clean(data.question).slice(0,300),answer=String(data.answer||'').trim().slice(0,6000);
 if(!question||!answer)throw Error('Both a topic and its answer are required.');
 const id=data.id||'saved:'+Date.now()+':'+Math.random().toString(36).slice(2);
 const record={id,question,answer,tags:clean(data.tags).slice(0,400),source:clean(data.source||'User-approved memory').slice(0,140),kind:data.kind||'personal',savedAt:Date.now()};
 await request('entries','readwrite',os=>os.put(record));memo=null;return record;
}
function parseXML(xml,options={}){
 if(xml.length>MAX_XML)throw Error('XML exceeds 2 MB; split it into smaller packs.');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD/entity declarations are not permitted.');
 if(typeof DOMParser==='undefined')throw Error('XML parsing is unavailable.');
 const dom=new DOMParser().parseFromString(xml,'application/xml');
 if(dom.querySelector('parsererror')||dom.documentElement.tagName.toLowerCase()!=='knowledge')throw Error('Invalid knowledge XML.');
 const elements=[...dom.getElementsByTagName('entry')];if(elements.length>2000)throw Error('Import 2,000 entries or fewer per file.');
 const prefix=options.prefix||'import:'+Date.now(),defaultSource=options.source||'Imported XML';
 return elements.map((el,index)=>{
  const field=n=>el.getElementsByTagName(n)[0]?.textContent?.trim()||'';
  const question=field('question').slice(0,300),answer=field('answer').slice(0,6000);
  if(!question||!answer)return null;
  const safeId=clean(el.getAttribute('id')||String(index)).replace(/[^a-z0-9_.-]/gi,'_').slice(0,90);
  return {id:prefix+':'+safeId,question,answer,tags:field('tags').slice(0,400),source:(field('source')||defaultSource).slice(0,140),kind:prefix==='builtin'?'builtin':'import',savedAt:Date.now()};
 }).filter(Boolean);
}
async function addMany(entries){
 const db=await openDB();
 for(let i=0;i<entries.length;i+=100)await new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite'),os=tx.objectStore('entries');entries.slice(i,i+100).forEach(r=>os.put(r));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
 memo=null;return entries.length;
}
async function importFile(file){
 if(!file||file.size>MAX_XML)throw Error('Select an XML file smaller than 2 MB.');
 const safe=clean(file.name).replace(/[^a-z0-9_.-]/gi,'_').slice(0,45);
 return addMany(parseXML(await file.text(),{prefix:'import:'+Date.now()+':'+safe,source:safe}));
}
async function syncBundled({force=false}={}){
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return {status:'offline'};
 if(!force&&Date.now()-(await getMeta('checkedAt')||0)<HOUR)return {status:'recent'};
 try{
  const response=await fetch('/src/knowledge.xml',{cache:'no-cache',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Starter pack unavailable.');
  const entries=parseXML(await response.text(),{prefix:'builtin',source:'OMNIFORGE bundled reference'});
  if(entries.length)await addMany(entries);
  await setMeta('checkedAt',Date.now());return {status:'updated',count:entries.length};
 }catch(e){return {status:'unavailable',message:String(e?.message||e)}}
}
async function answer(query){
 const match=bestMatch(query,await list());
 return match?{found:true,text:match.answer,question:match.question,source:match.source,kind:match.kind}:{found:false,text:'I do not have a sufficiently close saved answer for that question. Local knowledge is a searchable reference library, not a full offline AI brain. Import more knowledge, save an answer manually, or try Cloud AI when available.'};
}
async function stats(){
 const entries=await list();const estimate=typeof navigator!=='undefined'&&navigator.storage?.estimate?await navigator.storage.estimate().catch(()=>null):null;
 return {records:entries.length,usage:estimate?.usage??null,quota:estimate?.quota??null,checkedAt:await getMeta('checkedAt')||0};
}
root.OMNI_KNOWLEDGE={words,score,bestMatch,parseXML,addRecord,importFile,syncBundled,answer,stats,list};
})(window);
