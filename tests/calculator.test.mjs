import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime={window:{},Math,Number,Object,String};
vm.createContext(runtime);
vm.runInContext(readFileSync(new URL('../src/calculator.js',import.meta.url),'utf8'),runtime);
const {calculate,expressionFromCommand,arithmeticFromText}=runtime.window.OMNI_CALC;
test('Calculator accepts explicit commands only',()=>{
 assert.equal(expressionFromCommand('/calc (5+3)*2'),'(5+3)*2');
 assert.equal(expressionFromCommand('calculate: sqrt(9)'),'sqrt(9)');
 assert.equal(expressionFromCommand('/calc'),'');
 assert.equal(expressionFromCommand('What is 2+2?'),null);
});
test('Arithmetic precedence and scientific functions',()=>{
 for(const [formula,expected] of [
  ['2+2',4],['(5+3)*2',16],['2^3^2',512],['-2^2',-4],
  ['2^-2',.25],['sqrt(81)',9],['sin(deg(30))',.5],
  ['log(1000)',3],['ln(e)',1],['3e2+1',301],['12%5',2],['4 × 3 ÷ 2',6]
 ])assert.ok(Math.abs(calculate(formula).value-expected)<1e-10,formula);
 assert.equal(calculate('2/3').formatted,'0.666666666667');
});
test('Local arithmetic rejects invalid input, unsafe expressions and undefined results',()=>{
 for(const value of ['','1/0','sqrt(-1)','2**3','constructor(4)','1;alert(1)','2(3)','1+'.repeat(200)]){
  assert.throws(()=>calculate(value),undefined,value);
 }
 assert.throws(()=>calculate('('.repeat(31)+'1'+')'.repeat(31)),/nested/i);
});

test('Plain numeric questions route to local calculation without a Cloudflare call',()=>{
 for(const [text,expression] of [['2+1','2+1'],['What is 2 + 1?','2 + 1'],['calculate 7*6','7*6'],['what\'s (3+5)*2?','(3+5)*2']])assert.equal(expressionFromCommand(text)||arithmeticFromText(text),expression);
 for(const text of ['What is a diode?','What is 555 timer?','2+1 in binary','Calculate my costs next year'])assert.equal(arithmeticFromText(text),null);
});
