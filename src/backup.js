/* Portable project restoration. Source remains intact; only sandboxed previews execute it. */
(function(root){'use strict';
const C=root.OMNI,MAX_FILE=55*1024*1024,MAX_IMAGE=8*1024*1024,MAX_META=3000000;
const imageType=type=>['image/jpeg','image/png','image/webp'].includes(type);
const extension=type=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
async function zipBytes(entry,maximum){
 if(Number(entry._data?.uncompressedSize)>maximum)throw Error('Backup entry exceeds its size limit.');
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0,failed=false;
  const stream=entry.internalStream('uint8array');
  stream.on('data',chunk=>{if(failed)return;size+=chunk.length;if(size>maximum){failed=true;stream.pause();reject(Error('Backup entry exceeds its size limit.'));return;}chunks.push(chunk);});
  stream.on('error',reject);stream.on('end',()=>{if(failed)return;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}resolve(bytes);});stream.resume();
 });
}
function validate(project){
 if(!project||typeof project!=='object'||!project.website||!Array.isArray(project.website.pages)||!Array.isArray(project.assets))throw Error('Invalid OMNIFORGE project.');
 if(project.website.pages.length>35||project.assets.length>60)throw Error('Project exceeds the page or photo limit.');
 for(const page of project.website.pages)if(!page||!Array.isArray(page.sections)||page.sections.length>200)throw Error('Invalid page sections.');
 const ids=new Set();for(const asset of project.assets){if(typeof asset?.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(asset.id)||ids.has(asset.id)||!imageType(asset.mimeType))throw Error('Invalid or duplicated photo entry.');ids.add(asset.id);}
 if(project.website.rawHtml!=null&&(typeof project.website.rawHtml!=='string'||project.website.rawHtml.length>1500000))throw Error('Website HTML exceeds 1.5 MB.');
 if(project.codeWorkspace)root.OMNI_FILES.validate(project);
}
async function importProject(file){
 if(file.size>MAX_FILE)throw Error('Import file exceeds 55 MB.');
 const name=file.name.toLowerCase();
 if(/\.html?$/.test(name)){
  const html=await file.text();if(html.length>1500000)throw Error('HTML file exceeds 1.5 MB.');
  const title=(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'Imported website').replace(/<[^>]+>/g,'').slice(0,70);
  const project=C.makeProject(title);project.website.rawHtml=html;project.chatOnly=false;await C.saveProject(project);return project;
 }
 let project,archive=null;
 if(name.endsWith('.zip')){
  if(!root.JSZip)throw Error('ZIP library unavailable.');archive=await root.JSZip.loadAsync(file);
  const entry=archive.file('project.json');if(!entry)throw Error('Not an OMNIFORGE backup: project.json is missing.');
  project=JSON.parse(new TextDecoder().decode(await zipBytes(entry,MAX_META)));
 }else if(name.endsWith('.json'))project=JSON.parse(await file.text());
 else throw Error('Import an OMNIFORGE .zip/.json backup or an HTML file.');
 if(!project||typeof project!=='object'||Array.isArray(project)||typeof project.id!=='string'||!project.website||!Array.isArray(project.assets))throw Error('Invalid OMNIFORGE project.');project=C.formatMigrated(project);validate(project);
 const mapping=new Map(project.assets.map(a=>[a.id,C.uuid()])),created=[],photos=project.assets;
 const remap=text=>String(text).replace(/omniforge-asset:\/\/([a-zA-Z0-9-]+)/g,(all,id)=>mapping.has(id)?'omniforge-asset://'+mapping.get(id):all);
 const restored=C.clone(project);restored.id=C.uuid();restored.createdAt=Date.now();restored.updatedAt=Date.now();restored.version=1;restored.history=[];
 restored.messages=Array.isArray(restored.messages)?restored.messages.slice(-100):[];
 restored.assets=photos.map(a=>({...a,id:mapping.get(a.id),originalId:mapping.get(a.originalId)||null,dataUrl:undefined}));
 restored.selectedAssetId=mapping.get(restored.selectedAssetId)||null;
 for(const page of restored.website.pages)for(const section of page.sections)for(const child of section.children||[])if(child.props?.assetId)child.props.assetId=mapping.get(child.props.assetId)||'';
 for(const message of restored.messages){for(const key of ['assetId','imageId'])if(message[key])message[key]=mapping.get(message[key])||null;if(typeof message.aiContent==='string')message.aiContent=remap(message.aiContent);}
 if(restored.website.rawHtml)restored.website.rawHtml=remap(restored.website.rawHtml);
 if(restored.codeWorkspace){for(const key of root.OMNI_FILES.KEYS)restored.codeWorkspace.files[key]=remap(restored.codeWorkspace.files[key]);restored.codeWorkspace.history=[];}
 try{
  // Decompress and store one photo at a time; do not retain a whole album in RAM.
  for(const asset of photos){
   let blob;
   if(archive){const entry=archive.file('assets/'+asset.id+'.'+extension(asset.mimeType));if(entry)blob=new Blob([await zipBytes(entry,MAX_IMAGE)],{type:asset.mimeType});}
   else if(asset.dataUrl){if(typeof asset.dataUrl!=='string'||asset.dataUrl.length>Math.ceil(MAX_IMAGE*4/3)+100||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/i.test(asset.dataUrl))throw Error('Invalid embedded photo.');blob=await(await fetch(asset.dataUrl)).blob();if(blob.size>MAX_IMAGE)throw Error('Embedded photo exceeds 8 MB.');}
   if(!blob)throw Error('Backup is missing photo data for '+String(asset.name||asset.id)+'.');
   const id=mapping.get(asset.id);created.push(id);await C.saveBlob(id,blob);
  }
  await C.saveProject(restored);return restored;
 }catch(error){await C.removeBlobs(created).catch(()=>{});throw error;}
}
root.OMNI_BACKUP=Object.freeze({importProject});
})(window);
