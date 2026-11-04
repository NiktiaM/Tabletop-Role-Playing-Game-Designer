import {SkillEditor} from './SkillEditor.js';
import {carrySummary} from '../domain/prison-inventory.js';
import {condition} from '../domain/prison-state.js';
import {BACKGROUNDS} from '../domain/prison-progression.js';
import {CharacterValues} from './CharacterValues.js';
import {effectiveStats} from '../domain/effective-stats.js';
import {LevelSummary} from './LevelSummary.js';
import React,{useEffect,useState} from 'react';
import type {Campaign,Character} from '../shared/campaign.js';
import {evaluateStats} from '../domain/rules/evaluate.js';
import {resourceBudget} from '../domain/resources.js';
import {movementPolicy} from '../domain/movement-action.js';

type ResourceChange=(id:string,key:string,value:number|null)=>boolean;
export function CharacterCard({campaign,character,onResource,onClose,onValues,onAddStats,onActions,onSkills}:{onSkills:(id:string,skills:string[])=>boolean;campaign:Campaign;character:Character;onResource:ResourceChange;onClose:()=>void;onValues:(id:string,values:Record<string,number>)=>boolean;onAddStats:()=>void;onActions:(id:string)=>void}){
 const [editing,setEditing]=useState(false),[section,setSection]=useState('overview');
 useEffect(()=>{setSection('overview');setEditing(false);},[character.id]);
 const policy=movementPolicy(campaign,character.id);
 let stats:ReturnType<typeof evaluateStats>=[],error='';
 try{stats=effectiveStats(campaign,character);}catch(e){error=e instanceof Error?e.message:'Не удалось рассчитать характеристики';}
 const items=campaign.items.filter(item=>item.ownerId===character.id),abilities=campaign.abilities.filter(ability=>ability.ownerId===character.id);
 return <aside className="character-card" aria-label={`Карточка: ${character.name}`}>
 <div className="card-heading"><h3>{character.name}</h3><button onClick={onClose} aria-label="Закрыть карточку персонажа">Закрыть</button></div>
 {character.portrait&&<img className="portrait-preview" src={character.portrait} alt="Портрет"/>}<p>{character.kind==='npc'?'NPC':'Персонаж'} · {character.footprint.width}×{character.footprint.height} клеток</p>
 <p className={`character-mode ${policy.battle?'in-combat':'exploring'}`}>{policy.reason??(policy.battle?`Ваш ход · ${policy.battle.name??'Бой'}`:'Вне боя · движение без лимита ОД')}</p>
 <div className="card-quick-resources">{([[campaign.ruleset.healthStat,'HP'],[policy.battle?campaign.ruleset.movement.budgetStat:null,'ОД']] as const).map(([key,label])=>{if(!key)return null;try{const v=resourceBudget(campaign,character,key);return <strong key={label}>{label} {Number(v.remaining.toFixed(3))}/{v.maximum}</strong>;}catch{return null;}})}</div>
 <button className="card-primary-action" onClick={()=>onActions(character.id)}>Действия / выбрать целью</button>
 <nav className="card-sections" aria-label="Раздел карточки">{[['overview','Обзор'],['inventory',`Вещи (${items.length})`],['skills','Навыки'],...(campaign.gameplay.abilitiesEnabled?[["abilities",`Способности (${abilities.length})`]]:[]),['master','Мастер']].map(([id,label])=><button key={id} aria-pressed={section===id} onClick={()=>setSection(id)}>{label}</button>)}</nav><div className="card-content">
 {section==='overview'&&<>
 <LevelSummary character={character} rules={campaign.ruleset}/>
 <h4>Характеристики</h4>{error&&<p role="alert">{error}</p>}<dl>{stats.filter(stat=>['strength','dexterity','constitution','charisma'].includes(stat.key)).map(stat=><div key={stat.key}><dt>{stat.name}</dt><dd>{stat.value}</dd></div>)}</dl>
 {campaign.gameplay.rulesVersion==='prison03'&&<><h4>Профиль и состояния</h4><p>{BACKGROUNDS.find(b=>b.id===character.prisonProfile?.background)?.name??'Предыстория не назначена'}</p><p>Навыки: {character.prisonProfile?.skills.join(', ')||'не назначены'}</p><p>{condition(campaign,character.id).bleeding?'Кровотечение · ':''}{condition(campaign,character.id).stunned?'Оглушён · ':''}{condition(campaign,character.id).grappledBy?'В захвате':''}</p>{(()=>{try{const v=carrySummary(campaign,character.id);return <p>Переноска: {v.weight.toFixed(1)}/{v.limit}кг; мелочи {v.slots}/{v.capacity}; руки {v.hands}/2{v.valid?'':' · превышены возможности переноски'}</p>;}catch{return null;}})()}</>}
 </>}
 {section==='skills'&&<SkillEditor character={character} onSave={skills=>onSkills(character.id,skills)}/>}
 {section==='inventory'&&<>
 <h4>Инвентарь ({items.length})</h4>{items.map(item=><article key={item.id}>{item.template.image&&<img className="item-photo" src={item.template.image} alt=""/>}<strong>{item.template.name}</strong><p>Прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}{item.equipped?' · экипирован':''}</p></article>)}{!items.length&&<p>Инвентарь пуст.</p>}
 </>}{section==='abilities'&&<>
 <h4>Способности ({abilities.length})</h4>{abilities.map(ability=><article key={ability.id}><strong>{ability.definition.name}</strong><p>{ability.definition.description}</p><p>{ability.definition.costText||'Стоимость не указана'} · {ability.definition.maxUses?`${ability.usesRemaining}/${ability.definition.maxUses}`:'без лимита'}</p></article>)}{!abilities.length&&<p>Нет назначенных способностей.</p>}
 </>}{section==='master'&&<><p className="hint">Ручные изменения мастера. Они не включают бой и не задают дальность движения вне боя.</p>
 <h4>Текущие ресурсы</h4>
 {campaign.ruleset.healthStat?<ResourceControl key={`hp-${character.id}`} campaign={campaign} character={character} statKey={campaign.ruleset.healthStat} name="HP" onChange={onResource}/>:<p>Показатель HP не настроен. Выберите максимум HP в конфигураторе → «Правила».</p>}
 {campaign.ruleset.movement.budgetStat?<ResourceControl key={`ap-${character.id}`} campaign={campaign} character={character} statKey={campaign.ruleset.movement.budgetStat} name="ОД" onChange={onResource}/>:<p>Показатель ОД не настроен в правилах.</p>}
 <p className="hint">Ресурсы общие для всех токенов персонажа; 0 HP не удаляет персонажа; пропуск хода задаётся настройкой боя.</p>

 <h4>Характеристики</h4>{error&&<p role="alert">{error}</p>}<dl>{stats.map(stat=><div key={stat.key} title={stat.explanation}><dt>{stat.name}</dt><dd>{Number(stat.value.toFixed(3))}</dd></div>)}</dl>
 <button onClick={()=>setEditing(!editing)}>Изменить характеристики</button>{!stats.length&&<button onClick={onAddStats}>Добавить характеристики R Prison</button>}{editing&&<CharacterValues character={character} rules={campaign.ruleset} onSave={values=>onValues(character.id,values)}/>}
 </>}
 <p className="hint">Выберите токен и щёлкните клетку или перетащите его. Вне боя ОД не ограничивают путь. Esc закрывает карточку и панели.</p>
 </div></aside>;
}

function ResourceControl({campaign,character,statKey,name,onChange}:{campaign:Campaign;character:Character;statKey:string;name:string;onChange:ResourceChange}){
 let budget:ReturnType<typeof resourceBudget>|null=null,error='';
 try{budget=resourceBudget(campaign,character,statKey);}catch(e){error=e instanceof Error?e.message:'Ошибка ресурса';}
 const [draft,setDraft]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDraft(budget?String(budget.remaining):'');setNotice('');},[budget?.remaining,budget?.maximum,statKey]);
 if(!budget)return <p role="alert">{name}: {error}</p>;
 const invalid=!draft.trim()||!Number.isFinite(Number(draft))||Number(draft)<0||Number(draft)>budget.maximum;
 return <form className="resource-control" noValidate onSubmit={event=>{event.preventDefault();if(!invalid)setNotice(onChange(character.id,statKey,Number(draft))?'Сохранено':'Изменение отклонено');}}>
 <strong data-testid={`card-${name==='HP'?'hp':'ap'}`}>{name}: {Number(budget.remaining.toFixed(3))} / {Number(budget.maximum.toFixed(3))}</strong>
 <label>Текущие {name}<input aria-label={`Текущие ${name}: ${character.name}`} type="number" min="0" max={budget.maximum} step="any" value={draft} onChange={event=>{setDraft(event.target.value);setNotice('');}}/></label>
 <button disabled={invalid}>Задать {name}</button><button type="button" onClick={()=>setNotice(onChange(character.id,statKey,null)?'Восстановлено до максимума':'Изменение отклонено')}>Восстановить {name}</button>
 {invalid&&<p className="hint">Введите число от 0 до {budget.maximum}.</p>}{notice&&<p role="status">{notice}</p>}
 </form>;
}
