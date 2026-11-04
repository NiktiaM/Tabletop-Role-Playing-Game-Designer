import type {Campaign} from '../shared/campaign.js';
import type {Recovery} from '../shared/encounter.js';
import {effectiveStats} from './effective-stats.js';
import {joinEncounter,startEncounter} from './encounter.js';
import {rollDice,type RandomSource} from './dice.js';
export function startAutomaticEncounter(campaign:Campaign,ids:string[],recovery:Recovery,random?:RandomSource,surprisedIds:string[]=[]):Campaign {
 if(campaign.encounter&&campaign.gameplay.rulesVersion!=='prison03')throw new Error('Бой уже идёт');
 if(!ids.length||new Set(ids).size!==ids.length)throw new Error('Выберите разных участников боя');
 const entries=ids.map(id=>{const character=campaign.characters.find(c=>c.id===id);if(!character)throw new Error('Участник не найден');return {id,name:character.name,modifier:initiativeModifier(initiativeDexterity(campaign,character))};});
 const rolls=entries.map(entry=>rollDice(1,20,entry.modifier,`Инициатива: ${entry.name}`.slice(0,120),random));
 const participants=entries.map((entry,index)=>({characterId:entry.id,...(campaign.gameplay.rulesVersion==='prison03'?{surprised:surprisedIds.includes(entry.id)}:{}),initiative:rolls[index].total,roll:rolls[index].rolls[0],modifier:entry.modifier,tieBreaker:0}));
 // A lottery for exact ties prevents selection order from giving the first participant an advantage.
 const groups=new Map<string,number[]>();for(let i=0;i<participants.length;i++){const ch=campaign.characters.find(ch=>ch.id===participants[i].characterId)!;const key=`${participants[i].initiative}:${initiativeDexterity(campaign,ch)}`;groups.set(key,[...(groups.get(key)??[]),i]);}
 for(const group of groups.values()){const pool=[...group];let rank=pool.length;while(pool.length>1){const t=rollDice(1,pool.length,0,'Жребий при равной инициативе и Ловкости',random);rolls.push(t);const [winner]=pool.splice(t.total-1,1);participants[winner].tieBreaker=rank--;}}
 const next=startEncounter(campaign,participants,recovery,true);
 return {...next,diceRolls:[...campaign.diceRolls,...rolls].slice(-200)};
}

/** Roll once when a late participant joins; switching battles never calls this. */
export function joinAutomaticEncounter(campaign:Campaign,characterId:string,random?:RandomSource):Campaign {
 const character=campaign.characters.find(ch=>ch.id===characterId);
 if(!character)throw new Error('Участник не найден');
 const roll=rollDice(1,20,initiativeModifier(initiativeDexterity(campaign,character)),`Инициатива: ${character.name}`.slice(0,120),random);
 const next=joinEncounter(campaign,characterId,roll.total);
 return {...next,diceRolls:[...next.diceRolls,roll].slice(-200)};
}

export function initiativeModifier(dexterity:number){if(!Number.isFinite(dexterity)||Math.abs(dexterity)>1000000)throw new Error('Проверьте Ловкость персонажа');return Math.floor((dexterity-10)/2);}
function initiativeDexterity(c:Campaign,ch:Campaign['characters'][number]){const rows=effectiveStats(c,ch),keys=c.gameplay.rulesVersion==='prison03'?['dexterity']:[c.ruleset.initiativeStat,c.gameplay.dexterityStat,'dexterity'];for(const key of keys){if(!key)continue;const n=rows.find(r=>r.key===key)?.value??ch.values[key];if(n!==undefined)return n;}return 5;}
