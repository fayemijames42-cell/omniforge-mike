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
function searchQuery(text){
 const plain=String(text||'').replace(STRIP,'').replace(QUESTION_PREFIX,'').replace(/^[\s]*(?:a|an|the)\s+/i,'').replace(/[?!.]+$/,'').replace(/\s+/g,' ').trim();
 return plain.slice(0,200)||String(text||'').slice(0,200);
}
export function interpretUserIntent(message,history=[]){
 const text=String(message||'').slice(0,2400).trim();
 const explicit=EXPLICIT.test(text),fresh=FRESH.test(text);
 const creative=CREATIVE.test(text)||BUILD.test(text);
 const privacySensitive=PRIVACY.test(text)||/\b(?:my|mine|our|ours|i am|i'm|i feel|i have)\b/i.test(text);
 const followUp=FOLLOWUP.test(text);
 // A server-side lookup can send the search query to an external service.
 // Protect personal prompts; keep creative and mathematical requests local/model-only.
 let researchMode=privacySensitive||followUp?'none':explicit?'explicit':!creative&&fresh?'automatic':!creative&&AUTO_REFERENCE.test(text)?'automatic':'none';
 const goal=creative?'create-or-compute':/\b(?:compare|versus|vs\.?|difference between|better than)\b/i.test(text)?'compare':/^(?:explain|how|why|teach)\b/i.test(text)?'explain':/\b(?:fact.check|verify|is it true)\b/i.test(text)?'verify':'answer';
 const prior=Array.isArray(history)&&history.some(m=>m?.role==='user'&&typeof m.content==='string');
 return {goal,researchMode,fresh:followUp?false:fresh,query:searchQuery(text),followUp,contextAvailable:!!prior};
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
