/* Shared, bounded conversation context and artifact intent. No model or network calls. */
(function(root){
'use strict';
const raw=m=>m?.aiContent??m?.content??m?.text;
const body=m=>String(raw(m)??'');
function selectHistory(items){
 const valid=(Array.isArray(items)?items:[]).slice(-100).filter(m=>['user','assistant'].includes(m?.role)&&m.engine!=='ERROR'&&typeof raw(m)==='string'&&body(m).trim());
 const entries=valid.map((m,index)=>({index,role:m.role,content:/<!doctype html|<html[\s>]/i.test(body(m))?'[Earlier website output; use the current project when editing.]':body(m).slice(0,1800)}));
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
 const text=String(message||'').trim().replace(/^(?:(?:hey|hi|hello)[\s,!:.-]+)?(?:mikee|mickey|mike|nexus)[\s,!:.-]+/i,'').replace(/^(?:please\s+|(?:can|could|would|will) you\s+)+/i,'');
 const explanatory=/^(?:what|why|when|where|explain|describe|teach|how\s+(?:to|do|does|can|would))\b/i.test(text);
 const create=!explanatory&&(/\b(create|build|design|make|generate|develop)\b.{0,90}\b(website|webpage|landing page|web app|html page|site)\b|\b(website|webpage|landing page|site)\b.{0,50}\b(create|build|design|make)\b/i.test(text));
 if(create)return 'website-create';
 if(!hasWebsite||explanatory)return 'chat';
 const namesSite=/\b(website|webpage|landing page|site|hero|header|footer|navigation|layout|theme|button|background|colour|color)\b/i.test(text);
 const otherText=/\b(answer|explanation|report|essay|paragraph|lesson|question|letter|story|poem)\b/i.test(text);
 const last=(Array.isArray(history)?history:[]).filter(m=>m?.role==='assistant'&&m.engine!=='ERROR').at(-1);
 const recentWebsite=history===undefined||/<!doctype html|<html[\s>]/i.test(body(last));
 const edit=/\b(edit|redesign|update|modify|fix|improve|change|add|remove|restyle|rework|make)\b/i.test(text);
 const contextual=/\b(make it|improve it|change it|update it|add a|remove the|fix the|redesign it|restyle it)\b/i.test(text);
 return !otherText&&((namesSite&&edit)||(recentWebsite&&contextual))?'website-edit':'chat';
}
root.OMNI_CONTEXT=Object.freeze({selectHistory,websiteAction});
})(typeof window!=='undefined'?window:globalThis);
