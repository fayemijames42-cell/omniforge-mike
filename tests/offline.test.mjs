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
