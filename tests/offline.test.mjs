import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import seed from '../src/reference-seed.json' with {type:'json'};
const sandbox={window:{},Date,Math,Number,String,Set,Error,Object};
vm.createContext(sandbox);
for(const name of ['wikipedia.js','offline.js'])vm.runInContext(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),sandbox);
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
test('Bundled references match public fallback topics without guessing or merging two topics',()=>{
 const {entries}=K.parseSnapshot(seed);
 assert.equal(K.publicMatch('do you know him from jjk satori Gojo',entries).question,'Satoru Gojo');
 assert.equal(K.publicMatch("what's the tallest building in the world",entries).question,'List of tallest buildings');
 assert.equal(K.publicMatch('What is the Pythagorean theorem?',entries).question,'Pythagorean theorem');
 assert.equal(K.publicMatch('latest population of Lagos today',entries),null);
 assert.equal(K.publicMatch('Physics and Economics',entries),null);
 assert.equal(K.publicMatch('What is this person in the image doing?',entries),null);
});
