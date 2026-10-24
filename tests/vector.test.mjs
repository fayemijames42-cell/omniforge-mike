import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime={window:{}};vm.createContext(runtime);
vm.runInContext(readFileSync(new URL('../src/vector.js',import.meta.url),'utf8'),runtime);
const V=runtime.window.OMNI_VECTOR;
test('recognizes SVG illustration code in previously saved AI responses',()=>{
 const raw='<svg width="200" height="200"><circle cx="100" cy="100" r="60"/></svg>';
 assert.equal(V.extract('Illustration:\\n'+raw+'\\nThis is a drawing'),raw);
 assert.equal(V.extract('No SVG produced'),null);
 assert.equal(V.extract('x'.repeat(40000)),null);
});
test('generates image data URI without fetching an external image or executing code',()=>{
 const uri=V.dataURI('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
 assert.ok(uri.includes('%3Csvg'));
});
