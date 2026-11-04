import React from 'react';
import type {Campaign} from '../shared/campaign.js';
import {battles} from '../domain/prison-state.js';
import {currentActor,selectEncounter} from '../domain/encounter.js';
import {resourceBudget} from '../domain/resources.js';
export function PlayStatus({campaign:c,setupMode,onBattle,onChange,onExitSetup}:{campaign:Campaign;setupMode:boolean;onExitSetup:()=>void;onBattle:()=>void;onChange:(c:Campaign,message:string)=>boolean}){
 const all=battles(c),b=c.encounter,ch=c.characters.find(ch=>ch.id===currentActor(c));let ap='';if(ch&&b)try{ap=`${Number(resourceBudget(c,ch,b.apStat).remaining.toFixed(2))} ОД`;}catch{}
 return <section className={`play-status ${setupMode?'master-mode':b?'combat-mode':'exploration-mode'}`} aria-label="Текущий режим игры">
 <div className="play-status-title"><strong>{setupMode?'РАССТАНОВКА МАСТЕРА':b?'БОЙ АКТИВЕН':'СВОБОДНОЕ ИССЛЕДОВАНИЕ'}</strong><span>{setupMode?'Перемещение вручную, без пути и ОД.':b?`${b.name??'Бой'} · Раунд ${b.round} · Ход: ${ch?.name??'—'} · ${ap}`:'Боя нет. Движение без лимита ОД, с учётом стен и препятствий.'}</span></div>
 <div className="play-status-actions">{setupMode&&<button onClick={onExitSetup}>Закончить расстановку</button>}{all.length>1&&<label>Выбранный бой<select aria-label="Выбранный бой" disabled={!!c.pendingAttack} value={b?.id??''} onChange={e=>{try{onChange(selectEncounter(c,e.target.value),'Бой выбран; ресурсы сохранены.');}catch(error){window.alert(error instanceof Error?error.message:'Не удалось выбрать бой');}}}>{all.map(x=><option key={x.id} value={x.id}>{x.name??'Бой'} · раунд {x.round}</option>)}</select></label>}<button onClick={onBattle}>{b?'Управление боями':'Начать бой'}</button></div>
 </section>;
}
