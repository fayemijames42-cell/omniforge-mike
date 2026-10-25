/* NEXUS symbolic polynomial mathematics. Offline, deterministic; no eval(), APIs or model inference. */
(function(root){
'use strict';
const MAX_INPUT=220,MAX_TOKENS=130,MAX_DEPTH=20,MAX_DEGREE=24,MAX_COEFF=1e12;
const nice=n=>Math.abs(n)<1e-12?0:Number(n.toPrecision(12));
const finite=n=>{if(!Number.isFinite(n)||Math.abs(n)>MAX_COEFF)throw Error('A coefficient exceeds the supported numeric range.');return nice(n)};
const polynomial=n=>new Map(n===0?[]:[[0,finite(n)]]);
const monomial=(n,c=1)=>new Map([[n,finite(c)]]);
function clean(p){for(const [n,c]of p){if(!c||Math.abs(c)<1e-11)p.delete(n);else p.set(n,finite(c))}return p}
function plus(a,b,sign=1){const p=new Map(a);for(const [n,c]of b)p.set(n,finite((p.get(n)||0)+sign*c));return clean(p)}
function times(a,b){
 const p=new Map();
 for(const [i,x]of a)for(const [j,y]of b){
  if(i+j>MAX_DEGREE||i+j< -8)throw Error('The expression exceeds the supported power range.');
  p.set(i+j,finite((p.get(i+j)||0)+x*y));
 }
 return clean(p);
}
function scale(a,k){return clean(new Map([...a].map(([i,c])=>[i,finite(c*k)])))}
function divide(a,b){
 if(b.size!==1||!b.has(0))throw Error('Division by expressions containing x is not supported yet (except x^-n).');
 const d=b.get(0);if(!d)throw Error('Cannot divide by zero.');
 return scale(a,1/d);
}
function exponent(base,n){
 if(!Number.isInteger(n)||n< -8||n>12)throw Error('Use integer powers from -8 to 12.');
 if(n<0){
  if(base.size!==1)throw Error('Negative powers require a single monomial such as x^-1.');
  const [[degree,coefficient]]=[...base];
  if(!coefficient)throw Error('Cannot raise zero to a negative power.');
  if(degree*n < -8||degree*n>MAX_DEGREE)throw Error('Power outside the supported range.');
  return monomial(degree*n,finite(Math.pow(coefficient,n)));
 }
 let result=polynomial(1);
 for(let i=0;i<n;i++)result=times(result,base);
 return result;
}
function normalise(source){
 return String(source||'').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/·/g,'*')
 .replace(/²/g,'^2').replace(/³/g,'^3').replace(/¹/g,'^1').replace(/⁴/g,'^4')
 .replace(/\*\*/g,'^').trim();
}
function parse(source){
 const text=normalise(source);
 if(!text)throw Error('Enter an expression containing x.');
 if(text.length>MAX_INPUT)throw Error('Expression too long (maximum '+MAX_INPUT+' characters).');
 const tokens=[];
 for(let i=0;i<text.length;){
  if(/\s/.test(text[i])){i++;continue}
  const number=text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  if(number){tokens.push({type:'number',value:Number(number[0])});i+=number[0].length}
  else if(/[a-z]/i.test(text[i])){
   const ident=text.slice(i).match(/^[a-z]+/i)[0].toLowerCase();
   tokens.push({type:'id',value:ident});i+=ident.length;
  }else if('+-*/^()'.includes(text[i])){tokens.push({type:text[i]});i++}
  else throw Error('Unsupported symbol: '+text[i]);
  if(tokens.length>MAX_TOKENS)throw Error('Expression has too many terms.');
 }
 let position=0,depth=0;
 const peek=()=>tokens[position]?.type;
 const take=v=>{if(peek()===v){position++;return true}return false};
 function atom(){
  if(take('(')){
   if(++depth>MAX_DEPTH)throw Error('Too many nested brackets.');
   const value=sum();
   if(!take(')'))throw Error('Missing closing bracket.');
   depth--;
   return value;
  }
  if(peek()==='number')return polynomial(finite(tokens[position++].value));
  if(peek()==='id'){
   const name=tokens[position++].value;
   if(name==='x')return monomial(1);
   throw Error('Only variable x is supported in this local version (found '+name+').');
  }
  throw Error('Expected a number, x, or a bracketed expression.');
 }
 function power(){
  let p=atom();
  if(take('^')){
   const neg=take('-');if(!neg)take('+');
   if(peek()!=='number')throw Error('Powers must be integers.');
   const v=tokens[position++].value*(neg?-1:1);
   p=exponent(p,v);
  }
  return p;
 }
 function unary(){if(take('+'))return unary();if(take('-'))return scale(unary(),-1);return power()}
 function product(){
  let p=unary(),prior=tokens[position-1];
  while(position<tokens.length){
   const op=peek();
   const implicit=op==='id'||op==='('||(op==='number'&&prior?.type===')');
   if(op==='*'||op==='/'||implicit){
    if(op==='*'||op==='/')position++;
    const right=unary();
    p=op==='/'?divide(p,right):times(p,right);
    prior=tokens[position-1];
   }else break;
  }
  return p;
 }
 function sum(){
  let p=product();
  while(peek()==='+'||peek()==='-'){
   const sign=tokens[position++].type==='+'?1:-1;
   p=plus(p,product(),sign);
  }
  return p;
 }
 const value=sum();
 if(position<tokens.length)throw Error('Unexpected input near '+text.slice(0,50)+'.');
 return clean(value);
}
function rational(n){
 if(Number.isInteger(n))return String(n);
 for(let d=2;d<=64;d++){
  const k=Math.round(n*d);
  if(k!==0&&Math.abs(k/d-n)<1e-9)return k+'/'+d;
 }
 return String(nice(n));
}
function formatTerm(exp,c){
 const absolute=Math.abs(c),v=rational(absolute);
 if(exp===0)return v;
 const x=exp===1?'x':'x^'+exp;
 if(v==='1')return x;
 if(v.includes('/')){
  const [num,den]=v.split('/');
  return (num==='1'?x:num+x)+'/'+den;
 }
 return v+x;
}
function format(p){
 const terms=[...p].filter(([,c])=>c).sort((a,b)=>b[0]-a[0]);
 if(!terms.length)return '0';
 return terms.map(([exp,c],i)=>(i?(c<0?' - ':' + '):(c<0?'-':''))+formatTerm(exp,c)).join('');
}
function derivative(p){return clean(new Map([...p].filter(([n])=>n!==0).map(([n,c])=>[n-1,finite(c*n)])))}
function integrate(p){
 const out=new Map();let logCoefficient=0;
 for(const [n,c] of p){
  if(n===-1){logCoefficient=c;continue}
  if(n+1>MAX_DEGREE)throw Error('Resulting power exceeds the local integration limit.');
  out.set(n+1,finite(c/(n+1)));
 }
 let expression=format(clean(out));
 if(logCoefficient){
  const term=(Math.abs(logCoefficient)===1?'':rational(Math.abs(logCoefficient)))+'ln|x|';
  expression=expression==='0'?(logCoefficient<0?'-':'')+term:expression+(logCoefficient<0?' - ':' + ')+term;
 }
 return expression+' + C';
}
function parts(p){return [...p].sort((a,b)=>b[0]-a[0])}
function derivativesSteps(p){return parts(p).slice(0,8).map(([n,c])=>'d/dx('+format(monomial(n,c))+') = '+(n===0?'0':format(monomial(n-1,finite(c*n)))))}
function integrationsSteps(p){return parts(p).slice(0,8).map(([n,c])=>'∫ '+format(monomial(n,c))+' dx = '+(n===-1?(Math.abs(c)===1?(c<0?'-':''):rational(c))+'ln|x|':format(monomial(n+1,finite(c/(n+1))))))}
function solveEquation(left,right){
 const p=plus(parse(left),parse(right),-1);
 if([...p.keys()].some(n=>n<0||n>2))throw Error('Equation solving currently supports linear and quadratic polynomials only.');
 const a=p.get(2)||0,b=p.get(1)||0,c=p.get(0)||0;
 if(!a&&!b)return {answer:c?'No solution (the constants disagree).':'Infinitely many solutions (both sides agree).',steps:['Simplified equation: '+format(p)+' = 0']};
 if(!a)return {answer:'x = '+rational(nice(-c/b)),steps:['Simplified equation: '+format(p)+' = 0','Linear rule: x = -c/b.']};
 const d=finite(b*b-4*a*c);
 const steps=['Simplified equation: '+format(p)+' = 0','Quadratic discriminant: b² - 4ac = '+rational(d)+'.'];
 if(d<0)return {answer:'No real solutions (discriminant is negative).',steps};
 const sqrt=Math.sqrt(d);
 const roots=d===0?[-b/(2*a)]:[(-b-sqrt)/(2*a),(-b+sqrt)/(2*a)].sort((x,y)=>x-y);
 return {answer:roots.map(n=>'x = '+rational(nice(n))).join(' or '),steps:[...steps,'Quadratic formula: x = (-b ± √D) / (2a).']};
}
function command(text){
 const input=String(text||'').trim();
 if(!input)return null;
 let m=input.match(/^\/(?:math|symbolic)\s+(differentiate|derive|integrate|solve)\s+(.+)$/is);
 if(m)return {op:m[1].toLowerCase(),expr:m[2].trim()};
 m=input.match(/^(?:differentiate|derive|find (?:the )?derivative of|what is (?:the )?derivative of|d\/dx)\s*:?\s*(.+)$/is);
 if(m)return {op:'differentiate',expr:m[1].trim()};
 m=input.match(/^(?:integrate|find (?:the )?integral of|what is (?:the )?integral of|∫)\s*:?\s*(.+)$/is);
 if(m)return {op:'integrate',expr:m[1].trim().replace(/\s*(?:d\s*x|dx)\s*$/i,'')};
 m=input.match(/^(?:solve(?: (?:the )?equation)?|find x (?:in|for))\s*:?\s*(.+)$/is);
 if(m&&m[1].includes('='))return {op:'solve',expr:m[1].trim()};
 return null;
}
function compute(input){
 const parsed=typeof input==='string'?command(input):input;
 if(!parsed)throw Error('Try "Differentiate 3x^3 + 5x^2" or "Solve 2x + 3 = 11".');
 let expr=String(parsed.expr||'').replace(/\?$/,'').trim();
 if(/^(?:derive)$/i.test(parsed.op))parsed.op='differentiate';
 if(expr.length>MAX_INPUT)throw Error('Expression too long.');
 if(parsed.op==='solve'){
  const sides=expr.split('=');
  if(sides.length!==2||!sides.every(s=>s.trim()))throw Error('Use one equation with exactly one equals sign.');
  const result=solveEquation(sides[0],sides[1]);
  return {operation:'Solve equation',input:expr,result:result.answer,steps:result.steps,engine:'NEXUS · LOCAL SYMBOLIC MATH'};
 }
 if(!['differentiate','integrate'].includes(parsed.op))throw Error('Unknown mathematics operation.');
 expr=expr.replace(/\s+(?:with respect to|w\.r\.t\.?)\s+x$/i,'');
 const p=parse(expr);
 if(parsed.op==='differentiate')return {operation:'Differentiate with respect to x',input:expr,result:format(derivative(p)),steps:['Apply the polynomial power rule d/dx(a·x^n) = a·n·x^(n-1).',...derivativesSteps(p)],engine:'NEXUS · LOCAL SYMBOLIC MATH'};
 return {operation:'Integrate with respect to x',input:expr,result:integrate(p),steps:['Apply the power rule ∫a·x^n dx = a·x^(n+1)/(n+1), except x^-1.',...integrationsSteps(p),'C is an arbitrary constant of integration.'],engine:'NEXUS · LOCAL SYMBOLIC MATH'};
}
root.OMNI_SYMBOLIC={command,compute,parse,format,derivative,integrate};
})(window);
