import {createPrisonCharacter,BACKGROUNDS} from '../domain/prison-progression.js';
import {skillIds,backgroundIds} from '../shared/prison.js';
import React, { useEffect, useState } from 'react';
import {LevelSummary} from './LevelSummary.js';
import {movementBudget} from '../domain/movement-action.js';
import {effectiveStats} from '../domain/effective-stats.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
import {CharacterValues} from './CharacterValues.js';
import { characterSchema, type Campaign, type Character } from '../shared/campaign.js';
export function Characters({campaign,onCreate,onDelete,onPlace,onMessage,onValues,configure=true,onRemoveTokens,onAddStats}: {campaign:Campaign;onCreate:(character:Character)=>void;onDelete:(id:string)=>void;onPlace:(id:string)=>void;onMessage:(message:string)=>void;onValues:(id:string,values:Record<string,number>)=>boolean;configure?:boolean;onAddStats?:()=>void;onRemoveTokens?:(id:string)=>void}) {
 const [background,setBackground]=useState<typeof backgroundIds[number]>('gap'),[skill,setSkill]=useState<typeof skillIds[number]>('Наблюдательность');
 const [creationValues,setCreationValues]=useState<Record<string,string>>({});
 useEffect(()=>setCreationValues(Object.fromEntries(campaign.ruleset.stats.filter(stat=>stat.kind==='base').map(stat=>[stat.key,String(stat.kind==='base'?stat.defaultValue:0)]))),[campaign.ruleset.id,campaign.ruleset.revision]);
 const [level,setLevel]=useState('1');
 const derivedLevel=campaign.ruleset.stats.some(stat=>stat.key==='level'&&stat.kind==='derived');
 useEffect(()=>{const definition=campaign.ruleset.stats.find(stat=>stat.key==='level');setLevel(String(definition?.kind==='base'?definition.defaultValue:1));},[campaign.ruleset.id,campaign.ruleset.revision]);
 let levelPreview='';if(derivedLevel)try{levelPreview=String(evaluateStats(campaign.ruleset,Object.fromEntries(Object.entries(creationValues).map(([key,value])=>[key,Number(value)]))).find(stat=>stat.key==='level')?.value??'');}catch{}
 const [statsId,setStatsId]=useState<string|null>(null);
 const [name,setName]=useState(''),[kind,setKind]=useState('character'),[width,setWidth]=useState('1'),[height,setHeight]=useState('1');
 const [portrait,setPortrait]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="characters">
 <h2>Персонажи и NPC</h2>{configure&&onAddStats&&<button type="button" onClick={onAddStats}>Добавить характеристики R Prison</button>}
 {configure&&<form noValidate onSubmit={event=>{
  event.preventDefault();const values=Object.fromEntries(Object.entries(creationValues).map(([key,value])=>[key,value.trim()?Number(value):NaN]));let effectiveLevel=Number(level);try{if(derivedLevel)effectiveLevel=evaluateStats(campaign.ruleset,values).find(stat=>stat.key==='level')!.value;}catch{setError('Не удалось рассчитать уровень по правилам');return;}if(!Number.isInteger(effectiveLevel)||effectiveLevel<1||effectiveLevel>1000){setError('Уровень — целое число от 1 до 1000');return;}if(!derivedLevel)values.level=effectiveLevel;let raw:unknown={id:crypto.randomUUID(),name,kind,footprint:{width:Number(width),height:Number(height)},portrait,values};
  if(campaign.gameplay.rulesVersion==='prison03'&&kind==='character'){try{raw=createPrisonCharacter({name,values,background,skill,footprint:{width:Number(width),height:Number(height)},portrait});}catch(e){setError(e instanceof Error?e.message:'Проверьте создание');return;}}
  const parsed=characterSchema.safeParse(raw);
  if(!parsed.success){setError('Введите имя (1–120 символов) и целую ширину/высоту от 1 до 10 клеток и числовые характеристики.');return;}
  if(campaign.characters.length>=200){setError('Предел — 200 персонажей в партии.');return;}
  onCreate(parsed.data);setName('');setPortrait(null);setError('');
 }}>
 <div className="grid-fields">
 <label>Имя персонажа<input value={name} maxLength={120} onChange={event=>setName(event.target.value)} /></label>
 <label>Уровень персонажа<input type="number" min="1" max="1000" step="1" value={derivedLevel?levelPreview:level} disabled={derivedLevel} onChange={event=>setLevel(event.target.value)}/></label>
 <label>Тип персонажа<select value={kind} onChange={event=>setKind(event.target.value)}><option value="character">Персонаж</option><option value="npc">NPC</option></select></label>
 <label>Ширина, клеток<input type="number" min="1" max="10" step="1" value={width} onChange={event=>setWidth(event.target.value)} /></label>
 <label>Высота, клеток<input type="number" min="1" max="10" step="1" value={height} onChange={event=>setHeight(event.target.value)} /></label>
 </div>
 {campaign.gameplay.rulesVersion==='prison03'&&kind==='character'&&<><p>Распределите20 очков до бонуса. Стартовый уровень1, предыстория добавит2 очка; итоговый максимум15.</p><label>Предыстория<select value={background} onChange={e=>setBackground(e.target.value as typeof background)}>{BACKGROUNDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><p>{BACKGROUNDS.find(b=>b.id===background)?.feature}</p><label>Стартовый навык<select value={skill} onChange={e=>setSkill(e.target.value as typeof skill)}>{skillIds.map(s=><option key={s}>{s}</option>)}</select></label></>}
 <h3>Исходные характеристики</h3>
 <div className="grid-fields">{campaign.ruleset.stats.filter(stat=>stat.kind==='base'&&stat.key!=='level').map(stat=><label key={stat.key}>Создание: {stat.name}<input type="number" step="any" value={creationValues[stat.key]??''} onChange={event=>setCreationValues({...creationValues,[stat.key]:event.target.value})}/></label>)}</div>
 {campaign.ruleset.stats.length===0&&<p className="hint">В партии пока нет характеристик. Откройте «Правила» и нажмите «Использовать R Prison — черновик».</p>}
 <div className="character-actions">{portrait&&<img className="portrait-preview" src={portrait} alt="Новый портрет" />}<button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);try {const result=await window.campaigns.importPortrait();if(!result.ok){setError(result.error);return;}if(result.value)setPortrait(result.value);}catch{setError('Не удалось импортировать портрет.');}finally{setBusy(false);}
 }}>Выбрать портрет…</button>{portrait&&<button type="button" onClick={()=>setPortrait(null)}>Убрать портрет</button>}<button disabled={busy}>Добавить персонажа</button></div>
 {error&&<p role="alert">{error}</p>}
 <p className="hint">Портрет необязателен: без него токен показывает первую букву имени. Размещение: нажмите «На карту», затем щёлкните свободную клетку. Занятые клетки и выход за карту не допускаются.</p>
 </form>}
 {configure&&campaign.encounter&&<p className="hint">Идёт бой. Участников можно удалить после завершения боя в режиме игры.</p>}
 <div className="character-list">{campaign.characters.map(character=><article key={character.id}>
 {character.portrait&&<img className="portrait-preview" src={character.portrait} alt="" />}<strong>{character.name}</strong><span>{character.kind==='npc'?'NPC':'Персонаж'} · {character.footprint.width}×{character.footprint.height}</span>
 <LevelSummary character={character} rules={campaign.ruleset}/>
 <CharacterSummary character={character} campaign={campaign}/>
 <div className="character-equipment"><strong>Способности:</strong>{campaign.abilities.filter(ability=>ability.ownerId===character.id).map(ability=><span key={ability.id}>{ability.definition.name} · {ability.definition.maxUses?`${ability.usesRemaining}/${ability.definition.maxUses}`:'без лимита'}</span>)}</div>
 <div className="character-equipment"><strong>Предметы:</strong> {campaign.items.filter(item=>item.ownerId===character.id).length?campaign.items.filter(item=>item.ownerId===character.id).map(item=><span key={item.id}>{item.template.name} · прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}{item.equipped?' · экипирован':''}</span>):<span>Нет предметов. Выдайте их во вкладке «Предметы».</span>}</div>
 {configure&&<button onClick={()=>setStatsId(statsId===character.id?null:character.id)}>Характеристики: {character.name}</button>}
 <button disabled={!campaign.view.activeMapId} onClick={()=>onPlace(character.id)}>На карту: {character.name}</button>
 {!configure&&onRemoveTokens&&<button disabled={!campaign.tokens.some(token=>token.characterId===character.id&&token.mapId===campaign.view.activeMapId)} onClick={()=>onRemoveTokens(character.id)}>Убрать с текущего поля: {character.name}</button>}
 {configure&&<button className="secondary" disabled={!!campaign.encounter?.participants.some(row=>row.characterId===character.id)} title={campaign.encounter?.participants.some(row=>row.characterId===character.id)?'Сначала завершите бой':undefined} onClick={()=>{if(window.confirm(`Удалить ${character.name} и все его токены со всех карт? Предметы вернутся в общий запас; назначенные способности удалятся.`)){onDelete(character.id);onMessage('Персонаж и его токены удалены.');}}}>Удалить: {character.name}</button>}
 {configure&&statsId===character.id&&<CharacterValues character={character} rules={campaign.ruleset} onSave={values=>onValues(character.id,values)}/>}
 </article>)}</div>
 </section>;
}

function CharacterSummary({character,campaign}:{character:Character;campaign:Campaign}) {
 try {const rows=effectiveStats(campaign,character);let remaining:string|null=null;if(campaign.ruleset.movement.budgetStat)try{const budget=movementBudget(campaign,character);remaining=`${Number(budget.remaining.toFixed(3))} / ${budget.maximum}`;}catch{remaining='Проверьте настройку бюджета';}return <div className="character-summary">{remaining&&<span><strong>Остаток бюджета</strong>: {remaining}</span>}{rows.map(row=><span key={row.key} title={row.explanation}><strong>{row.name}</strong>: {row.value}</span>)}{!rows.length&&<span>Характеристики не заданы — выберите готовые правила.</span>}</div>;}catch(error){return <p role="alert">{error instanceof Error?error.message:'Ошибка расчёта'}</p>;}
}
