import type {Campaign,Character} from '../shared/campaign.js';
import {evaluateStats} from './rules/evaluate.js';
export function effectiveStats(c:Campaign,character:Character){
 const mods:Record<string,number>={};
 for(const source of [...c.items.filter(i=>i.ownerId===character.id&&i.equipped&&(!i.template.maxDurability||i.durability>0)).map(i=>i.template.mechanics?.modifiers??{}),...c.effects.filter(e=>e.ownerId===character.id).map(e=>e.modifiers)])for(const [key,value] of Object.entries(source))mods[key]=(mods[key]??0)+value;
 const values={...character.values};for(const stat of c.ruleset.stats)if(stat.kind==='base')values[stat.key]=(values[stat.key]??stat.defaultValue)+(mods[stat.key]??0);
 return evaluateStats(c.ruleset,values).map(row=>{const derived=c.ruleset.stats.find(s=>s.key===row.key)?.kind==='derived',bonus=derived?mods[row.key]??0:0;return {...row,value:Object.keys(mods).length&&[c.ruleset.healthStat,c.ruleset.movement.budgetStat].includes(row.key)?Math.max(0,row.value+bonus):row.value+bonus,explanation:row.explanation+(bonus?` + модификатор ${bonus}`:'')};});
}
