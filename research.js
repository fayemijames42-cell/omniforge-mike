/* OMNIFORGE web evidence adapter.
 * Server-only outbound requests to documented, fixed-host search APIs.
 * Wikipedia offers keyless encyclopedic lookups; Tavily free Researcher plan
 * may be enabled explicitly by a Worker secret for broader web/current search.
 * Search results are EVIDENCE, not proof or automatically verified facts.
 */
const SIGNAL=/\b(search (?:the )?(?:web|internet|online)|browse (?:the )?(?:web|internet)|look (?:it )?up online|look up|web search|find (?:online )?sources|check (?:online|the web)|fact.check|verify (?:this|that|the|whether)|according to (?:current|latest) sources|latest|today|yesterday|this week|breaking news|up.to.date|most recent|right now|current (?:news|price|president|weather|events|research|status|information))\b/i;
const FRESH=/\b(latest|today|yesterday|this week|breaking|right now|up.to.date|most recent|current (?:news|price|president|weather|events|status|information)|202[6-9] news)\b/i;
const CHECK=/^\s*(?:search (?:the )?(?:web|internet|online)(?: for)?|browse (?:the )?(?:web|internet)(?: for)?|look up|find online sources (?:for|about)|verify|fact.check)\s*[:,-]?\s*/i;
export function researchIntent(message){
 const text=String(message||'').slice(0,2400).trim();
 const requested=SIGNAL.test(text);
 const fresh=FRESH.test(text);
 // A web query should reflect the user's actual words, without irrelevant instructions.
 return {requested,fresh,query:text.replace(CHECK,'').slice(0,200).trim()||text.slice(0,200)};
}
function clean(value,n=600){
 return String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|lt|gt|nbsp|#39);/gi,x=>({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&nbsp;':' ','&#39;':"'"}[x.toLowerCase()]||' ')).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
}
function urlCheck(url){
 try{
  const u=new URL(String(url));
  if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
  if(u.hostname==='localhost'||/\.(?:local|internal)$/.test(u.hostname))return '';
  return u.toString().slice(0,650);
 }catch{return ''}
}
async function jsonLimited(url,options={},fetcher=fetch){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetcher(url,{...options,signal:controller.signal,redirect:'error'});
  if(!response.ok)throw Error('Search source is unavailable (HTTP '+response.status+').');
  const contentLength=Number(response.headers?.get('content-length')||0);
  if(contentLength>95000)throw Error('Search result exceeded the safety size limit.');
  const body=await response.text();
  if(body.length>95000)throw Error('Search result exceeded the safety size limit.');
  return JSON.parse(body);
 }finally{clearTimeout(timeout)}
}
async function encyclopedia(query,fetcher){
 const u=new URL('https://en.wikipedia.org/w/rest.php/v1/search/page');
 u.searchParams.set('q',query);u.searchParams.set('limit','4');
 const data=await jsonLimited(u.toString(),{headers:{'Accept':'application/json','User-Agent':'OMNIFORGE-Research/0.1 (https://omniforge-mike.fayemijames42.workers.dev/; encyclopedia reference)' }},fetcher);
 const items=Array.isArray(data.pages)?data.pages:[];
 return items.slice(0,4).map(p=>({
  title:clean(p.title||p.key,130),
  url:urlCheck('https://en.wikipedia.org/wiki/'+encodeURIComponent(String(p.key||p.title||'').replace(/ /g,'_'))),
  excerpt:clean([p.description,p.excerpt].filter(Boolean).join('. '),760),
  publisher:'Wikipedia',publishedAt:null
 })).filter(x=>x.title&&x.url&&x.excerpt);
}
async function webSearch(query,key,fetcher){
 const data=await jsonLimited('https://api.tavily.com/search',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,search_depth:'basic',max_results:4,topic:'general',include_answer:false,include_raw_content:false,include_images:false,auto_parameters:false,safe_search:true})},fetcher);
 const results=Array.isArray(data.results)?data.results:[];
 return results.slice(0,4).map(p=>({
  title:clean(p.title,150),url:urlCheck(p.url),excerpt:clean(p.content,850),
  publisher:(()=>{try{return new URL(p.url).hostname}catch{return 'Search result'}})(),
  publishedAt:null
 })).filter(x=>x.title&&x.url&&x.excerpt);
}
export async function collectEvidence(query,env,fetcher=fetch){
 const intent=researchIntent(query);
 const retrievedAt=new Date().toISOString();
 if(!intent.requested)return {requested:false,sources:[],retrievedAt,scope:'none'};
 const hasWeb=typeof env?.TAVILY_API_KEY==='string'&&env.TAVILY_API_KEY.trim().length>10;
 if(intent.fresh&&!hasWeb)return {requested:true,sources:[],retrievedAt,scope:'encyclopedia-only',error:'Live, web-wide search is not configured yet. MIKEE cannot independently verify current or breaking information. Please connect an approved search provider first.'};
 try{
  const sources=hasWeb?await webSearch(intent.query,env.TAVILY_API_KEY,fetcher):await encyclopedia(intent.query,fetcher);
  return {requested:true,sources,retrievedAt,scope:hasWeb?'web-search':'wikipedia',error:sources.length?'':'No usable search evidence was found. Try a more specific topic.'};
 }catch(e){return {requested:true,sources:[],retrievedAt,scope:hasWeb?'web-search':'wikipedia',error:'Search retrieval failed. '+clean(e.message,150)}}
}
export function evidenceText(result){
 return (result.sources||[]).slice(0,4).map((s,i)=>
  '['+(i+1)+'] '+s.title+' | '+s.publisher+' | '+s.url+'\nExcerpt: '+s.excerpt+'\nRetrieved: '+result.retrievedAt).join('\n\n');
}
