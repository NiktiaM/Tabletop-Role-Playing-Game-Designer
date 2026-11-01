import React, { useEffect, useState } from 'react';
import {evaluateStats} from '../domain/rules/evaluate.js';
import {CharacterValues} from './CharacterValues.js';
import { characterSchema, type Campaign, type Character } from '../shared/campaign.js';
export function Characters({campaign,onCreate,onDelete,onPlace,onMessage,onValues}: {campaign:Campaign;onCreate:(character:Character)=>void;onDelete:(id:string)=>void;onPlace:(id:string)=>void;onMessage:(message:string)=>void;onValues:(id:string,values:Record<string,number>)=>boolean}) {
 const [creationValues,setCreationValues]=useState<Record<string,string>>({});
 useEffect(()=>setCreationValues(Object.fromEntries(campaign.ruleset.stats.filter(stat=>stat.kind==='base').map(stat=>[stat.key,String(stat.kind==='base'?stat.defaultValue:0)]))),[campaign.ruleset.id,campaign.ruleset.revision]);
 const [statsId,setStatsId]=useState<string|null>(null);
 const [name,setName]=useState(''),[kind,setKind]=useState('character'),[width,setWidth]=useState('1'),[height,setHeight]=useState('1');
 const [portrait,setPortrait]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="characters">
 <h2>Персонажи и NPC</h2>
 <form noValidate onSubmit={event=>{
  event.preventDefault();const values=Object.fromEntries(Object.entries(creationValues).map(([key,value])=>[key,value.trim()?Number(value):NaN]));const parsed=characterSchema.safeParse({id:crypto.randomUUID(),name,kind,footprint:{width:Number(width),height:Number(height)},portrait,values});
  if(!parsed.success){setError('Введите имя (1–120 символов) и целую ширину/высоту от 1 до 10 клеток и числовые характеристики.');return;}
  if(campaign.characters.length>=200){setError('Предел — 200 персонажей в партии.');return;}
  onCreate(parsed.data);setName('');setPortrait(null);setError('');
 }}>
 <div className="grid-fields">
 <label>Имя персонажа<input value={name} maxLength={120} onChange={event=>setName(event.target.value)} /></label>
 <label>Тип персонажа<select value={kind} onChange={event=>setKind(event.target.value)}><option value="character">Персонаж</option><option value="npc">NPC</option></select></label>
 <label>Ширина, клеток<input type="number" min="1" max="10" step="1" value={width} onChange={event=>setWidth(event.target.value)} /></label>
 <label>Высота, клеток<input type="number" min="1" max="10" step="1" value={height} onChange={event=>setHeight(event.target.value)} /></label>
 </div>
 <h3>Исходные характеристики</h3>
 <div className="grid-fields">{campaign.ruleset.stats.filter(stat=>stat.kind==='base').map(stat=><label key={stat.key}>Создание: {stat.name}<input type="number" step="any" value={creationValues[stat.key]??''} onChange={event=>setCreationValues({...creationValues,[stat.key]:event.target.value})}/></label>)}</div>
 {campaign.ruleset.stats.length===0&&<p className="hint">В партии пока нет характеристик. Откройте «Правила» и нажмите «Использовать R Prison — черновик».</p>}
 <div className="character-actions">{portrait&&<img className="portrait-preview" src={portrait} alt="Новый портрет" />}<button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);try {const result=await window.campaigns.importPortrait();if(!result.ok){setError(result.error);return;}if(result.value)setPortrait(result.value);}catch{setError('Не удалось импортировать портрет.');}finally{setBusy(false);}
 }}>Выбрать портрет…</button>{portrait&&<button type="button" onClick={()=>setPortrait(null)}>Убрать портрет</button>}<button disabled={busy}>Добавить персонажа</button></div>
 {error&&<p role="alert">{error}</p>}
 <p className="hint">Портрет необязателен: без него токен показывает первую букву имени. Размещение: нажмите «На карту», затем щёлкните свободную клетку. Занятые клетки и выход за карту не допускаются.</p>
 </form>
 <div className="character-list">{campaign.characters.map(character=><article key={character.id}>
 {character.portrait&&<img className="portrait-preview" src={character.portrait} alt="" />}<strong>{character.name}</strong><span>{character.kind==='npc'?'NPC':'Персонаж'} · {character.footprint.width}×{character.footprint.height}</span>
 <CharacterSummary character={character} campaign={campaign}/>
 <div className="character-equipment"><strong>Предметы:</strong> {campaign.items.filter(item=>item.ownerId===character.id).length?campaign.items.filter(item=>item.ownerId===character.id).map(item=><span key={item.id}>{item.template.name} · прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}{item.equipped?' · экипирован':''}</span>):<span>Нет предметов. Выдайте их во вкладке «Предметы».</span>}</div>
 <button onClick={()=>setStatsId(statsId===character.id?null:character.id)}>Характеристики: {character.name}</button>
 <button disabled={!campaign.view.activeMapId} onClick={()=>onPlace(character.id)}>На карту: {character.name}</button>
 <button className="secondary" onClick={()=>{if(window.confirm(`Удалить ${character.name} и все его токены со всех карт? Предметы вернутся в общий запас.`)){onDelete(character.id);onMessage('Персонаж и его токены удалены.');}}}>Удалить: {character.name}</button>
 {statsId===character.id&&<CharacterValues character={character} rules={campaign.ruleset} onSave={values=>onValues(character.id,values)}/>}
 </article>)}</div>
 </section>;
}

function CharacterSummary({character,campaign}:{character:Character;campaign:Campaign}) {
 try {const rows=evaluateStats(campaign.ruleset,character.values);return <div className="character-summary">{rows.map(row=><span key={row.key} title={row.explanation}><strong>{row.name}</strong>: {row.value}</span>)}{!rows.length&&<span>Характеристики не заданы — выберите готовые правила.</span>}</div>;}catch(error){return <p role="alert">{error instanceof Error?error.message:'Ошибка расчёта'}</p>;}
}
