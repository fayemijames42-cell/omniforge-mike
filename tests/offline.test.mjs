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
test('Automatic definition lookup sends a bounded topic only for a direct question',()=>{
 const {definitionTopic,sameTitle,sources}=sandbox.window.OMNI_WIKIPEDIA;
 assert.equal(definitionTopic('What is the Pythagorean theorem?'),'Pythagorean theorem');
 assert.equal(definitionTopic('What’s a Zener diode?'),'Zener diode');
 assert.equal(definitionTopic('Define Kepler’s laws of planetary motion.'),'Kepler’s laws of planetary motion');
 assert.equal(sameTitle("Kepler's laws of planetary motion",'Kepler’s laws of planetary motion'),true);
 assert.equal(sameTitle('Physics','History of physics'),false);
 for(const question of ['What is its meaning?','What is her address?','What is my email address?',
  'What is the current exchange rate?','What is the weather today?','What is Ada’s phone number?',
  'What is redacted@example.invalid?','What is a diode and explain its use?','What is a diode? Give a worked example.',
  'Explain what a diode is in simple terms','Compare physics and chemistry','Make the website pink','What is a\nprivate name?']){
  assert.equal(definitionTopic(question),'',question);
 }
 const page={title:'A test article',lastrevid:55,extract:'A valid longer introduction from a reference that can be used when the topic is an exact match.'};
 assert.equal(sources({query:{pages:[{...page,pageprops:{disambiguation:''}}]}}).length,0);
 assert.equal(sources({query:{pages:[page]}}).length,1);
});
