import {SkillEditor} from './SkillEditor.js';
import {Library,LibraryEntry,EmptyLibrary} from './Library.js';
import {createPrisonCharacter,BACKGROUNDS} from '../domain/prison-progression.js';
import {skillIds,backgroundIds} from '../shared/prison.js';
import React, { useEffect, useState } from 'react';
import {LevelSummary} from './LevelSummary.js';
import {movementBudget} from '../domain/movement-action.js';
import {effectiveStats} from '../domain/effective-stats.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
import {CharacterValues} from './CharacterValues.js';
import { characterSchema, type Campaign, type Character } from '../shared/campaign.js';
export function Characters({campaign,onCreate,onDelete,onPlace,onMessage,onValues,configure=true,onRemoveTokens,onAddStats,extras,onSkills}: {onSkills?:(id:string,skills:string[])=>boolean;extras?:React.ReactNode;campaign:Campaign;onCreate:(character:Character)=>void;onDelete:(id:string)=>void;onPlace:(id:string)=>void;onMessage:(message:string)=>void;onValues:(id:string,values:Record<string,number>)=>boolean;configure?:boolean;onAddStats?:()=>void;onRemoveTokens?:(id:string)=>void}) {
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
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[kindFilter,setKindFilter]=useState('all'),[creating,setCreating]=useState(false),[draftDirty,setDraftDirty]=useState(false);
 const query=search.trim().toLocaleLowerCase('ru');
 const visible=campaign.characters.filter(ch=>(kindFilter==='all'||ch.kind===kindFilter)&&ch.name.toLocaleLowerCase('ru').includes(query));
 const character=visible.find(ch=>ch.id===selected)??visible[0];
 function canLeave(){if(!draftDirty)return true;if(!window.confirm('В форме есть несохранённые изменения. Закрыть черновик?'))return false;setName('');setPortrait(null);setDraftDirty(false);setCreationValues(Object.fromEntries(campaign.ruleset.stats.filter(stat=>stat.kind==='base').map(stat=>[stat.key,String(stat.kind==='base'?stat.defaultValue:0)])));return true;}
 return <Library detailKey={creating?'new':character?.id} listKey={`${search}:${kindFilter}`} className="characters" title="Персонажи и NPC" count={campaign.characters.length} subtitle="Выберите запись слева. Карточка и список всегда рядом."
 actions={<>{extras}{configure&&<button onClick={()=>setCreating(true)}>+ Новый персонаж</button>}</>}
 tools={<><label>Поиск персонажей<input type="search" value={search} placeholder="Имя персонажа или NPC" onChange={e=>setSearch(e.target.value)}/></label><label>Тип записей<select aria-label="Тип записей" value={kindFilter} onChange={e=>{if(canLeave()){setKindFilter(e.target.value);setCreating(false);setDraftDirty(false);}}}><option value="all">Все персонажи</option><option value="character">Игроки</option><option value="npc">NPC</option></select></label><span className="result-count">Найдено {visible.length} из {campaign.characters.length}</span></>}
 list={<>{visible.map(ch=><LibraryEntry key={ch.id} id={ch.id} dragId={ch.id} name={ch.name} image={ch.portrait} meta={`${ch.kind==='npc'?'NPC':'Игрок'} · уровень ${ch.values.level??1}`} selected={!creating&&character?.id===ch.id} onSelect={()=>{if(canLeave()){setSelected(ch.id);setCreating(false);setDraftDirty(false);}}}/>)}{!visible.length&&<EmptyLibrary>{campaign.characters.length?'Ничего не найдено. Измените поиск или фильтр.':'Здесь появятся созданные персонажи.'}</EmptyLibrary>}</>}>
 {configure&&creating&&<form onChange={()=>setDraftDirty(true)} noValidate onSubmit={event=>{
  event.preventDefault();const values=Object.fromEntries(Object.entries(creationValues).map(([key,value])=>[key,value.trim()?Number(value):NaN]));let effectiveLevel=Number(level);try{if(derivedLevel)effectiveLevel=evaluateStats(campaign.ruleset,values).find(stat=>stat.key==='level')!.value;}catch{setError('Не удалось рассчитать уровень по правилам');return;}if(!Number.isInteger(effectiveLevel)||effectiveLevel<1||effectiveLevel>1000){setError('Уровень — целое число от 1 до 1000');return;}if(!derivedLevel)values.level=effectiveLevel;let raw:unknown={id:crypto.randomUUID(),name,kind,footprint:{width:Number(width),height:Number(height)},portrait,values};
  if(campaign.gameplay.rulesVersion==='prison03'&&kind==='character'){try{raw=createPrisonCharacter({name,values,background,skill,footprint:{width:Number(width),height:Number(height)},portrait});}catch(e){setError(e instanceof Error?e.message:'Проверьте создание');return;}}
  const parsed=characterSchema.safeParse(raw);
  if(!parsed.success){setError('Введите имя (1–120 символов) и целую ширину/высоту от 1 до 10 клеток и числовые характеристики.');return;}
  if(campaign.characters.length>=200){setError('Предел — 200 персонажей в партии.');return;}
  onCreate(parsed.data);setSelected(parsed.data.id);setCreating(false);setDraftDirty(false);setSearch('');setKindFilter('all');setName('');setPortrait(null);setError('');
 }}>
 <div className="detail-heading"><div><span className="eyebrow">НОВАЯ ЗАПИСЬ</span><h3>Создать персонажа</h3></div><button type="button" className="secondary" onClick={()=>{if(canLeave())setCreating(false);}}>Отменить создание</button></div><div className="grid-fields">
 <label>Имя персонажа<input value={name} maxLength={120} onChange={event=>setName(event.target.value)} /></label>
 <label>Уровень персонажа<input type="number" min="1" max="1000" step="1" value={campaign.gameplay.rulesVersion==='prison03'&&kind==='character'?'1':derivedLevel?levelPreview:level} disabled={derivedLevel||campaign.gameplay.rulesVersion==='prison03'&&kind==='character'} onChange={event=>setLevel(event.target.value)}/></label>
 <label>Тип персонажа<select value={kind} onChange={event=>setKind(event.target.value)}><option value="character">Персонаж</option><option value="npc">NPC</option></select></label>
 <label>Ширина, клеток<input type="number" min="1" max="10" step="1" value={width} onChange={event=>setWidth(event.target.value)} /></label>
 <label>Высота, клеток<input type="number" min="1" max="10" step="1" value={height} onChange={event=>setHeight(event.target.value)} /></label>
 </div>
 {campaign.gameplay.rulesVersion==='prison03'&&kind==='character'&&<><p>Распределите 20 очков до бонуса. Персонаж начинает с 1-го уровня. Предыстория добавляет 2 очка; стартовый предел характеристики — 15.</p><label>Предыстория<select value={background} onChange={e=>setBackground(e.target.value as typeof background)}>{BACKGROUNDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><p>{BACKGROUNDS.find(b=>b.id===background)?.feature}</p><label>Стартовый навык<select value={skill} onChange={e=>setSkill(e.target.value as typeof skill)}>{skillIds.map(s=><option key={s}>{s}</option>)}</select></label></>}
 <h3>Исходные характеристики</h3>{campaign.gameplay.rulesVersion==='prison03'&&kind==='character'&&<p className="creation-budget">Распределено {Number(['strength','dexterity','constitution','charisma'].reduce((n,k)=>n+Number(creationValues[k]||0),0).toFixed(2))} из 20 очков · до бонуса предыстории</p>}
 <div className="grid-fields">{campaign.ruleset.stats.filter(stat=>stat.kind==='base'&&stat.key!=='level').map(stat=><label key={stat.key}>Создание: {stat.name}<input type="number" step="any" value={creationValues[stat.key]??''} onChange={event=>setCreationValues({...creationValues,[stat.key]:event.target.value})}/></label>)}</div>
 {campaign.ruleset.stats.length===0&&<p className="hint">В партии пока нет характеристик. Откройте «Правила» и нажмите «Использовать R Prison — черновик».</p>}
 <div className="character-actions">{portrait&&<img className="portrait-preview" src={portrait} alt="Новый портрет" />}<button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);try {const result=await window.campaigns.importPortrait();if(!result.ok){setError(result.error);return;}if(result.value)setPortrait(result.value);}catch{setError('Не удалось импортировать портрет.');}finally{setBusy(false);}
 }}>Выбрать портрет…</button>{portrait&&<button type="button" onClick={()=>setPortrait(null)}>Убрать портрет</button>}<button disabled={busy}>Добавить персонажа</button></div>
 {error&&<p role="alert">{error}</p>}
 <p className="hint">Портрет необязателен: без него токен показывает первую букву имени. Размещение: нажмите «На карту», затем щёлкните свободную клетку. Занятые клетки и выход за карту не допускаются.</p>
 </form>}
 {!creating&&character&&<article className="character-detail-card" key={character.id}>
 {character.portrait&&<img className="portrait-preview" src={character.portrait} alt="" />}<strong>{character.name}</strong><span>{character.kind==='npc'?'NPC':'Персонаж'} · {character.footprint.width}×{character.footprint.height}</span>
 <LevelSummary character={character} rules={campaign.ruleset}/>
 <CharacterSummary character={character} campaign={campaign}/>
 <details className="detail-section"><summary>Способности · {campaign.abilities.filter(ability=>ability.ownerId===character.id).length}</summary><div className="character-equipment"><strong>Способности:</strong>{campaign.abilities.filter(ability=>ability.ownerId===character.id).map(ability=><span key={ability.id}>{ability.definition.name} · {ability.definition.maxUses?`${ability.usesRemaining}/${ability.definition.maxUses}`:'без лимита'}</span>)}</div></details>
 <details className="detail-section"><summary>Предметы · {campaign.items.filter(item=>item.ownerId===character.id).length}</summary><div className="character-equipment"><strong>Предметы:</strong> {campaign.items.filter(item=>item.ownerId===character.id).length?campaign.items.filter(item=>item.ownerId===character.id).map(item=><span key={item.id}>{item.template.name} · прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}{item.equipped?' · экипирован':''}</span>):<span>Нет предметов. Выдайте их во вкладке «Предметы».</span>}</div></details>
 {configure&&onSkills&&<SkillEditor character={character} onSave={skills=>onSkills(character.id,skills)}/>}
 {configure&&<button onClick={()=>setStatsId(statsId===character.id?null:character.id)}>Характеристики: {character.name}</button>}
 <button disabled={!campaign.view.activeMapId} onClick={()=>onPlace(character.id)}>На карту: {character.name}</button>
 {!configure&&onRemoveTokens&&<button disabled={!campaign.tokens.some(token=>token.characterId===character.id&&token.mapId===campaign.view.activeMapId)} onClick={()=>onRemoveTokens(character.id)}>Убрать с текущего поля: {character.name}</button>}
 {configure&&<button className="secondary" disabled={!!campaign.encounter?.participants.some(row=>row.characterId===character.id)} title={campaign.encounter?.participants.some(row=>row.characterId===character.id)?'Сначала завершите бой':undefined} onClick={()=>{if(window.confirm(`Удалить ${character.name} и все его токены со всех карт? Предметы вернутся в общий запас; назначенные способности удалятся.`)){onDelete(character.id);onMessage('Персонаж и его токены удалены.');}}}>Удалить: {character.name}</button>}
 {configure&&statsId===character.id&&<CharacterValues character={character} rules={campaign.ruleset} onSave={values=>onValues(character.id,values)}/>}
 </article>}
 {!creating&&!character&&<EmptyLibrary><h3>{campaign.characters.length?'Нет подходящих записей':'Добавьте первого участника'}</h3><p>Создавайте игроков и NPC, настраивайте характеристики и размещайте их на карте.</p>{configure&&<button onClick={()=>setCreating(true)}>+ Новый персонаж</button>}</EmptyLibrary>}
 {configure&&onAddStats&&!campaign.ruleset.stats.length&&<button type="button" onClick={onAddStats}>Добавить характеристики R Prison</button>}
 </Library>;
}

function CharacterSummary({character,campaign}:{character:Character;campaign:Campaign}) {
 try {const rows=effectiveStats(campaign,character);let remaining:string|null=null;if(campaign.ruleset.movement.budgetStat)try{const budget=movementBudget(campaign,character);remaining=`${Number(budget.remaining.toFixed(3))} / ${budget.maximum}`;}catch{remaining='Проверьте настройку бюджета';}return <div className="character-summary">{remaining&&<span><strong>ОД для боя</strong>: {remaining}</span>}{rows.map(row=><span key={row.key} title={row.explanation}><strong>{row.name}</strong>: {row.value}</span>)}{!rows.length&&<span>Характеристики не заданы — выберите готовые правила.</span>}</div>;}catch(error){return <p role="alert">{error instanceof Error?error.message:'Ошибка расчёта'}</p>;}
}
