import React, { useState } from 'react';
import { characterSchema, type Campaign, type Character } from '../shared/campaign.js';
export function Characters({campaign,onCreate,onDelete,onPlace,onMessage}: {campaign:Campaign;onCreate:(character:Character)=>void;onDelete:(id:string)=>void;onPlace:(id:string)=>void;onMessage:(message:string)=>void}) {
 const [name,setName]=useState(''),[kind,setKind]=useState('character'),[width,setWidth]=useState('1'),[height,setHeight]=useState('1');
 const [portrait,setPortrait]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="characters">
 <h2>Персонажи и NPC</h2>
 <form noValidate onSubmit={event=>{
  event.preventDefault();const parsed=characterSchema.safeParse({id:crypto.randomUUID(),name,kind,footprint:{width:Number(width),height:Number(height)},portrait});
  if(!parsed.success){setError('Введите имя (1–120 символов) и целую ширину/высоту от 1 до 10 клеток.');return;}
  if(campaign.characters.length>=200){setError('Предел — 200 персонажей в партии.');return;}
  onCreate(parsed.data);setName('');setPortrait(null);setError('');
 }}>
 <div className="grid-fields">
 <label>Имя персонажа<input value={name} maxLength={120} onChange={event=>setName(event.target.value)} /></label>
 <label>Тип персонажа<select value={kind} onChange={event=>setKind(event.target.value)}><option value="character">Персонаж</option><option value="npc">NPC</option></select></label>
 <label>Ширина, клеток<input type="number" min="1" max="10" step="1" value={width} onChange={event=>setWidth(event.target.value)} /></label>
 <label>Высота, клеток<input type="number" min="1" max="10" step="1" value={height} onChange={event=>setHeight(event.target.value)} /></label>
 </div>
 <div className="character-actions">{portrait&&<img className="portrait-preview" src={portrait} alt="Новый портрет" />}<button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);try {const result=await window.campaigns.importPortrait();if(!result.ok){setError(result.error);return;}if(result.value)setPortrait(result.value);}catch{setError('Не удалось импортировать портрет.');}finally{setBusy(false);}
 }}>Выбрать портрет…</button>{portrait&&<button type="button" onClick={()=>setPortrait(null)}>Убрать портрет</button>}<button disabled={busy}>Добавить персонажа</button></div>
 {error&&<p role="alert">{error}</p>}
 <p className="hint">Портрет необязателен: без него токен показывает первую букву имени. Размещение: нажмите «На карту», затем щёлкните свободную клетку. Занятые клетки и выход за карту не допускаются.</p>
 </form>
 <div className="character-list">{campaign.characters.map(character=><article key={character.id}>
 {character.portrait&&<img className="portrait-preview" src={character.portrait} alt="" />}<strong>{character.name}</strong><span>{character.kind==='npc'?'NPC':'Персонаж'} · {character.footprint.width}×{character.footprint.height}</span>
 <button disabled={!campaign.view.activeMapId} onClick={()=>onPlace(character.id)}>На карту: {character.name}</button>
 <button className="secondary" onClick={()=>{if(window.confirm(`Удалить ${character.name} и все его токены со всех карт?`)){onDelete(character.id);onMessage('Персонаж и его токены удалены.');}}}>Удалить: {character.name}</button>
 </article>)}</div>
 </section>;
}
