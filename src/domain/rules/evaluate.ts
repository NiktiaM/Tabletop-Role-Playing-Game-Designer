import {compileStats,type Ruleset} from '../../shared/rules.js';
import {evaluateFormula,references} from './formula.js';
export interface Calculation {key:string;name:string;value:number;explanation:string}
export function evaluateStats(rules:Ruleset,inputs:Record<string,number>):Calculation[]{
 const formulas=compileStats(rules.stats),values=new Map<string,number>(),trace:Calculation[]=[];
 function calculate(key:string):number{
  const cached=values.get(key);if(cached!==undefined)return cached;
  const stat=rules.stats.find(stat=>stat.key===key);if(!stat)throw new Error(`Неизвестный показатель: ${key}`);
  let value:number,explanation:string;
  if(stat.kind==='base'){value=Object.hasOwn(inputs,key)?inputs[key]:stat.defaultValue;if(!Number.isFinite(value)||Math.abs(value)>1e9)throw new Error(`${stat.name}: недопустимое значение`);explanation=Object.hasOwn(inputs,key)?'Введено для персонажа':`По умолчанию: ${stat.defaultValue}`;}
  else {
   const ast=formulas.get(key)!;
   for(const ref of references(ast))calculate(ref);
   try{value=evaluateFormula(ast,calculate);}catch(error){throw new Error(`${stat.name}: ${error instanceof Error?error.message:'Ошибка расчёта'}`);}
   const inputs=[...new Set(references(ast))].map(ref=>`${ref}=${values.get(ref)}`).join(', ');
   explanation=`${stat.formula}${inputs?` [${inputs}]`:''} → ${value}`;
  }
  values.set(key,value);trace.push({key,name:stat.name,value,explanation});return value;
 }
 for(const stat of rules.stats)calculate(stat.key);return trace;
}
