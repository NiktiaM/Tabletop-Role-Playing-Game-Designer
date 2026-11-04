import React,{useEffect,useState} from 'react';
import type {Character} from '../shared/campaign.js';
import type {Ruleset} from '../shared/rules.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
export function CharacterValues({character,rules,onSave}:{character:Character;rules:Ruleset;onSave:(values:Record<string,number>)=>boolean}){
 const derivedLevel=rules.stats.some(stat=>stat.key==='level'&&stat.kind==='derived');
 const [inputs,setInputs]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 useEffect(()=>{setInputs(Object.fromEntries([...rules.stats.filter(stat=>stat.kind==='base'&&stat.key!=='level').map(stat=>[stat.key,String(character.values[stat.key]??(stat.kind==='base'?stat.defaultValue:0))]),['level',String(character.values.level??rules.stats.filter(stat=>stat.kind==='base').find(stat=>stat.key==='level')?.defaultValue??1)]]));setNotice('');},[rules,character]);
 let values:Record<string,number>={...character.values},trace:ReturnType<typeof evaluateStats>=[],error='';
 try{
  for(const [key,text] of Object.entries(inputs)){const n=text.trim()?Number(text):NaN;if(!Number.isFinite(n)||Math.abs(n)>1e9)throw new Error('Введите числа от −1 млрд до 1 млрд');values[key]=n;}
  if(!derivedLevel&&(!Number.isInteger(values.level)||values.level<1||values.level>1000))throw new Error('Уровень — целое число от 1 до 1000');
  trace=evaluateStats(rules,values);
 }catch(cause){error=cause instanceof Error?cause.message:'Ошибка расчёта';}
 return <section className="character-values"><h3>Характеристики: {character.name}</h3><p className="hint">По правилам партии, версия {rules.revision}. Производные значения рассчитываются автоматически; это не текущие HP или другие расходуемые ресурсы.</p>
<label>Уровень персонажа<input aria-label={`Уровень: ${character.name}`} type="number" min="1" max="1000" step="1" disabled={derivedLevel} value={derivedLevel?trace.find(stat=>stat.key==='level')?.value??'':inputs.level??''} onChange={event=>setInputs({...inputs,level:event.target.value})}/></label>
 <div className="grid-fields">{rules.stats.filter(stat=>stat.kind==='base'&&stat.key!=='level').map(stat=><label key={stat.key}>Значение: {stat.name}<input type="number" step="any" value={inputs[stat.key]??''} onChange={event=>{setInputs({...inputs,[stat.key]:event.target.value});setNotice('');}}/></label>)}</div>
 {error?<p role="alert">{error}</p>:<><div className="character-summary">{trace.filter(row=>rules.stats.find(stat=>stat.key===row.key)?.kind==='derived').map(row=><span key={row.key}><strong>{row.name}</strong>: {row.value}</span>)}</div><details className="detail-section"><summary>Как рассчитаны показатели</summary><ul>{trace.map(row=><li key={row.key}>{row.name}: <strong>{row.value}</strong> — {row.explanation}</li>)}</ul></details></>}

 <button disabled={!!error} onClick={()=>{if(onSave(values))setNotice('Характеристики применены. Сохраните партию.');}}>Применить характеристики</button>{notice&&<p role="status">{notice}</p>}
 </section>;
}
