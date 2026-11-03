import type {Campaign,Character} from '../shared/campaign.js';
import {evaluateStats} from './rules/evaluate.js';
export function effectiveStats(c:Campaign,character:Character){
 const mods:Record<string,number>={};
 for(const source of [...c.items.filter(i=>i.ownerId===character.id&&i.equipped&&(!i.template.maxDurability||i.durability>0)).map(i=>i.template.mechanics?.modifiers??{}),...c.effects.filter(e=>e.ownerId===character.id).map(e=>e.modifiers)])for(const [key,value] of Object.entries(source))mods[key]=(mods[key]??0)+value;
 const values={...character.values};
 if(c.gameplay.rulesVersion==='prison03'){const worn=c.items.filter(i=>i.ownerId===character.id&&i.equipped&&i.template.category==='armor'&&(!i.template.maxDurability||i.durability>0)).map(i=>i.template.mechanics?.armorValue??i.template.mechanics?.modifiers.armor??0);values.armor=Math.max(character.values.armor??0,character.prisonProfile?.background==='skin'?1:0,...worn);delete mods.armor;}for(const stat of c.ruleset.stats)if(stat.kind==='base')values[stat.key]=(values[stat.key]??stat.defaultValue)+(mods[stat.key]??0);
 return evaluateStats(c.ruleset,values).map(row=>{const derived=c.ruleset.stats.find(s=>s.key===row.key)?.kind==='derived',bonus=derived?mods[row.key]??0:0;return {...row,value:c.gameplay.rulesVersion==='prison03'&&row.key===c.ruleset.healthStat&&character.prisonProfile?.npcMaxHP!==undefined?character.prisonProfile.npcMaxHP:Object.keys(mods).length&&[c.ruleset.healthStat,c.ruleset.movement.budgetStat].includes(row.key)?Math.max(0,row.value+bonus):row.value+bonus,explanation:row.explanation+(bonus?` + модификатор ${bonus}`:'')};});
}
