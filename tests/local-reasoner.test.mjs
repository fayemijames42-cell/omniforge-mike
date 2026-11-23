import test from 'node:test';
import assert from 'node:assert/strict';
import {reasoningMode,calculateArithmetic,answerWithReasoning} from '../server/local-reasoner.mjs';
test('Reasoning chooses careful for complex and direct for simple prompts',()=>{
 assert.equal(reasoningMode({message:'Hello'}).mode,'direct');
 assert.equal(reasoningMode({message:'Compare both approaches'}).mode,'careful');
 assert.equal(reasoningMode({message:'Compare both approaches',reasoningMode:'quick'}).mode,'direct');
});
test('Deterministic arithmetic respects precedence and never runs code',()=>{
 assert.equal(calculateArithmetic('Calculate 2 + 3*4').formatted,'14');
 assert.equal(calculateArithmetic('Calculate -(2+3)^2').formatted,'-25');
 assert.equal(calculateArithmetic('Compute 2^3^2').formatted,'512');
 assert.equal(calculateArithmetic('Calculate 8/0'),null);
 assert.equal(calculateArithmetic('process.exit(0)'),null);
});
test('Simple task uses one local model call and careful mode never claims factual verification',async()=>{
 let calls=0;
 const simple=await answerWithReasoning({input:{message:'Hello'},messages:[{role:'system',content:'identity'},{role:'user',content:'Hello'}],
   infer:async msg=>{calls++;assert.equal(msg.at(-1).content,'Hello');return 'Hello!';}});
 assert.equal(calls,1);assert.equal(simple.reply,'Hello!');
 const careful=await answerWithReasoning({input:{message:'Carefully analyse the design'},
   messages:[{role:'system',content:'identity'},{role:'user',content:'Carefully analyse the design'}],
   infer:async()=>++calls===2?'Draft':'Reviewed answer'});
 assert.equal(careful.reasoning.passes,2);assert.equal(careful.reasoning.factChecked,false);
});
