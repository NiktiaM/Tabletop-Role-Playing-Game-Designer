import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {characterBundleSchema,type CharacterBundle} from '../shared/transfer.js';
import {parseFormula} from './rules/formula.js';
import type {Ruleset} from '../shared/rules.js';
function signature(rules:Ruleset){return JSON.stringify([...rules.stats].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(stat=>stat.kind==='base'?{key:stat.key,kind:stat.kind,value:stat.defaultValue}:{key:stat.key,kind:stat.kind,formula:parseFormula(stat.formula)}));}
export function checkCompatibility(target:Ruleset,source:Ruleset):void {
 if(target.engineVersion!==source.engineVersion||signature(target)!==signature(source)||JSON.stringify(target.movement)!==JSON.stringify(source.movement))throw new Error('Правила несовместимы: должны совпадать ключи, исходные значения по умолчанию формулы показателей и настройки движения. Названия и номера ревизий могут отличаться. Правила партии не будут заменены.');
}
export function exportCharacter(campaign:Campaign,id:string):CharacterBundle {
 const character=campaign.characters.find(character=>character.id===id);if(!character)throw new Error('Персонаж не найден');
 return characterBundleSchema.parse({format:'rprison-character',version:1,rules:campaign.ruleset,character,items:campaign.items.filter(item=>item.ownerId===id),abilities:campaign.abilities.filter(ability=>ability.ownerId===id)});
}
export function importCharacter(campaign:Campaign,input:CharacterBundle):Campaign {
 const pack=characterBundleSchema.parse(input);checkCompatibility(campaign.ruleset,pack.rules);
 const id=crypto.randomUUID(),character={...pack.character,id};
 const result=campaignSchema.safeParse({...campaign,characters:[...campaign.characters,character],items:[...campaign.items,...pack.items.map(item=>({...item,id:crypto.randomUUID(),ownerId:id,template:{...item.template,id:crypto.randomUUID()}}))],abilities:[...campaign.abilities,...pack.abilities.map(ability=>({...ability,id:crypto.randomUUID(),ownerId:id,definition:{...ability.definition,id:crypto.randomUUID()}}))]});
 if(!result.success)throw new Error('Нельзя добавить персонажа: проверьте пределы партии (200 персонажей, 1000 предметов и способностей).');return result.data;
}
