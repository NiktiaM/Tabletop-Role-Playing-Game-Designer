import type {Campaign} from '../shared/campaign.js';
import type {Recovery} from '../shared/encounter.js';
import {effectiveStats} from './effective-stats.js';
import {startEncounter} from './encounter.js';
import {rollDice,type RandomSource} from './dice.js';
export function startAutomaticEncounter(campaign:Campaign,ids:string[],recovery:Recovery,random?:RandomSource):Campaign {
 if(campaign.encounter)throw new Error('Бой уже идёт');
 if(!ids.length||new Set(ids).size!==ids.length)throw new Error('Выберите разных участников боя');
 const key=campaign.ruleset.initiativeStat;if(!key)throw new Error('Выберите характеристику инициативы в правилах');
 const entries=ids.map(id=>{const character=campaign.characters.find(c=>c.id===id);if(!character)throw new Error('Участник не найден');const dex=effectiveStats(campaign,character).find(row=>row.key===key)?.value;if(dex===undefined||!Number.isFinite(dex)||Math.abs(dex)>1000000)throw new Error('Характеристика инициативы должна быть в пределах ±1000000');return {id,name:character.name,modifier:Math.floor((dex-10)/2)};});
 const rolls=entries.map(entry=>rollDice(1,20,entry.modifier,`Инициатива: ${entry.name}`.slice(0,120),random));
 const next=startEncounter(campaign,entries.map((entry,index)=>({characterId:entry.id,initiative:rolls[index].total,roll:rolls[index].rolls[0],modifier:entry.modifier})),recovery,true);
 return {...next,diceRolls:[...campaign.diceRolls,...rolls].slice(-200)};
}
