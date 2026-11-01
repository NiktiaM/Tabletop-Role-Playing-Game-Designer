import React,{useEffect,useState} from 'react';
import type {Character} from '../shared/campaign.js';
import type {Ruleset} from '../shared/rules.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
export function CharacterValues({character,rules,onSave}:{character:Character;rules:Ruleset;onSave:(values:Record<string,number>)=>boolean}){
 const [inputs,setInputs]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 useEffect(()=>{setInputs(Object.fromEntries(rules.stats.filter(stat=>stat.kind==='base').map(stat=>[stat.key,String(character.values[stat.key]??(stat.kind==='base'?stat.defaultValue:0))])));setNotice('');},[rules,character]);
 let values:Record<string,number>={...character.values},trace:ReturnType<typeof evaluateStats>=[],error='';
 try{
  for(const [key,text] of Object.entries(inputs)){const n=text.trim()?Number(text):NaN;if(!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('Введите числа от −1 млрд до 1 млрд');values[key]=n;}
  trace=evaluateStats(rules,values);
 }catch(cause){error=cause instanceof Error?cause.message:'Ошибка расчёта';}
 return <section className="character-values"><h3>Характеристики: {character.name}</h3><p className="hint">По правилам партии, версия {rules.revision}. Производные значения рассчитываются автоматически; это не текущие HP или другие расходуемые ресурсы.</p>
 <div className="grid-fields">{rules.stats.filter(stat=>stat.kind==='base').map(stat=><label key={stat.key}>Значение: {stat.name}<input type="number" step="any" value={inputs[stat.key]??''} onChange={event=>{setInputs({...inputs,[stat.key]:event.target.value});setNotice('');}}/></label>)}</div>
 {error?<p role="alert">{error}</p>:<ul>{trace.map(row=><li key={row.key}>{row.name}: <strong>{row.value}</strong> — {row.explanation}</li>)}</ul>}
 <button disabled={!!error||rules.stats.length===0} onClick={()=>{if(onSave(values))setNotice('Характеристики применены. Сохраните партию.');}}>Применить характеристики</button>{notice&&<p role="status">{notice}</p>}
 </section>;
}
