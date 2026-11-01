import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {evaluateStats} from './rules/evaluate.js';

export function resourceBudget(campaign:Campaign,character:Character,key:string){
 const maximum=evaluateStats(campaign.ruleset,character.values).find(row=>row.key===key)?.value;
 if(maximum===undefined||!Number.isFinite(maximum)||maximum<0||maximum>1000000)throw new Error('Максимум ресурса должен быть от 0 до 1000000');
 return {key,maximum,remaining:Math.min(maximum,character.resources[key]??maximum)};
}

export function setResource(campaign:Campaign,characterId:string,key:string,value:number|null):Campaign {
 const character=campaign.characters.find(character=>character.id===characterId);
 if(!character)throw new Error('Персонаж не найден');
 if(key!==campaign.ruleset.healthStat&&key!==campaign.ruleset.movement.budgetStat)throw new Error('Выберите показатель HP или ОД в правилах');
 const budget=resourceBudget(campaign,character,key),remaining=value===null?budget.maximum:value;
 if(!Number.isFinite(remaining)||remaining<0||remaining>budget.maximum)throw new Error(`Остаток должен быть от 0 до ${budget.maximum}`);
 return campaignSchema.parse({...campaign,characters:campaign.characters.map(existing=>existing.id===characterId?{...existing,resources:{...existing.resources,[key]:remaining}}:existing)});
}
