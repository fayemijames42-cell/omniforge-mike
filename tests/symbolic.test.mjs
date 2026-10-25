import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},Math,Number,Object,String,Map,Error};
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../src/symbolic.js',import.meta.url),'utf8'),sandbox);
const M=sandbox.window.OMNI_SYMBOLIC;
test('Explicit natural-language calculus routes without intercepting ordinary prose',()=>{
 for(const [prompt,operation] of [
  ['Differentiate 3x^3 - 4x + 7','differentiate'],
  ['Find the derivative of x² + 4x','differentiate'],
  ['Integrate 6x^2 - 1 dx','integrate'],
  ['Solve x^2 - 5x + 6 = 0','solve'],
  ['/math integrate x^2','integrate']
 ])assert.equal(M.command(prompt)?.op,operation);
 for(const q of ['What is calculus?','Tell me about how to solve equations','What is x?','Create a website','Solve my problems'])assert.equal(M.command(q),null,q);
});
test('Polynomial derivatives with implicit multiplication and brackets',()=>{
 for(const [q,expected] of [
  ['Differentiate 3x^3 + 5x^2 - 7x + 2','9x^2 + 10x - 7'],
  ['Differentiate x²','2x'],
  ['Differentiate (x+1)(x-1)','2x'],
  ['Differentiate 2(x+1)^2','4x + 4'],
  ['Differentiate x^-1','-x^-2'],
  ['Differentiate 10','0'],
  ['Differentiate -x^2','-2x'],
  ['Differentiate 0.5x^2','x'],
 ])assert.equal(M.compute(q).result,expected,q);
});
test('Integrals add constant and respect rational coefficients',()=>{
 for(const [q,expected] of [
  ['Integrate 3x^2','x^3 + C'],
  ['Integrate x^2','x^3/3 + C'],
  ['Integrate 2x + 1','x^2 + x + C'],
  ['Integrate x^-1','ln|x| + C'],
  ['Integrate 2x^-1 + 3','3x + 2ln|x| + C'],
 ])assert.equal(M.compute(q).result,expected,q);
});
test('Linear and quadratic equation solving',()=>{
 for(const [q,expected] of [
  ['Solve 2x + 3 = 11','x = 4'],
  ['Solve x^2 - 5x + 6 = 0','x = 2 or x = 3'],
  ['Solve (x-2)^2 = 0','x = 2'],
  ['Solve x^2 + 1 = 0','No real solutions (discriminant is negative).'],
  ['Solve 1 = 1','Infinitely many solutions (both sides agree).'],
  ['Solve 1 = 2','No solution (the constants disagree).'],
 ])assert.equal(M.compute(q).result,expected,q);
});
test('Unsupported and oversized operations fail safely without inventing solutions',()=>{
 for(const q of ['Differentiate sin(x)','Integrate x^2*sin(x)','Solve x^3 = 2','Solve x/x = 1','Differentiate x^30','Differentiate x;', 'Integrate ('.repeat(12)]){
  assert.throws(()=>M.compute(q),undefined,q);
 }
 assert.throws(()=>M.compute('Differentiate '+'x+'.repeat(240)),/too long/i);
 assert.throws(()=>M.compute('Differentiate constructor(3)'),/Only variable x/i);
});
test('Computation result has auditable local engine and explanation steps',()=>{
 const v=M.compute('Differentiate 7x^4 - 2x');
 assert.equal(v.engine,'NEXUS · LOCAL SYMBOLIC MATH');
 assert.ok(v.steps.length>=2);
 assert.ok(v.steps.some(x=>x.includes('28x^3')));
});
