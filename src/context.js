/* Shared, bounded conversation context and artifact intent. No model or network calls. */
(function(root){
'use strict';
const raw=m=>m?.aiContent??m?.content??m?.text;
const body=m=>String(raw(m)??'');
const IDENTITY=Object.freeze({name:'Michelle',displayName:'MICHELLE',platform:'OMNIFORGE',owner:'ADEN INC.'});
function taskText(message){
 return String(message||'').trim().replace(/^(?:(?:hey|hi|hello)[\s,!:.-]+)?(?:michelle|mikee|mickey|mike|nexus)[\s,!:.-]+/i,'').replace(/^(?:(?:please\s+|(?:can|could|would|will) you\s+)|(?:i (?:want|need) (?:you )?to|i'd like (?:you )?to|let's)\s+)+/i,'').trim();
}
function programmingRequest(message){
 const text=taskText(message);
 if(/\b(?:never|do not|don't|stop)\b.{0,45}\b(?:reveal|expose|share|disclose)\b|\b(?:your|internal|private) (?:source |application |backend )?code\b/i.test(text))return false;
 return /\b(?:debug|programming|html|css|javascript|typescript|python|firmware|express(?:\.js)?|node\.?js|cloudflare worker|sql|source code|write code|code review)\b/i.test(text)||/^(?:write|generate|create|show|explain|fix)\b.{0,70}\b(?:code|function|algorithm|backend|api|json)\b/i.test(text);
}
function imagePrompt(message){
 const text=taskText(message);
 const match=text.match(/^(?:generate|genrate|create|make|draw|render|design|produce)\s+(?:(?:me|us)\s+)?(?:(?:an?|the)\s+)?(?:image|picture|photo|photograph|illustration|artwork|painting)\s*(?:of|showing|depicting|with|about|for)?\s+(.+)$/i);
 // Explicit vector/code requests belong in programming, never the raster queue.
 return match&&!/\b(?:svg|vector|html|code)\b/i.test(text)&&match[1].trim().length>1?text.slice(0,900):null;
}
const websiteReference=message=>/\b(?:website|webpage|landing page|current (?:site|project)|previous site|site we|we (?:just )?(?:created|built|made)|what did we (?:just )?(?:create|build|make))\b/i.test(message);
const websiteCheckRequest=message=>/^(?:check|test|verify|inspect|review|audit)\b.{0,90}\b(?:website|webpage|site|page)\b/i.test(taskText(message))&&!/\b(?:explain|how to|how can|how do)\b/i.test(message);
function projectRecallQuestion(message){
 const text=taskText(message);
 return /^(?:what|which)\s+(?:website|site|project)\s+(?:(?:did|have) we|(?:is|was) (?:this|active|current|open)|are we (?:editing|working on))\b/i.test(text)||/^what (?:did|have) we (?:just )?(?:create|build|make|created|built|made)\b/i.test(text)||/^(?:what is|what's) (?:the )?(?:name|title) of (?:the |my |our |this |current |active )*(?:website|site|project)\b/i.test(text);
}
function projectRecallReply(summary){
 const title=String(summary?.title||summary?.name||'Untitled website').replace(/\s+/g,' ').trim().slice(0,140);
 return 'The active website in this conversation is “'+title+'”.';
}
function selectHistory(items){
 const valid=(Array.isArray(items)?items:[]).slice(-100).filter(m=>['user','assistant'].includes(m?.role)&&m.engine!=='ERROR'&&typeof raw(m)==='string'&&body(m).trim());
 const entries=valid.map((m,index)=>({index,role:m.role,content:m.artifactType==='website'||/<!doctype html|<html[\s>]/i.test(body(m))?'[Earlier website output; that turn is complete. Only the latest request authorizes changes.]':body(m).slice(0,1800)}));
 const anchors=entries.filter(m=>m.role==='user').slice(0,2), chosen=new Map();
 let used=0;
 // Preserve early user requirements as actual quoted turns, never an invented summary.
 for(const m of anchors){const content=m.content.slice(0,1200);chosen.set(m.index,{...m,content});used+=content.length;}
 for(const m of [...entries].reverse()){
  if(chosen.has(m.index))continue;
  if(chosen.size>=12)break;
  if(used+m.content.length>9000)continue;
  chosen.set(m.index,m);used+=m.content.length;
 }
 return [...chosen.values()].sort((a,b)=>a.index-b.index).map(({role,content})=>({role,content}));
}
function websiteAction(message,hasWebsite=false,history){
 const text=taskText(message);
 // Match the requested object, not an action quoted or mentioned later in prose.
 // Raster requests and code for a site must never become website documents.
 const explanatory=/^(?:what|who|why|when|where|explain|describe|teach|how\s+(?:to|do|does|can|would)|(?:tell|show)\s+(?:me|us)\s+how|(?:check|test|verify|inspect|review|audit)\b|(?:i\s+)?(?:do not|don't|never|stop|avoid)\b)/i.test(text);
 const programming=/^(?:write|debug|explain|show|review)\b/i.test(text)&&programmingRequest(text)||/^(?:create|build|generate|fix|update)\b.{0,45}\b(?:python|node\.?js|express(?:\.js)?|sql|backend|server|script|function|api|svg|vector)\b/i.test(text);
 if(explanatory||imagePrompt(text)||programming)return 'chat';
 const construction=text.match(/^(create|build|design|make|generate|develop)\s+([^.!?;:\n"'`]{0,90}?)\b(website|webpage|landing page|web app|html page|site)\b(.*)$/i);
 if(construction&&!/\b(?:for|on|inside|to|of|that|which|button|header|footer|section|form|image|icon|logo|component|code)\b/i.test(construction[2])){
  // "Make a website" creates; "make the website pink" edits the saved site.
  const restyle=construction[1].toLowerCase()==='make'&&!/\b(?:a|an|new|another)\b/i.test(construction[2])&&(/\b(?:the|my|our|this|current|existing)\b/i.test(construction[2])||construction[4].trim().length>1)&&!/^\s+(?:for|about|called|named)\b/i.test(construction[4]);
  return restyle?(hasWebsite?'website-edit':'chat'):'website-create';
 }
 if(!hasWebsite||explanatory)return 'chat';
 const namesSite=/\b(website|webpage|landing page|site|hero|header|footer|navigation|layout|theme|button|background|colour|color)\b/i.test(text);
 const otherText=/\b(answer|explanation|report|essay|paragraph|lesson|question|letter|story|poem)\b/i.test(text);
 const last=(Array.isArray(history)?history:[]).filter(m=>m?.role==='assistant'&&m.engine!=='ERROR').at(-1);
 const recentWebsite=history===undefined||last?.artifactType==='website'||/<!doctype html|<html[\s>]|^\[Earlier website output;/i.test(body(last));
 const edit=/^(?:edit|redesign|update|modify|fix|improve|change|add|remove|replace|set|restyle|rework|make)\b/i.test(text)||/^(?:create|build|design|generate)\b.{0,50}\b(?:button|header|footer|section|form|navigation|component)\b/i.test(text);
 const contextual=/^(?:make it|improve it|change it|update it|add a|remove the|fix the|redesign it|restyle it)\b/i.test(text);
 return !otherText&&((namesSite&&edit)||(recentWebsite&&contextual))?'website-edit':'chat';
}
function projectSummary(project,html){
 if(!project||project.chatOnly)return null;
 const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
 const source=String(html||'').slice(0,350000).replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi,'');
 return {name:plain(project.name),title:plain(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]),headings:[...source.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].slice(0,6).map(x=>plain(x[1])),savedLocally:true};
}
function websiteDocument(reply){
 const text=String(reply||''),match=text.match(/<!doctype html[\s\S]*?<\/html\s*>/i)||text.match(/<html[\s\S]*?<\/html\s*>/i),html=match?.[0]||'',issues=[];
 if(!html)issues.push('The website response is incomplete. The previous project must be kept.');
 for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){
  if(/\b(?:require\s*\(\s*['"](?:express|node:|fs['"]|http['"])|from\s*['"](?:express|node:)|module\.exports|app\.listen\s*\()/i.test(script[1])){issues.push('Server-side code was returned in a browser script. The previous project must be kept.');break;}
 }
 return {html,complete:!!html,valid:!!html&&!issues.length,issues};
}
root.OMNI_CONTEXT=Object.freeze({IDENTITY,taskText,programmingRequest,imagePrompt,websiteReference,websiteCheckRequest,projectRecallQuestion,projectRecallReply,projectSummary,websiteDocument,selectHistory,websiteAction});
})(typeof window!=='undefined'?window:globalThis);
