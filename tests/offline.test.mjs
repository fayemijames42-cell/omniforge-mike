import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},Date,Math,Number,String,Set,Error,Object};
vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../src/offline.js',import.meta.url),'utf8'),sandbox);
const K=sandbox.window.OMNI_KNOWLEDGE;
const facts=[{question:'What is a diode?',tags:'diode electronics current forward reverse',answer:'A semiconductor component.'},{question:'What is Ohm law?',tags:'voltage current resistance ohm law',answer:'V=IR.'}];
test('offline retrieval requires meaningful topic overlap',()=>{
 assert.equal(K.bestMatch('What is a diode?',facts).question,'What is a diode?');
 assert.equal(K.bestMatch('What is Ohm law?',facts).answer,'V=IR.');
 assert.equal(K.bestMatch('What is a diode and a meteor shower?',facts),null);
 assert.equal(K.bestMatch('Tell me all about dogs?',facts),null);
});
test('offline normalization is deterministic and ignores conversational filler',()=>{
 assert.ok(K.words('Please explain what a DIODE is').includes('diode'));
 assert.equal(K.bestMatch('hi',facts),null);
});

// Regression guards: service-worker shell must contain every local knowledge script.
import {existsSync} from 'node:fs';
const swText=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('Offline shell caches local knowledge UI and uses network-first for hourly XML refresh',()=>{
 assert.match(swText,/\x2fsrc\x2foffline-ui\.js/);
 assert.match(swText,/url\.pathname==='\x2fsrc\x2fknowledge\.xml'/);
 assert.match(swText,/fetch\(request,\{cache:'no-cache'\}\)/);
 assert.ok(existsSync(new URL('../src/knowledge.xml',import.meta.url)));
});
