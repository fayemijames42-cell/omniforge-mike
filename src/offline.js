/* OMNIFORGE Local Knowledge — retrieval, not an offline language model.
   No AI calls, no eval, no private-chat harvesting. */
(function(root){'use strict';
const DB='omniforge-local-knowledge',HOUR=3600000,MAX_XML=2*1024*1024;
const REFERENCE_KEY='publicReferenceV1',LOOKUP_KEY='publicLookupsV1',MAX_LOOKUPS=128,wiki=root.OMNI_WIKIPEDIA;
const STOP=new Set('a an and are as at be by can could do does for from how i in is it me my of on or our please the their there these this to us was were what when where which who why will with would you your tell explain about give show help know define describe into using uses used work works michelle him her them'.split(' '));
const FRESH=/\b(?:latest|today|right now|breaking|this week|as of|currently|most recent|(?:current|recent)\s+(?:news|weather|price|rates?|results|events|government|president|rules|laws|status|data|research|population|information))\b/i;
let dbPromise,memo=null,bundledSync,seedSync,dailySync,nextDailyCheck=0;
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
function publicMatch(query,entries){
 const terms=words(query);
 if(!terms.length||terms.length>12||FRESH.test(query))return null;
 let winner=null,best=0;
 for(const record of entries){
  const title=words(record.question);
  const keys=new Set([...title,...words(record.tags)]);
  if(!terms.every(term=>keys.has(term)))continue;
  if(terms.length===1&&!title.includes(terms[0]))continue;
  const value=terms.join(' ')===title.join(' ')?3:1+title.filter(term=>terms.includes(term)).length/title.length;
  if(value>best){winner=record;best=value}
 }
 return winner;
}
function openDB(){
 if(dbPromise)return dbPromise;
 const opening=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  let blocked=false;
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('entries'))db.createObjectStore('entries',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta')};
  req.onerror=()=>reject(req.error||Error('Knowledge storage unavailable.'));
  req.onblocked=()=>{blocked=true;reject(Error('Knowledge storage is open in another tab.'))};
  req.onsuccess=()=>{
   const db=req.result;
   if(blocked){db.close();return}
   db.onversionchange=()=>{db.close();dbPromise=null;memo=null};
   db.onclose=()=>{dbPromise=null;memo=null};
   resolve(db);
  };
 });
 dbPromise=opening.catch(error=>{dbPromise=null;throw error});
 return dbPromise;
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
async function refreshBundled(force){
 if(!force&&Date.now()-(await getMeta('checkedAt')||0)<HOUR)return {status:'recent'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('/src/knowledge.xml',{cache:'no-cache',signal:controller.signal});
  if(!response.ok)throw Error('Starter pack unavailable.');
  const entries=parseXML(await response.text(),{prefix:'builtin',source:'OMNIFORGE bundled reference'});
  if(!entries.length)throw Error('Starter pack is empty.');
  await addMany(entries);
  await setMeta('checkedAt',Date.now());return {status:'updated',count:entries.length};
 }catch(e){return {status:'unavailable',message:String(e?.message||e)}}
 finally{clearTimeout(timer)}
}
function syncBundled({force=false}={}){
 if(!bundledSync)bundledSync=refreshBundled(force).finally(()=>{bundledSync=null});
 return bundledSync;
}
function parseSnapshot(data){
 const {updatedAt,entries}=wiki.validateSnapshot(data);
 return {updatedAt,entries:entries.map(({id,question,answer,tags,url,retrievedAt})=>({
  id,question,answer,tags,url,retrievedAt,source:'Wikipedia',kind:'public',license:wiki.license,
 }))};
}
async function saveSnapshot(snapshot){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),read=store.get(REFERENCE_KEY);
  let updated=false;
  read.onsuccess=()=>{
   if(read.result&&read.result.updatedAt>=snapshot.updatedAt)return;
   store.put(snapshot,REFERENCE_KEY);updated=true;
  };
  tx.oncomplete=()=>resolve(updated);
  tx.onabort=()=>reject(tx.error||Error('Daily reference save aborted.'));
 });
}
async function downloadSnapshot(url,cache,timeout){
 const controller=new AbortController();
 let timer;
 try{
  return await Promise.race([
   (async()=>{
    const response=await fetch(url,{cache,signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
    return wiki.validateSnapshot(await wiki.readJSON(response,controller.signal));
   })(),
   new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(Error('Daily reference refresh timed out.'));},timeout);
   }),
  ]);
 }finally{clearTimeout(timer)}
}
function syncSeed(){
 if(!seedSync)seedSync=(async()=>{
  if(await getMeta(REFERENCE_KEY))return;
  const release=document.querySelector('meta[name="omniforge-build"]')?.content;
  const path='/src/reference-seed.json'+(release?'?v='+encodeURIComponent(release):'');
  const snapshot=await downloadSnapshot(path,'default',4000);
  await saveSnapshot(parseSnapshot(snapshot));
 })().catch(()=>{}).finally(()=>{seedSync=null});
 return seedSync;
}
async function refreshDaily(force){
 const seed=syncSeed();
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return {status:'offline'};
 if(!force&&Date.now()<nextDailyCheck)return {status:'recent'};
 if(!force&&Date.now()-(await getMeta('referenceCheckedAt')||0)<HOUR)return {status:'recent'};
 nextDailyCheck=Date.now()+300000;
 const cache=force?'no-cache':'default';
 try{
  const served=await downloadSnapshot('/api/reference-bank',cache,4800).catch(()=>null);
  // A bundled response means the Worker could not verify the publisher's copy.
  // The public file can also be downloaded without sending any visitor data.
  const published=!served||served.delivery==='bundled'?
   await downloadSnapshot(wiki.snapshotUrl,cache,4500).catch(()=>null):served;
  const latest=published&&(!served||published.updatedAt>=served.updatedAt)?published:served;
  if(!published&&latest){
   await saveSnapshot(parseSnapshot(latest));
   return {status:'unavailable'};
  }
  if(!latest){await seed;return {status:'unavailable'}}
  const changed=await saveSnapshot(parseSnapshot(latest));
  await setMeta('referenceCheckedAt',Date.now());
  return {status:changed?'updated':'recent',count:latest.entries.length};
 }catch{return {status:'unavailable'}}
}
function syncDaily({force=false}={}){
 if(!dailySync)dailySync=refreshDaily(force).finally(()=>{dailySync=null});
 return dailySync;
}
const pendingRefresh=()=>Promise.allSettled([bundledSync,seedSync,dailySync]);
async function saveLookups(data){
 const retrievedAt=data.research.retrievedAt;
 const entries=data.sources.slice(0,4).map(source=>({
  id:'lookup-'+new URL(source.url).searchParams.get('oldid'),
  question:source.title,tags:'',url:source.url,answer:source.excerpt,retrievedAt,
 }));
 const snapshot=parseSnapshot({format:1,publisher:'Wikipedia',license:wiki.license,updatedAt:retrievedAt,entries});
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),read=store.get(LOOKUP_KEY);
  read.onsuccess=()=>{
   const records=new Map((read.result||[]).map(record=>[record.question,record]));
   for(const entry of snapshot.entries){
    if(!records.has(entry.question)||records.get(entry.question).retrievedAt<=entry.retrievedAt)records.set(entry.question,entry);
   }
   store.put([...records.values()].sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)).slice(0,MAX_LOOKUPS),LOOKUP_KEY);
  };
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error||Error('Wikipedia results could not be saved.'));
 });
}
function retrieve(query,records,publicRecords){
 const local=bestMatch(query,records);
 const reference=publicMatch(query,publicRecords);
 if(local&&local.kind!=='builtin')return local;
 if(reference&&(!local||words(query).join(' ')===words(reference.question).join(' ')))return reference;
 return local||reference;
}
async function answer(query){
 if(FRESH.test(query))return {found:false,text:'This question needs up-to-date information. Saved references cannot verify the latest answer.'};
 const [records,snapshot,lookups]=await Promise.all([list(),getMeta(REFERENCE_KEY),getMeta(LOOKUP_KEY)]);
 const publicRecords=[...(snapshot?.entries||[]),...(lookups||[])].sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
 const comparison=query.match(/^(?:please\s+)?(?:compare|(?:what(?: is|'s) the )?difference between)\s+(.{2,90}?)\s+(?:and|with|versus|vs\.?)\s+(.{2,90}?)[?.!]*$/i);
 if(comparison){
  const left=retrieve(comparison[1],records,publicRecords),right=retrieve(comparison[2],records,publicRecords);
  if(left&&right&&left.id!==right.id&&clean(left.question).toLowerCase()!==clean(right.question).toLowerCase())return {found:true,kind:'comparison',text:'Saved references for both topics:\n\n**'+left.question+'**\n'+left.answer+'\n\n**'+right.question+'**\n'+right.answer,records:[left,right]};
  return {found:false,text:'I did not find two distinct saved entries for this comparison.'};
 }
 const match=retrieve(query,records,publicRecords);
 return match?{found:true,text:match.answer,question:match.question,source:match.source,kind:match.kind,records:[match]}:{found:false,text:'I did not find a close match in saved references. While online, choose Wikipedia lookup for a public topic or use Cloud AI when it is available.'};
}
async function stats(){
 const entries=await list();const estimate=typeof navigator!=='undefined'&&navigator.storage?.estimate?await navigator.storage.estimate().catch(()=>null):null;
 const [snapshot,lookups]=await Promise.all([getMeta(REFERENCE_KEY),getMeta(LOOKUP_KEY)]);
 return {records:entries.length,usage:estimate?.usage??null,quota:estimate?.quota??null,checkedAt:await getMeta('checkedAt')||0,
  publicRecords:snapshot?.entries.length||0,lookupRecords:lookups?.length||0,publicUpdatedAt:snapshot?.updatedAt||null};
}
root.OMNI_KNOWLEDGE={words,score,bestMatch,publicMatch,parseXML,parseSnapshot,addRecord,importFile,syncBundled,syncDaily,saveLookups,pendingRefresh,answer,stats,list};
})(window);
