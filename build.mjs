import {mkdir,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import manifest from './package.json' with {type:'json'};
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});const lists=await Promise.all(entries.map(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]));return lists.flat();}
const paths=['build.mjs','index.html','sw.js',...await files('src'),...await files('vendor')].sort(),hash=createHash('sha256');
for(const path of paths)hash.update(path+'\0').update(await readFile(path));
const buildId=manifest.version+'-'+hash.digest('hex').slice(0,12);
const template=await readFile('index.html','utf8');
const shellLink=/((?:src|href)="\.\/)((?:src|vendor)\/[^"?]+\.(?:js|css))"/g;
const versionedPath=path=>'/'+path+'?v='+buildId;
const integrity=async path=>'sha256-'+createHash('sha256').update(await readFile(path)).digest('base64');
const shellAssets=Object.fromEntries(await Promise.all(
 [...template.matchAll(shellLink)].map(async ([,,path])=>[versionedPath(path),await integrity(path)])
));
shellAssets['/src/knowledge.xml']=await integrity('src/knowledge.xml');
shellAssets[versionedPath('src/reference-seed.json')]=await integrity('src/reference-seed.json');
const html=template.replace('</title>','</title><meta name="omniforge-build" content="'+buildId+'">');
const versionedHTML=html.replace(shellLink,(_,prefix,path)=>{
 const url=versionedPath(path);
 return prefix+url.slice(1)+'" integrity="'+shellAssets[url]+'"';
});
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
await writeFile('public/index.html',versionedHTML);
await writeFile('public/sw.js',(await readFile('sw.js','utf8')).replaceAll('__BUILD_ID__',buildId).replace("'__SHELL_ASSETS__'",JSON.stringify(shellAssets)));
let sourceCommit=null;try{const value=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(/^[a-f0-9]{40}$/.test(value))sourceCommit=value;}catch{}
await writeFile('public/build-info.json',JSON.stringify({version:manifest.version,buildId,sourceCommit}));
await cp('src','public/src',{recursive:true});await cp('vendor','public/vendor',{recursive:true});
console.log('Workspace assets built: '+buildId);
