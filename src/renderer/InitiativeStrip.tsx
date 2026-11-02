import React from 'react';
import type {Campaign} from '../shared/campaign.js';
import {currentActor,nextTurn,endEncounter} from '../domain/encounter.js';
import {resourceBudget} from '../domain/resources.js';
export function InitiativeStrip({campaign,onChange,onCharacter}:{campaign:Campaign;onChange:(next:Campaign,message:string)=>boolean;onCharacter:(id:string)=>void}){
 const battle=campaign.encounter;if(!battle)return null;
 const act=(fn:()=>Campaign,message:string)=>{try{onChange(fn(),message);}catch(e){window.alert(e instanceof Error?e.message:'Действие отклонено');}};
 return <section className="initiative-strip" aria-label="Очередь над картой"><strong>Раунд {battle.round}</strong><div className="initiative-portraits">{battle.participants.map((p,index)=>{const ch=campaign.characters.find(c=>c.id===p.characterId)!;let remaining='',fallen=false;try{if(campaign.ruleset.healthStat){const hp=resourceBudget(campaign,ch,campaign.ruleset.healthStat).remaining;remaining=`HP ${hp}`;fallen=hp<=0;}}catch{}return <button aria-label={`Ход: ${ch.name}`} title={`${index+1}. ${ch.name} · инициатива ${p.initiative} · ${remaining}`} key={p.characterId} className={`${currentActor(campaign)===ch.id?'active-turn':''}${fallen?' defeated-turn':''}`} onClick={()=>onCharacter(ch.id)}>{ch.portrait?<img src={ch.portrait} alt=""/>:<span>{ch.name.slice(0,1)}</span>}<small>{ch.name}</small><b>{p.initiative}</b></button>;})}</div><button disabled={!!campaign.pendingAttack} onClick={()=>act(()=>nextTurn(campaign),'Ход закончен.')}>Закончить ход</button><button onClick={()=>{if(window.confirm('Закончить бой? HP/ОД и вещи сохранятся, эффекты боя завершатся.'))act(()=>endEncounter(campaign),'Бой закончен.');}}>Закончить бой</button></section>;
}
