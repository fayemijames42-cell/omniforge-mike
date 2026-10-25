import {mkdir,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import manifest from './package.json' with {type:'json'};
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});const lists=await Promise.all(entries.map(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]));return lists.flat();}
const paths=['index.html','sw.js',...await files('src'),...await files('vendor')].sort(),hash=createHash('sha256');
for(const path of paths)hash.update(path+'\0').update(await readFile(path));
const buildId=manifest.version+'-'+hash.digest('hex').slice(0,12);
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
const html=(await readFile('index.html','utf8')).replace(/((?:src|href)="\.\/(?:src|vendor)\/[^"?]+\.(?:js|css))"/g,'$1?v='+buildId+'"');
await writeFile('public/index.html',html);await writeFile('public/sw.js',(await readFile('sw.js','utf8')).replaceAll('__BUILD_ID__',buildId));
await cp('src','public/src',{recursive:true});await cp('vendor','public/vendor',{recursive:true});
console.log('Workspace assets built: '+buildId);
