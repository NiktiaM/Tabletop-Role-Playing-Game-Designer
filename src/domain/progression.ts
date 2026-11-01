import type {Character} from '../shared/campaign.js';
import type {Ruleset} from '../shared/rules.js';
import {evaluateStats} from './rules/evaluate.js';
import {parseFormula,evaluateFormula} from './rules/formula.js';

export function characterLevel(character:Character,rules:Ruleset):number {
 if(rules.stats.some(stat=>stat.key==='level'))return evaluateStats(rules,character.values).find(stat=>stat.key==='level')!.value;
 return character.values.level??1;
}
export function npcExperience(character:Character,rules:Ruleset):number {
 if(character.kind!=='npc')return 0;
 const level=characterLevel(character,rules);
 if(!Number.isInteger(level)||level<1||level>1000)throw new Error('Для награды опыта нужен уровень NPC от 1 до 1000');
 const value=evaluateFormula(parseFormula(rules.npcXpFormula),key=>{if(key!=='level')throw new Error('Неизвестная переменная опыта');return level;});
 if(!Number.isInteger(value)||value<0||value>1000000000)throw new Error('Награда опыта должна быть целым числом от 0 до 1000000000');
 return value;
}
