export type Expr = {type:'number';value:number}|{type:'ref';key:string}|{type:'unary';op:string;arg:Expr}|{type:'binary';op:string;left:Expr;right:Expr}|{type:'call';name:string;args:Expr[]};
const arity:Record<string,[number,number]>={ceil:[1,1],floor:[1,1],abs:[1,1],min:[2,8],max:[2,8],if:[3,3]};
export function parseFormula(source:string):Expr {
 if(!source.trim()||source.length>512)throw new Error('Формула должна содержать от 1 до 512 символов');
 const tokens:string[]=[];let offset=0;
 while(offset<source.length){const part=source.slice(offset);const space=/^\s+/.exec(part);if(space){offset+=space[0].length;continue;}
  const match=/^(?:\d+(?:\.\d+)?|[a-z][a-z0-9_]*|>=|<=|==|!=|&&|\|\||[+*/(),!<>-])/.exec(part);
  if(!match)throw new Error(`Недопустимый символ в позиции ${offset+1}`);tokens.push(match[0]);offset+=match[0].length;
  if(tokens.length>256)throw new Error('Формула слишком сложная');
 }
 let position=0,nodes=0;const peek=()=>tokens[position];const take=()=>tokens[position++];
 const make=(node:Expr):Expr=>{if(++nodes>128)throw new Error('В формуле слишком много операций');return node;};
 const levels=[['||'],['&&'],['==','!=','<','>','<=','>='],['+','-'],['*','/']];
 function expression(level=0,depth=0):Expr{
  if(depth>32)throw new Error('Слишком глубокая вложенность формулы');
  if(level<levels.length){let left=expression(level+1,depth);while(levels[level].includes(peek())){const op=take();left=make({type:'binary',op,left,right:expression(level+1,depth)});}return left;}
  if(['+','-','!'].includes(peek()))return make({type:'unary',op:take(),arg:expression(level,depth+1)});
  const token=take();if(token===undefined)throw new Error('Неожиданный конец формулы');
  if(token==='('){const node=expression(0,depth+1);if(take()!==')')throw new Error('Не хватает закрывающей скобки');return node;}
  if(/^\d/.test(token)){const value=Number(token);if(!Number.isFinite(value)||value>1e9)throw new Error('Слишком большое число');return make({type:'number',value});}
  if(!/^[a-z][a-z0-9_]*$/.test(token))throw new Error(`Ожидалось число или имя показателя, получено: ${token}`);
  if(peek()!=='(')return make({type:'ref',key:token});
  take();if(!Object.hasOwn(arity,token))throw new Error(`Неизвестная функция: ${token}`);
  const args:Expr[]=[];if(peek()!==')'){do{args.push(expression(0,depth+1));if(peek()!==',')break;take();}while(true);}
  if(take()!==')')throw new Error('Не хватает закрывающей скобки функции');
  if(args.length<arity[token][0]||args.length>arity[token][1])throw new Error(`Неверное число аргументов: ${token}`);
  return make({type:'call',name:token,args});
 }
 const ast=expression();if(position!==tokens.length)throw new Error('Лишние символы после формулы');return ast;
}
export function references(node:Expr):string[]{
 if(node.type==='ref')return [node.key];if(node.type==='unary')return references(node.arg);
 if(node.type==='binary')return [...references(node.left),...references(node.right)];if(node.type==='call')return node.args.flatMap(references);return [];
}
export function evaluateFormula(node:Expr,resolve:(key:string)=>number):number {
 const ev=(n:Expr):number=>{
  let value:number;
  if(n.type==='number')value=n.value;
  else if(n.type==='ref')value=resolve(n.key);
  else if(n.type==='unary'){const a=ev(n.arg);value=n.op==='-'?-a:n.op==='!'?Number(!a):a;}
  else if(n.type==='call'){
   if(n.name==='if')value=ev(n.args[0])?ev(n.args[1]):ev(n.args[2]);
   else {const args=n.args.map(ev);switch(n.name){case 'ceil':value=Math.ceil(args[0]);break;case 'floor':value=Math.floor(args[0]);break;case 'abs':value=Math.abs(args[0]);break;case 'min':value=Math.min(...args);break;case 'max':value=Math.max(...args);break;default:throw new Error('Неизвестная операция');}}
  } else {
   const a=ev(n.left);if(n.op==='&&'&&!a)return 0;if(n.op==='||'&&a)return 1;
   const b=ev(n.right);switch(n.op){case '+':value=a+b;break;case '-':value=a-b;break;case '*':value=a*b;break;case '/':if(b===0)throw new Error('Деление на ноль');value=a/b;break;case '<':value=Number(a<b);break;case '>':value=Number(a>b);break;case '<=':value=Number(a<=b);break;case '>=':value=Number(a>=b);break;case '==':value=Number(a===b);break;case '!=':value=Number(a!==b);break;case '&&':case '||':value=Number(!!b);break;default:throw new Error('Неизвестная операция');}
  }
  if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error('Результат выходит за допустимый диапазон');return value;
 };return ev(node);
}
