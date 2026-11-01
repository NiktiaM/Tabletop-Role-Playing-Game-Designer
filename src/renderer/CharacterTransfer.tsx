import React,{useState} from 'react';
import type {Campaign} from '../shared/campaign.js';
import type {CharacterBundle} from '../shared/transfer.js';
import {exportCharacter,importCharacter,checkCompatibility} from '../domain/transfer.js';
export function CharacterTransfer({campaign,onImport}:{campaign:Campaign;onImport:(campaign:Campaign)=>boolean}){
 const [selected,setSelected]=useState(''),[pack,setPack]=useState<CharacterBundle|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 let compatibility='';if(pack)try{checkCompatibility(campaign.ruleset,pack.rules);}catch(error){compatibility=error instanceof Error?error.message:'Несовместимые правила';}
 return <section className="transfer-panel"><h3>Персонаж между партиями</h3><p>Экспорт создаёт копию персонажа с портретом, характеристиками, выданными предметами и способностями. Исходная партия не меняется. Карты и токены не переносятся.</p>
 <label>Персонаж для экспорта<select aria-label="Персонаж для экспорта" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Выберите персонажа</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <button disabled={busy||!campaign.characters.some(character=>character.id===selected)} onClick={async()=>{setBusy(true);setMessage('');setError('');try{const result=await window.campaigns.exportCharacter(exportCharacter(campaign,selected));if(!result.ok)setError(result.error);else if(result.value)setMessage(`Экспортировано: ${result.value}`);}catch(error){setError(error instanceof Error?error.message:'Ошибка экспорта');}finally{setBusy(false);}}}>Экспортировать персонажа…</button>
 <button disabled={busy} onClick={async()=>{setBusy(true);setMessage('');setError('');setPack(null);try{const result=await window.campaigns.importCharacter();if(!result.ok)setError(result.error);else if(result.value)setPack(result.value);}catch{setError('Не удалось открыть пакет персонажа');}finally{setBusy(false);}}}>Перенести персонажа из файла…</button>
 {pack&&<div><p>Будет добавлена копия: <strong>{pack.character.name}</strong>. Предметов: {pack.items.length}, способностей: {pack.abilities.length}. Правила источника: {pack.rules.name}, версия {pack.rules.revision}.</p>{compatibility&&<p role="alert">{compatibility}</p>}
 <button disabled={!!compatibility} onClick={()=>{try{if(onImport(importCharacter(campaign,pack))){setPack(null);setMessage('Копия персонажа добавлена. Сохраните целевую партию.');setError('');}}catch(error){setError(error instanceof Error?error.message:'Ошибка добавления');}}}>Добавить копию персонажа</button><button className="secondary" onClick={()=>setPack(null)}>Отменить перенос</button></div>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
