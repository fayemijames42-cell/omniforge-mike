/* NEXUS local scientific calculator. No eval, server, or AI calls. */
(function(root){
'use strict';
const FUNCTIONS={
 sqrt:x=>Math.sqrt(x),abs:x=>Math.abs(x),sin:x=>Math.sin(x),
 cos:x=>Math.cos(x),tan:x=>Math.tan(x),ln:x=>Math.log(x),log:x=>Math.log10(x),
 floor:x=>Math.floor(x),ceil:x=>Math.ceil(x),round:x=>Math.round(x),
 deg:x=>x*Math.PI/180,rad:x=>x*180/Math.PI
};
function expressionFromCommand(text){
 const input=String(text||'').trim();
 if(/^\/calc(?:ulate)?$/i.test(input))return '';
 const result=input.match(/^\/calc(?:ulate)?(?:\s+|:\s*)(.*)$/is)||input.match(/^calculate:\s*(.*)$/is);
 return result?result[1].trim():null;
}
/* Intentionally conservative: only standalone numerical questions, never arbitrary prose. */
function arithmeticFromText(input){
 const value=String(input||'').trim();
 if(value.length>160)return null;
 const match=value.match(/^(?:(?:what\s+is|what's|how\s+much\s+is|calculate|compute|evaluate|solve)\s*:?\s*)?([0-9.(+\-][0-9.eE+\-*/%^()×÷\s]*)\??$/i);
 if(!match)return null;
 const formula=match[1].trim();
 if(!/[+\-*/%^×÷]/.test(formula))return null;
 if(!/\d/.test(formula))return null;
 return formula;
}
function calculate(source){
 const input=String(source||'').trim().replace(/×/g,'*').replace(/÷/g,'/');
 if(!input)throw Error('Enter an expression after /calc.');
 if(input.length>240)throw Error('Expression is too long (maximum 240 characters).');
 const tokens=[];
 for(let i=0;i<input.length;){
  if(/\s/.test(input[i])){i++;continue}
  const n=input.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  if(n){tokens.push({kind:'number',value:Number(n[0])});i+=n[0].length}
  else{
   const name=input.slice(i).match(/^[a-z][a-z0-9]*/i);
   if(name){tokens.push({kind:'name',value:name[0].toLowerCase()});i+=name[0].length}
   else if('+-*/%^()'.includes(input[i])){tokens.push({kind:input[i]});i++}
   else throw Error('Unsupported character: '+input[i]);
  }
  if(tokens.length>180)throw Error('Expression has too many parts.');
 }
 let pos=0,depth=0;
 const at=()=>tokens[pos]?.kind;
 const accept=k=>{if(at()!==k)return false;pos++;return true};
 const requireToken=k=>{if(!accept(k))throw Error('Expected '+(k===')'?'a closing parenthesis':k)+'.')};
 const finite=x=>{if(!Number.isFinite(x))throw Error('Result is undefined or outside the supported range.');return x};
 function primary(){
  if(accept('(')){if(++depth>30)throw Error('Too many nested parentheses.');const x=sum();requireToken(')');depth--;return x}
  if(at()==='number')return finite(tokens[pos++].value);
  if(at()==='name'){
   const n=tokens[pos++].value;
   if(n==='pi')return Math.PI;
   if(n==='e')return Math.E;
   if(!Object.hasOwn(FUNCTIONS,n))throw Error('Unknown function: '+n);
   requireToken('(');if(++depth>30)throw Error('Too many nested functions.');
   const x=sum();requireToken(')');depth--;
   return finite(FUNCTIONS[n](x));
  }
  throw Error('Expected a number, constant, function, or parenthesis.');
 }
 function power(){const x=primary();return accept('^')?finite(Math.pow(x,unary())):x}
 function unary(){if(accept('+'))return unary();if(accept('-'))return finite(-unary());return power()}
 function product(){let x=unary();while(['*','/','%'].includes(at())){const op=tokens[pos++].kind,y=unary();x=finite(op==='*'?x*y:op==='/'?x/y:x%y)}return x}
 function sum(){let x=product();while(['+','-'].includes(at())){const op=tokens[pos++].kind,y=product();x=finite(op==='+'?x+y:x-y)}return x}
 const value=sum();
 if(pos<tokens.length)throw Error('Unexpected input after the expression.');
 return {value,formatted:Number(value.toPrecision(12)).toString(),expression:input};
}
root.OMNI_CALC={calculate,expressionFromCommand,arithmeticFromText};
})(window);
