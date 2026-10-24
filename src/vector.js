/* Restricted SVG previews: no arbitrary HTML or script execution. */
(function(root){'use strict';
const ns='http://www.w3.org/2000/svg';
const tags=new Set('svg g rect circle ellipse line polyline polygon path text tspan defs linearGradient radialGradient stop'.split(' '));
const attrs=new Set('width height viewBox x y x1 y1 x2 y2 cx cy r rx ry d points fill fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-opacity opacity transform font-size font-weight text-anchor dominant-baseline letter-spacing id offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod'.split(' '));
function extract(text){
 const match=String(text||'').match(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/i);
 return match&&match[0].length<=36000&&!/<!DOCTYPE|<!ENTITY/i.test(match[0])?match[0]:null;
}
function sanitize(markup){
 if(!markup||typeof DOMParser==='undefined'||typeof document==='undefined')return null;
 if(markup.length>36000||/<!DOCTYPE|<!ENTITY/i.test(markup))return null;
 const parsed=new DOMParser().parseFromString(markup,'image/svg+xml');
 if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')return null;
 let count=0;
 function copy(node){
  if(++count>240)throw Error('SVG too complex');
  if(node.nodeType===3)return document.createTextNode((node.nodeValue||'').slice(0,1400));
  if(node.nodeType!==1||!tags.has(node.localName))return null;
  const target=document.createElementNS(ns,node.localName);
  for(const attr of [...node.attributes]){
   if(!attrs.has(attr.name))continue;
   const value=attr.value.trim();
   if(value.length>4200||/url\s*\(|javascript:|data:|https?:|@import|[<>]/i.test(value))continue;
   if(['width','height'].includes(attr.name)&&!/^\d{1,4}(?:\.\d{1,2})?(?:px)?$/.test(value))continue;
   if(attr.name==='id'&&!/^[a-zA-Z][a-zA-Z0-9_-]{0,60}$/.test(value))continue;
   target.setAttribute(attr.name,value);
  }
  for(const child of [...node.childNodes]){const safe=copy(child);if(safe)target.appendChild(safe)}
  return target;
 }
 try{
  const result=copy(parsed.documentElement);
  if(!result)return null;
  result.setAttribute('xmlns',ns);
  if(!result.hasAttribute('viewBox')&&!result.hasAttribute('width'))result.setAttribute('viewBox','0 0 400 400');
  if(!result.hasAttribute('width'))result.setAttribute('width','400');
  if(!result.hasAttribute('height'))result.setAttribute('height','400');
  return new XMLSerializer().serializeToString(result);
 }catch{return null}
}
function convertResponse(text){
 const raw=extract(text);if(!raw)return null;
 const svg=sanitize(raw);if(!svg)return null;
 return {svg,explanation:String(text).replace(raw,'').trim().slice(0,1500)};
}
function dataURI(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
root.OMNI_VECTOR={extract,sanitize,convertResponse,dataURI};
})(window);