import React,{useState} from 'react';
import type {Campaign} from '../shared/campaign.js';
import type {ContentPack} from '../shared/content.js';
import {mergeContent} from '../domain/content.js';
export function ContentImport({campaign,onImport}:{campaign:Campaign;onImport:(campaign:Campaign)=>boolean}){
 const [pack,setPack]=useState<ContentPack|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 let compatibility='';if(pack)try{mergeContent(campaign,pack);}catch(error){compatibility=error instanceof Error?error.message:'Несовместимые данные';}
 return <section className="content-import"><h3>Импорт персонажей и предметов из JSON</h3><p className="hint">Формат rprison-content, версия 1. Пример: examples/content-template.json в скачанном проекте. Подробности: docs/content-format.md. Импорт добавляет новые объекты, не заменяя существующие. Повторный импорт создаёт копии.</p>
 <button disabled={busy} onClick={async()=>{setBusy(true);setPack(null);setError('');try{const result=await window.campaigns.importContent();if(!result.ok){setError(result.error);return;}if(result.value)setPack(result.value);}catch{setError('Не удалось открыть файл.');}finally{setBusy(false);}}}>Выбрать JSON для импорта…</button>
 {pack&&<div><p>Будут добавлены персонажи: {pack.characters.length}; шаблоны предметов: {pack.items.length}.</p><ul>{pack.characters.map((character,index)=><li key={`c${index}`}>{character.kind==='npc'?'NPC':'Персонаж'}: {character.name}</li>)}{pack.items.map((item,index)=><li key={`i${index}`}>Предмет: {item.name}</li>)}</ul>
 {compatibility&&<p role="alert">{compatibility}</p>}
 <button disabled={!!compatibility} onClick={()=>{try{if(onImport(mergeContent(campaign,pack))){setPack(null);setError('');}}catch(error){setError(error instanceof Error?error.message:'Ошибка импорта');}}}>Добавить импорт в партию</button><button className="secondary" onClick={()=>setPack(null)}>Отменить импорт</button></div>}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
