import {MechanicsEditor} from './MechanicsEditor.js';
import {mechanicsSchema,defaultMechanics} from '../shared/mechanics.js';
import React,{useEffect,useState} from 'react';
import {abilitySchema,type Ability,type AssignedAbility} from '../shared/abilities.js';
import type {Campaign} from '../shared/campaign.js';
export function Abilities({campaign,onTemplates,onAssigned,configure=true}:{campaign:Campaign;onTemplates:(items:Ability[])=>boolean;onAssigned:(items:AssignedAbility[])=>boolean;configure?:boolean}){
 const [mechanics,setMechanics]=useState(defaultMechanics);
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[cost,setCost]=useState(''),[max,setMax]=useState('0'),[owner,setOwner]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(owner&&!campaign.characters.some(character=>character.id===owner))setOwner('');},[campaign.characters,owner]);
 function reset(){setMechanics(defaultMechanics());setEditing(null);setName('');setDescription('');setCost('');setMax('0');setError('');}
 return <section className="abilities-panel"><h2>Способности</h2><p>Создайте описание и назначьте персонажу/NPC. Числовые стоимость и эффекты настраиваются в «Игровое применение и бонусы». В игре применяйте через «Действия»; кнопки ниже меняют счётчики вручную. Ноль использований означает отсутствие лимита.</p>
 {configure&&<form noValidate onSubmit={event=>{event.preventDefault();const existing=campaign.abilityTemplates.find(ability=>ability.id===editing);const parsed=abilitySchema.safeParse({id:editing??crypto.randomUUID(),revision:(existing?.revision??0)+1,mechanics,name,description,costText:cost,maxUses:max.trim()?Number(max):NaN});if(!parsed.success){setError('Имя 1–120 символов, описание до 4000, стоимость до 200; лимит — целое число 0–100000.');return;}if(onTemplates(editing?campaign.abilityTemplates.map(ability=>ability.id===editing?parsed.data:ability):[...campaign.abilityTemplates,parsed.data]))reset();else setError('Не удалось сохранить: максимум 200 шаблонов.');}}>
 <label>Название способности<input maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><label>Описание способности<textarea maxLength={4000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
 <div className="grid-fields"><label>Стоимость (памятка)<input maxLength={200} value={cost} onChange={event=>setCost(event.target.value)}/></label><label>Лимит использований<input type="number" min="0" max="100000" step="1" value={max} onChange={event=>setMax(event.target.value)}/></label></div>
 <MechanicsEditor value={mechanics} onChange={setMechanics} campaign={campaign}/>
 <button>{editing?'Сохранить способность':'Создать способность'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>Отменить редактирование</button>}{error&&<p role="alert">{error}</p>}</form>}
 <label>Назначить персонажу<select aria-label="Назначить персонажу" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">Выберите персонажа</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="ability-list">{campaign.abilityTemplates.map(ability=><article key={ability.id}><h3>{ability.name}</h3><p>{ability.description}</p><p>{ability.costText||'Стоимость не указана'} · v{ability.revision} · лимит {ability.maxUses||'∞'}</p>
 <button disabled={!owner} onClick={()=>{if(onAssigned([...campaign.abilities,{id:crypto.randomUUID(),ownerId:owner,definition:structuredClone(ability),usesRemaining:ability.maxUses}]))setError('');else setError('Назначение отклонено: проверьте владельца и предел 1000 назначений.');}}>Назначить: {ability.name}</button>
 {configure&&<button className="secondary" onClick={()=>{setMechanics(mechanicsSchema.parse(ability.mechanics??{}));setEditing(ability.id);setName(ability.name);setDescription(ability.description);setCost(ability.costText);setMax(String(ability.maxUses));setError('');}}>Редактировать: {ability.name}</button>}
 {configure&&<button className="secondary" onClick={()=>{if(window.confirm(`Удалить шаблон ${ability.name}? Назначенные способности останутся.`)){onTemplates(campaign.abilityTemplates.filter(existing=>existing.id!==ability.id));if(editing===ability.id)reset();}}}>Удалить шаблон: {ability.name}</button>}</article>)}</div>
 <h3>Назначенные способности</h3>{campaign.abilities.filter(ability=>!owner||ability.ownerId===owner).map(ability=><article key={ability.id} data-ability={ability.id}><h3>{ability.definition.name} · {campaign.characters.find(character=>character.id===ability.ownerId)?.name}</h3><p>{ability.definition.description}</p><p>{ability.definition.costText} · снимок v{ability.definition.revision} · Осталось: <strong>{ability.definition.maxUses?`${ability.usesRemaining}/${ability.definition.maxUses}`:'без ограничений'}</strong></p>
 {configure&&<AssignedMechanics campaign={campaign} ability={ability} onSave={next=>onAssigned(campaign.abilities.map(a=>a.id===next.id?next:a))}/>}
 <button disabled={!ability.definition.maxUses||ability.usesRemaining===0} onClick={()=>onAssigned(campaign.abilities.map(existing=>existing.id===ability.id?{...existing,usesRemaining:existing.usesRemaining-1}:existing))}>Использовать: {ability.definition.name}</button>
 <button className="secondary" disabled={!ability.definition.maxUses} onClick={()=>onAssigned(campaign.abilities.map(existing=>existing.id===ability.id?{...existing,usesRemaining:existing.definition.maxUses}:existing))}>Восстановить: {ability.definition.name}</button>
 <button className="secondary" onClick={()=>onAssigned(campaign.abilities.filter(existing=>existing.id!==ability.id))}>Снять: {ability.definition.name}</button></article>)}
 <p className="hint">Назначение хранит собственный снимок: изменение шаблона не меняет уже назначенную способность. Восстановление счётчика сейчас ручное, без автоматических событий хода/сцены.</p>
 </section>;
}

function AssignedMechanics({campaign,ability,onSave}:{campaign:Campaign;ability:AssignedAbility;onSave:(ability:AssignedAbility)=>boolean}){
 const [value,setValue]=useState(()=>mechanicsSchema.parse(ability.definition.mechanics??{})),[error,setError]=useState('');
 useEffect(()=>setValue(mechanicsSchema.parse(ability.definition.mechanics??{})),[ability.id,ability.definition]);
 return <details><summary>Настроить для персонажа: {ability.definition.name}</summary><MechanicsEditor campaign={campaign} value={value} onChange={setValue}/><button onClick={()=>{const parsed=abilitySchema.safeParse({...ability.definition,revision:ability.definition.revision+1,mechanics:value});if(!parsed.success){setError('Проверьте числовые параметры применения');return;}if(onSave({...ability,definition:parsed.data}))setError('');}}>Сохранить применение способности</button>{error&&<p role="alert">{error}</p>}</details>;
}
