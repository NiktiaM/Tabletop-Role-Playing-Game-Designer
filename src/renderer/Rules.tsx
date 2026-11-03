import {rPrisonDraft} from '../domain/presets/rprison.js';
import {RuleExamples} from './RuleExamples.js';
import React,{useEffect,useState} from 'react';
import {rulesetSchema,type Ruleset,type StatDefinition} from '../shared/rules.js';
import type {Character} from '../shared/campaign.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
export function Rules({rules,characters,onRules,onValues,onPreset}:{onPreset?:()=>void;rules:Ruleset;characters:Character[];onRules:(rules:Ruleset)=>boolean;onValues:(id:string,values:Record<string,number>)=>boolean}){
 const [draft,setDraft]=useState(rules),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState('');
 const [inputs,setInputs]=useState<Record<string,string>>({});
 useEffect(()=>setDraft(rules),[rules]);
 const character=characters.find(character=>character.id===selected);
 useEffect(()=>{setInputs(Object.fromEntries(rules.stats.filter(stat=>stat.kind==='base').map(stat=>[stat.key,String(character?.values[stat.key]??(stat.kind==='base'?stat.defaultValue:0))])));setNotice('');},[rules,character]);
 function add(kind:'base'|'derived'){
  let n=1;while(draft.stats.some(stat=>stat.key===`stat${n}`))n++;
  const stat:StatDefinition=kind==='base'?{key:`stat${n}`,name:'Новый показатель',kind,defaultValue:0}:{key:`stat${n}`,name:'Новый расчёт',kind,formula:'0'};
  setDraft({...draft,stats:[...draft.stats,stat]});setNotice('');
 }
 function update(index:number,change:Partial<StatDefinition>){setDraft({...draft,stats:draft.stats.map((stat,i)=>i===index?{...stat,...change} as StatDefinition:stat)});setNotice('');}
 function numericInputs(){const result:Record<string,number>={};for(const [key,raw] of Object.entries(inputs)){const value=raw.trim()?Number(raw):NaN;if(!Number.isFinite(value)||Math.abs(value)>1e9)throw new Error('Введите конечные числа от −1 млрд до 1 млрд');Object.defineProperty(result,key,{value,enumerable:true});}return result;}
 let calculation:ReturnType<typeof evaluateStats>=[],calculationError='';
 try{calculation=evaluateStats(rules,numericInputs());}catch(error){calculationError=error instanceof Error?error.message:'Не удалось рассчитать';}
 return <section className="rules-panel"><h2>Правила партии</h2>
 <p>Обычно вручную писать формулы не нужно: выберите готовый набор. Редактор ниже нужен для изменения вашей системы.</p>
 <button onClick={()=>{
  if(onPreset){onPreset();return;}
  if(rules.stats.length&&!window.confirm('Заменить применённые правила набором Prison0.3? Текущие определения будут заменены; значения персонажей сохранятся по ключам, проверьте соответствие характеристик.'))return;
  const preset={...rPrisonDraft(),id:rules.id,revision:rules.revision+1};
  if(onRules(preset)){setError('');setNotice('Готовые формулы R Prison применены. Проверьте характеристики существующих персонажей и сохраните партию.');}
 }}>Использовать Prison0.3</button>
 <p className="hint">В наборе: Сила, Ловкость, Телосложение, Харизма, уровень, броня, максимум HP/ОД и бонусы урона. HP=10+2×выносливость+2×(уровень−1),8ОД, боевые бонусы/3 вверх; броня уменьшает урон. Значения 5/5/5/5 — начальное предложение, их можно изменить. Текущие HP и ОД ведутся в карточке персонажа на поле.</p>
 <label>Характеристика инициативы<select aria-label="Характеристика инициативы" value={draft.initiativeStat??''} onChange={event=>setDraft({...draft,initiativeStat:event.target.value||null})}><option value="">Не настроена</option>{draft.stats.map(stat=><option key={stat.key} value={stat.key}>{stat.name}</option>)}</select></label><p className="hint">Инициатива: d20 + floor((характеристика − 10) / 2). Для R Prison используется Ловкость с её текущим значением.</p>
 <label>Формула опыта за NPC<input aria-label="Формула опыта за NPC" maxLength={512} value={draft.npcXpFormula} onChange={event=>setDraft({...draft,npcXpFormula:event.target.value})}/></label><p className="hint">Готовый набор использует награды3/7/15 по сложности. level — уровень NPC; например, 100 * level * level даёт более быстрый рост. Награда не начисляется автоматически при нуле HP.</p>
 <RuleExamples/>
 <p className="hint">Применённая версия: {rules.revision}. Правила хранятся внутри этой партии. Редактирование здесь не меняет другие партии. Сначала настройте и примените показатели, затем проверьте расчёт ниже.</p>
 <label>Название правил<input maxLength={120} value={draft.name} onChange={event=>{setDraft({...draft,name:event.target.value});setNotice('');}}/></label>
 <label>Показатель максимума HP<select aria-label="Показатель максимума HP" value={draft.healthStat??''} onChange={event=>setDraft({...draft,healthStat:event.target.value||null})}><option value="">Не настроен</option>{draft.stats.map(stat=><option key={stat.key} value={stat.key}>{stat.name} ({stat.key})</option>)}</select></label>
 <div className="movement-rule-fields"><label>Показатель бюджета движения<select aria-label="Показатель бюджета движения" value={draft.movement.budgetStat??''} onChange={event=>setDraft({...draft,movement:{...draft.movement,budgetStat:event.target.value||null}})}><option value="">Не настроен</option>{draft.stats.map(stat=><option key={stat.key} value={stat.key}>{stat.name} ({stat.key})</option>)}</select></label><p className="hint">По согласованию: 1 ОД за метр, диагональ ×√2. В готовом R Prison используется максимум ОД. Для старой партии выберите источник бюджета и примените правила. Восстановление остатка — вручную в карточке или по настройке начатого боя.</p></div>
 <div className="rule-list">{draft.stats.map((stat,index)=><article key={index}>
 <h3>{index+1}. {stat.kind==='base'?'Исходный показатель':'Вычисляемый показатель'}</h3>
 <div className="grid-fields"><label>Ключ показателя {index+1}<input value={stat.key} maxLength={32} onChange={event=>update(index,{key:event.target.value})}/></label>
 <label>Название показателя {index+1}<input value={stat.name} maxLength={80} onChange={event=>update(index,{name:event.target.value})}/></label>
 {stat.kind==='base'?<label>Значение по умолчанию {index+1}<input type="number" min="-1000000000" max="1000000000" step="any" value={Number.isNaN(stat.defaultValue)?'':stat.defaultValue} onChange={event=>update(index,{defaultValue:event.target.value.trim()?Number(event.target.value):NaN})}/></label>:
 <label>Формула показателя {index+1}<input maxLength={512} value={stat.formula} onChange={event=>update(index,{formula:event.target.value})}/></label>}
 </div><button className="secondary" onClick={()=>{setDraft({...draft,stats:draft.stats.filter((_,i)=>i!==index)});setNotice('');}}>Удалить показатель {index+1}</button></article>)}</div>
 <div className="rule-actions"><button disabled={draft.stats.length>=64} onClick={()=>add('base')}>Добавить исходный показатель</button><button disabled={draft.stats.length>=64} onClick={()=>add('derived')}>Добавить вычисляемый показатель</button>
 <button onClick={()=>{
  const parsed=rulesetSchema.safeParse({...draft,id:rules.id,revision:rules.revision+1});
  if(!parsed.success){setError(parsed.error.issues.map(issue=>issue.message).join('; '));setNotice('');return;}
  if(onRules(parsed.data)){setError('');setNotice('Правила применены. Сохраните партию.');}
 }}>Применить правила</button>
 <button className="secondary" onClick={()=>{setDraft(rules);setError('');setNotice('Черновик сброшен.');}}>Сбросить черновик правил</button></div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <details><summary>Как писать формулы</summary><p>Ключи: латинская буква и затем строчные буквы, цифры или подчёркивания, до 32 символов. В формулах используйте ключи, а не русские названия.</p>
 <p>Операции: + − * /, скобки; функции ceil, floor, abs, min, max. Например: ceil(agility / 3) + 5, если вы создали показатель agility. Дроби пишутся с точкой: 0.5.</p>
 <p>Условия: &lt;, &gt;, &lt;=, &gt;=, ==, !=, &amp;&amp;, ||, !; if(условие, значение при истине, значение при лжи). Истина — 1, ложь — 0. Например if(hp &lt; 10, 2, 0), если показатель hp определён. Неизвестные ссылки и циклы не допускаются. Функции не выполняют произвольный код. Обычные проверки и игровые действия доступны в проведении игры.</p></details>
 <section className="calculation-panel"><h3>Проверка расчёта и значения персонажа</h3>
 <label>Источник значений<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Пробный расчёт</option>{characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="grid-fields">{rules.stats.filter(stat=>stat.kind==='base').map(stat=><label key={stat.key}>Ввод: {stat.name}<input type="number" step="any" value={inputs[stat.key]??''} onChange={event=>setInputs({...inputs,[stat.key]:event.target.value})}/></label>)}</div>
 {calculationError?<p role="alert">{calculationError}</p>:<table><thead><tr><th>Показатель</th><th>Значение</th><th>Объяснение</th></tr></thead><tbody>{calculation.map(row=><tr key={row.key}><td>{row.name} ({row.key})</td><td data-result={row.key}>{row.value}</td><td>{row.explanation}</td></tr>)}</tbody></table>}
 {character&&<button disabled={!!calculationError} onClick={()=>{try{if(onValues(character.id,{...character.values,...numericInputs()})){setNotice('Значения персонажа применены. Сохраните партию.');setError('');}}catch(error){setError(error instanceof Error?error.message:'Ошибка');}}}>Сохранить значения персонажа</button>}
 <p className="hint">Расчёт использует применённые правила, а не черновик выше. Пробные значения не сохраняются. Для персонажа сохраняются только исходные значения, производные пересчитываются. После изменения ключа прежние значения сохраняются в файле, но не используются до возврата ключа. HP, ресурсы и бой пока не управляются автоматически.</p>
 </section></section>;
}
