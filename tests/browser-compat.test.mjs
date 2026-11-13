import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parse} from 'acorn';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
test('Workspace scripts and the offline worker parse on the supported older Chromium baseline',()=>{
 assert.ok(scripts.length>1);
 // Chromium 83 accepts ES2020 syntax. Newer browser APIs are exercised in the mobile smoke test.
 for(const [,attributes,inline] of scripts){
  const path=attributes.match(/\bsrc="([^"]+)"/)?.[1];
  const source=path?readFileSync(new URL(path,new URL('../',import.meta.url)),'utf8'):inline;
  assert.doesNotThrow(()=>parse(source,{ecmaVersion:2020}),path||'inline startup script');
 }
 const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>parse(worker,{ecmaVersion:2020}),'offline worker');
});
