import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('public',{recursive:true});
await copyFile('index.html','public/index.html');
await copyFile('sw.js','public/sw.js');
await cp('src','public/src',{recursive:true});
await cp('vendor','public/vendor',{recursive:true});
console.log('Workspace assets built');
