import React,{useState} from 'react';
import {rPrisonExamples,type FormulaExample} from '../domain/presets/rprison.js';
import {parseFormula,evaluateFormula} from '../domain/rules/formula.js';
function Example({example}:{example:FormulaExample}){
 const [values,setValues]=useState<Record<string,string>>(Object.fromEntries(example.inputs.map(input=>[input.key,String(input.value)])));
 let result='';try{result=String(evaluateFormula(parseFormula(example.formula),key=>{const raw=values[key];const n=raw?.trim()?Number(raw):NaN;if(!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('Введите числа от −1 млрд до 1 млрд');return n;}));}catch(error){result=error instanceof Error?error.message:'Ошибка';}
 return <article><h3>{example.name}</h3><code>{example.formula}</code><div className="grid-fields">{example.inputs.map(input=><label key={input.key}>{example.name}: {input.name}<input type="number" step="any" value={values[input.key]} onChange={event=>setValues({...values,[input.key]:event.target.value})}/></label>)}</div><p>Результат: <strong data-example={example.name}>{result}</strong></p><p className="hint">{example.note}</p></article>;
}
export function RuleExamples(){return <details className="rule-examples"><summary>Готовые примеры урона и защиты R Prison v1.1</summary><p>Это отдельные калькуляторы по черновику книги: ввод ручной, атаки не применяются к персонажам и ОД не расходуются. Они не меняют правила вашей партии.</p>{rPrisonExamples.map(example=><Example key={example.name} example={example}/>)}</details>;}
