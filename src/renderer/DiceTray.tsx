import React,{useEffect,useRef,useState} from 'react';
import type {DiceRoll} from '../shared/dice.js';
import type {Campaign} from '../shared/campaign.js';
import {rollDice} from '../domain/dice.js';
export function DiceTray({campaign,onChange}:{campaign:Campaign;onChange:(next:Campaign,message:string)=>boolean}){
 const [open,setOpen]=useState(false),[count,setCount]=useState('1'),[sides,setSides]=useState('20'),[modifier,setModifier]=useState('0'),[label,setLabel]=useState('Проверка'),[error,setError]=useState(''),[animating,setAnimating]=useState(false);
 const [batch,setBatch]=useState<DiceRoll[]>([]);
 const dialog=useRef<HTMLDialogElement>(null),last=campaign.diceRolls.at(-1),seen=useRef(last?.id);
 useEffect(()=>{if(!last||last.id===seen.current)return;const index=campaign.diceRolls.findIndex(roll=>roll.id===seen.current);setBatch(campaign.diceRolls.slice(index+1));seen.current=last.id;setAnimating(true);dialog.current?.showModal();const timer=setTimeout(()=>setAnimating(false),850);return()=>clearTimeout(timer);},[last?.id]);
 const close=()=>{dialog.current?.close();};
 return <><button onClick={()=>setOpen(!open)}>Кубики</button>{open&&<section className="dice-tray" aria-label="Бросатель кубиков"><h3>Кубики <button onClick={()=>setOpen(false)}>Закрыть кубики</button></h3>
 <label>Количество кубиков<input aria-label="Количество кубиков" type="number" min="1" max="100" value={count} onChange={e=>setCount(e.target.value)}/></label>
 <label>Грани<select aria-label="Грани кубика" value={sides} onChange={e=>setSides(e.target.value)}>{[2,3,4,6,8,10,12,20,30,60,100].map(n=><option key={n} value={n}>d{n}</option>)}<option value="custom">Другой</option></select></label>{sides==='custom'&&<label>Число граней<input aria-label="Свои грани" type="number" min="2" max="1000" id="custom-dice-sides"/></label>}
 <label>Модификатор<input aria-label="Модификатор броска" type="number" value={modifier} onChange={e=>setModifier(e.target.value)}/></label><label>Название проверки<input maxLength={120} value={label} onChange={e=>setLabel(e.target.value)}/></label>
 <button onClick={()=>{try{const faces=sides==='custom'?Number((document.getElementById('custom-dice-sides') as HTMLInputElement)?.value):Number(sides);const roll=rollDice(count.trim()?Number(count):NaN,faces,modifier.trim()?Number(modifier):NaN,label.trim()||'Бросок');if(onChange({...campaign,diceRolls:[...campaign.diceRolls,roll].slice(-200)},'Кубики брошены. Результат сохранён в партии.'))setError('');}catch(e){setError(e instanceof Error?e.message:'Ошибка броска');}}}>Бросить кубики</button>{error&&<p role="alert">{error}</p>}
 <h4>Последние 200 бросков</h4>{[...campaign.diceRolls].reverse().map(roll=><p key={roll.id}>{roll.label}: {roll.count}d{roll.sides}{roll.modifier>=0?'+':''}{roll.modifier} → [{roll.rolls.join(', ')}] = <strong>{roll.total}</strong></p>)}</section>}
 <dialog ref={dialog} className="dice-animation" aria-label="Результат броска" onCancel={e=>{if(animating)e.preventDefault();}}><h2>{animating?'Кубики летят…':'Результат броска'}</h2><div className={animating?'dice-faces rolling':'dice-faces'}>{batch.slice(0,24).map(roll=><div key={roll.id}><div className="dice-faces">{roll.rolls.map((face,index)=><span key={index} className="die-face">{animating?'?':face}</span>)}</div><p>{roll.label}: {roll.count}d{roll.sides}{roll.modifier>=0?'+':''}{roll.modifier}{!animating&&<> = <strong>{roll.total}</strong></>}</p></div>)}</div><p>{batch.length>24?'Показаны первые 24 проверки; остальные сохранены в журнале. ':''}Результаты получены один раз и сохранены; анимация их не перебрасывает.</p><button disabled={animating} onClick={close}>Продолжить</button></dialog>
 </>;
}
