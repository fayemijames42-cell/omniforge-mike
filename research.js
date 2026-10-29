/* OMNIFORGE web evidence adapter.
 * Server-only outbound requests to documented, fixed-host search APIs.
 * Wikipedia offers keyless encyclopedic lookups; Tavily free Researcher plan
 * may be enabled explicitly by a Worker secret for broader web/current search.
 * Search results are EVIDENCE, not proof or automatically verified facts.
 */
/* Deterministic, no-model intent triage. Avoid transmitting private chat to search providers. */
const EXPLICIT=/\b(search (?:the )?(?:web|internet|online)|browse (?:the )?(?:web|internet)|look (?:it )?up online|look up|web search|find (?:online )?sources|check (?:online|the web)|fact.check|verify (?:this|that|the|whether)|cite (?:your |the )?sources|provide (?:reliable )?sources|according to (?:current|latest) sources)\b/i;
const FRESH=/\b(latest|breaking news|most recent|right now|up.to.date|today'?s? (?:news|weather|price|rate|results|events)|this week(?:'s)? (?:news|events)|current (?:news|price|president|prime minister|ceo|weather|exchange rate|rules|laws|regulations|events|research|status|information|date|time|version|release|statistics|leader)|who (?:is|are) (?:the )?(?:current|new|present)|(?:stock|exchange) (?:price|rate) (?:today|now)|weather (?:today|tomorrow|now|this week)|price of .{2,70} (?:today|now))\b/i;
const AUTO_REFERENCE=/^(?:who (?:invented|discovered|founded|developed|created)\b|when (?:was|did) .{2,110}\b(?:invented|discovered|founded|created|built|happen|occur|start)\b|where (?:was|were) .{3,75}\b(?:invented|discovered|founded|born|located)\b|what (?:is|are) (?:a |an |the )?[a-z-]{4,}\b|how (?:does|do|is|are) (?:a |an |the )?[a-z-]{3,}(?: .{1,50})? (?:work|function|produced|made|formed)\b|explain (?:how|why) (?:a |an |the )?[a-z-]{3,})/i;
const PRIVACY=/\b(?:my (?:password|phone|account|address|email|medical|health|school|conversation|personal|family)|confidential|secret|private key|api key|access token|credit card|pin number|passport number|log(?:-| )?in|sign(?:-| )?in|matriculation number|medical records)\b/i;
const BUILD=/\b(?:create|build|design|generate|redesign|develop|edit|fix)\b.{0,90}\b(?:website|webpage|app|landing page|site)\b/i;
const CREATIVE=/^(?:(?:please|can you|could you) +)?(?:write|draft|create|generate|compose|design|imagine|brainstorm|translate|rewrite|summarize|correct|proofread|solve|differentiate|integrate|calculate|evaluate|draw)\b/i;
const STRIP=/^\s*(?:search (?:the )?(?:web|internet|online)(?: for)?|browse (?:the )?(?:web|internet)(?: for)?|look up|find online sources (?:for|about)|verify|fact.check)\s*[:,-]?\s*/i;
const QUESTION_PREFIX=/^(?:please |can you |could you |tell me |show me |give me |what is |what are |who was |who is |who invented |who discovered |when was |where was |how does |how do |how is |explain how |explain why |the meaning of )+/i;
const FOLLOWUP=/^(?:go on|continue|elaborate|explain more|why|how so|tell me more|more details)[.!? ]*$/i;
// Users address their assistant naturally: "MIKEE, who invented the transistor?".
// The old anchored classifier skipped this prefix and never retrieved sources.
export function normalizedQuestion(text){
 let clean=String(text||'').trim();
 clean=clean.replace(/^(?:(?:hey|hi|hello|good morning|good afternoon|good evening)[\s,!:.-]+)?(?:michelle|mikee|mickey|mike|nexus)[\s,!:.-]+/i,'');
 clean=clean.replace(/^(?:(?:please\s+)?(?:can you|could you|would you|will you)\s+(?:(?:please\s+)?(?:tell me|explain to me|help me understand|show me|find out|check)\s+)?|(?:please\s+)?(?:tell me|i want to know|i'd like to know|i need to know)\s+)+/i,'');
 return clean.trim();
}
function searchQuery(text){
 // Keep the first factual question as the search query; later clauses can be
 // answered using the same evidence without submitting the entire chat prompt.
 const first=String(text||'').split(/,?\s+and\s+(?=(?:how|what|who|when|why)\b)/i)[0];
 const plain=first.replace(STRIP,'').replace(QUESTION_PREFIX,'').replace(/^[\s]*(?:a|an|the)\s+/i,'').replace(/[?!.]+$/,'').replace(/\s+/g,' ').trim();
 return plain.slice(0,200)||String(text||'').slice(0,200);
}
export function interpretUserIntent(message,history=[]){
 const text=String(message||'').slice(0,2400).trim();
 const question=normalizedQuestion(text);
 const explicit=EXPLICIT.test(question),fresh=FRESH.test(text);
 const creative=CREATIVE.test(question)||BUILD.test(text);
 const privacySensitive=PRIVACY.test(text)||/\b(?:my|mine|our|ours|i am|i'm|i feel|i have)\b/i.test(text);
 const prior=Array.isArray(history)&&history.some(m=>m?.role==='user'&&typeof m.content==='string');
 const followUp=FOLLOWUP.test(question)||!!prior&&/\b(?:earlier|previous (?:answer|reply|message|example)|above|we discussed|i (?:gave|told|mentioned)|you (?:just )?(?:said|mentioned))\b/i.test(question);
 // A server-side lookup can send the search query to an external service.
 // Protect personal prompts; keep creative and mathematical requests local/model-only.
 let researchMode=privacySensitive||followUp?'none':explicit?'explicit':!creative&&fresh?'automatic':!creative&&AUTO_REFERENCE.test(question)?'automatic':'none';
 const goal=creative?'create-or-compute':/\b(?:compare|versus|vs\.?|difference between|better than)\b/i.test(question)?'compare':/^(?:explain|how|why|teach)\b/i.test(question)?'explain':/\b(?:fact.check|verify|is it true)\b/i.test(question)?'verify':'answer';
 return {goal,researchMode,fresh:followUp?false:fresh,query:searchQuery(question),followUp,privacySensitive,contextAvailable:!!prior};
}
export function researchIntent(message){
 const intent=interpretUserIntent(message);
 return {requested:intent.researchMode!=='none',fresh:intent.fresh,query:intent.query};
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
/* Wikipedia has two documented read APIs. Try the REST endpoint once,
 * then the legacy Action API if it is unavailable/empty. No model call, no
 * search credentials, and never fetch arbitrary user-supplied URLs.
 */
const WIKI_HEADERS={
 'Accept':'application/json',
 'Api-User-Agent':'OMNIFORGE-Research/0.2 (https://omniforge-mike.fayemijames42.workers.dev/; Wikipedia reference)',
 'User-Agent':'OMNIFORGE-Research/0.2 (https://omniforge-mike.fayemijames42.workers.dev/; Wikipedia reference)'
};
function wikiSource(page){
 const key=String(page.key||page.title||'').trim();
 if(!key)return null;
 const title=clean(page.title||key,130);
 const url=urlCheck('https://en.wikipedia.org/wiki/'+encodeURIComponent(key.replace(/ /g,'_')));
 const excerpt=clean([page.description,page.excerpt||page.snippet].filter(Boolean).join('. '),760);
 return title&&url&&excerpt?{title,url,excerpt,publisher:'Wikipedia',publishedAt:null}:null;
}
async function wikiRest(query,fetcher){
 const u=new URL('https://en.wikipedia.org/w/rest.php/v1/search/page');
 u.searchParams.set('q',query);u.searchParams.set('limit','4');
 const data=await jsonLimited(u.toString(),{headers:WIKI_HEADERS},fetcher);
 return (Array.isArray(data.pages)?data.pages:[]).slice(0,4).map(wikiSource).filter(Boolean);
}
async function wikiAction(query,fetcher){
 // Official MediaWiki Action API supports search even where REST API
 // is inaccessible from a particular network; response shape differs.
 const u=new URL('https://en.wikipedia.org/w/api.php');
 for(const [name,value] of Object.entries({
  action:'query',list:'search',srsearch:query,srlimit:'4',
  srnamespace:'0',srprop:'snippet',format:'json',formatversion:'2'
 }))u.searchParams.set(name,value);
 const data=await jsonLimited(u.toString(),{headers:WIKI_HEADERS},fetcher);
 return (Array.isArray(data.query?.search)?data.query.search:[]).slice(0,4)
  .map(p=>wikiSource({title:p.title,key:p.title,snippet:p.snippet})).filter(Boolean);
}
async function encyclopedia(query,fetcher){
 let firstError='';
 try{
  const results=await wikiRest(query,fetcher);
  if(results.length)return results;
  firstError='REST search returned no usable sources';
 }catch(error){firstError=String(error?.message||error).slice(0,120)}
 try{
  return await wikiAction(query,fetcher);
 }catch(error){
  throw Error('Both Wikipedia search methods were unavailable: '+firstError+'; '+String(error?.message||error).slice(0,120));
 }
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
export async function collectEvidence(query,env,fetcher=fetch,options={}){
 const intent=options.intent||researchIntent(query);
 const requested=options.intent?intent.researchMode!=='none':intent.requested;
 const retrievedAt=new Date().toISOString();
 if(!requested)return {requested:false,sources:[],retrievedAt,scope:'none'};
 const hasWeb=typeof env?.TAVILY_API_KEY==='string'&&env.TAVILY_API_KEY.trim().length>10;
 if(intent.fresh&&!hasWeb)return {requested:true,sources:[],retrievedAt,scope:'encyclopedia-only',error:'Live, web-wide search is not configured yet. Michelle cannot independently verify current or breaking information. Please connect an approved search provider first.'};
 const queries=(Array.isArray(options.queries)&&options.queries.length?options.queries:[intent.query]).slice(0,2).map(q=>String(q).slice(0,200));
 const results=await Promise.allSettled(queries.map(q=>hasWeb?webSearch(q,env.TAVILY_API_KEY,fetcher):encyclopedia(q,fetcher)));
 const groups=results.map(r=>r.status==='fulfilled'?r.value:[]),sources=[],seen=new Set();
 // Interleave results so the first query cannot crowd out a second requested topic.
 for(let rank=0;rank<4&&sources.length<4;rank++)for(const group of groups){
  const source=group[rank];if(source&&!seen.has(source.url)&&sources.length<4){seen.add(source.url);sources.push(source);}
 }
 const partial=groups.some(group=>!group.length);
 const error=sources.length?'':results.some(r=>r.status==='rejected')?'Search retrieval failed. No usable sources were returned.':'No usable search evidence was found. Try a more specific topic.';
 return {requested:true,sources,retrievedAt,scope:hasWeb?'web-search':'wikipedia',queryCount:queries.length,partial,error};
}
export function evidenceText(result){
 return (result.sources||[]).slice(0,4).map((s,i)=>
  '['+(i+1)+'] '+s.title+' | '+s.publisher+' | '+s.url+'\nExcerpt: '+s.excerpt+'\nRetrieved: '+result.retrievedAt).join('\n\n');
}
