import React,{useEffect,useState} from 'react';
import type {Campaign} from '../shared/campaign.js';
import type {Recovery} from '../shared/encounter.js';
import {startEncounter,nextTurn,endEncounter,reorderEncounter,currentActor} from '../domain/encounter.js';
import {resourceBudget} from '../domain/resources.js';

const recoveryNames:Record<Recovery,string>={turn:'Полностью в начале своего хода',round:'Полностью в начале раунда',manual:'Только вручную'};
export function Encounter({campaign,onChange,onCharacter}:{campaign:Campaign;onChange:(next:Campaign,message:string)=>boolean;onCharacter:(id:string)=>void}){
 const [rows,setRows]=useState<{id:string;selected:boolean;initiative:string}[]>([]),[recovery,setRecovery]=useState<Recovery>('turn'),[sort,setSort]=useState(true),[error,setError]=useState('');
 useEffect(()=>setRows(previous=>campaign.characters.map(character=>previous.find(row=>row.id===character.id)??{id:character.id,selected:false,initiative:'0'})),[campaign.characters]);
 function act(action:()=>Campaign,message:string){try{if(onChange(action(),message))setError('');else setError('Изменение боя отклонено');}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить бой');}}
 const battle=campaign.encounter;
 return <section className="encounter-panel" aria-label="Управление боем"><h2>Бой</h2>
 {battle?<><p className="encounter-current" data-testid="encounter-current">Раунд {battle.round} · Ход {battle.turnIndex+1}/{battle.participants.length}: <strong>{campaign.characters.find(character=>character.id===currentActor(campaign))?.name}</strong></p>
 <p>Восстановление ОД: {recoveryNames[battle.recovery]}. Перестановка не восстанавливает ОД и сохраняет текущего участника.</p>
 <ol>{battle.participants.map((row,index)=>{const character=campaign.characters.find(character=>character.id===row.characterId)!;let budget='';try{const value=resourceBudget(campaign,character,battle.apStat);budget=`ОД ${Number(value.remaining.toFixed(3))}/${value.maximum}`;}catch(e){budget=e instanceof Error?e.message:'Ошибка ОД';}
 const reorder=(direction:number)=>{const ids=battle.participants.map(row=>row.characterId);[ids[index],ids[index+direction]]=[ids[index+direction],ids[index]];act(()=>reorderEncounter(campaign,ids),'Порядок боя изменён без сброса ОД.');};
 return <li key={row.characterId} className={currentActor(campaign)===row.characterId?'current-actor':''}><strong>{character.name}</strong> · инициатива {row.initiative} · {budget} <button onClick={()=>onCharacter(row.characterId)}>Карточка: {character.name}</button><button disabled={index===0} aria-label={`Раньше: ${character.name}`} onClick={()=>reorder(-1)}>↑</button><button disabled={index===battle.participants.length-1} aria-label={`Позже: ${character.name}`} onClick={()=>reorder(1)}>↓</button></li>;})}</ol>
 <button onClick={()=>act(()=>nextTurn(campaign),'Ход передан. Сохраните партию.')}>Следующий ход</button><button className="secondary" onClick={()=>{if(window.confirm('Завершить бой? Порядок и раунд будут закрыты; текущие HP, ОД, вещи и позиции сохранятся.'))act(()=>endEncounter(campaign),'Бой завершён. Ресурсы сохранены.');}}>Завершить бой</button>
 <p className="hint">Двигается текущий участник. Для вмешательства используйте расстановку мастера. Смена поля и конфигуратора не передаёт ход. Удаление участника или смена показателя ОД доступны после завершения боя.</p>
 </>:<><p>Выберите участников. Введите результат инициативы вручную: формула броска пока не определена. При равенстве сохраняется порядок списка.</p>
 <button onClick={()=>{const ids=new Set(campaign.tokens.filter(token=>token.mapId===campaign.view.activeMapId).map(token=>token.characterId));setRows(rows.map(row=>({...row,selected:ids.has(row.id)})));}}>Выбрать всех на текущем поле</button>
 <div className="encounter-setup">{rows.map(row=><div key={row.id}><label className="grid-toggle"><input type="checkbox" checked={row.selected} onChange={event=>setRows(rows.map(existing=>existing.id===row.id?{...existing,selected:event.target.checked}:existing))}/>{campaign.characters.find(character=>character.id===row.id)?.name}</label><label>Инициатива<input aria-label={`Инициатива: ${campaign.characters.find(character=>character.id===row.id)?.name}`} type="number" min="-1000000" max="1000000" step="any" value={row.initiative} onChange={event=>setRows(rows.map(existing=>existing.id===row.id?{...existing,initiative:event.target.value}:existing))}/></label></div>)}</div>
 <label className="grid-toggle"><input type="checkbox" checked={sort} onChange={event=>setSort(event.target.checked)}/>По убыванию инициативы; иначе — порядок списка</label>
 <label>Восстановление ОД<select aria-label="Восстановление ОД" value={recovery} onChange={event=>setRecovery(event.target.value as Recovery)}>{Object.entries(recoveryNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
 <p className="hint">При начале хода восстанавливаются ОД только входящего участника; при начале раунда — всех участников, включая раунд 1. «Только вручную» ничего не восстанавливает. HP и способности автоматически не восстанавливаются.</p>
 <button disabled={!rows.some(row=>row.selected)} onClick={()=>act(()=>startEncounter(campaign,rows.filter(row=>row.selected).map(row=>({characterId:row.id,initiative:row.initiative.trim()?Number(row.initiative):NaN})),recovery,sort),'Бой начат. Включён расход ОД.')}>Начать бой</button>
 </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
