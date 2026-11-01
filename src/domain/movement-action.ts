import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {evaluateStats} from './rules/evaluate.js';
import {reachable,route} from './movement.js';
export function movementBudget(campaign:Campaign,character:Character){
 const key=campaign.ruleset.movement.budgetStat;if(!key)throw new Error('Выберите показатель бюджета движения во вкладке «Правила»');
 const maximum=evaluateStats(campaign.ruleset,character.values).find(row=>row.key===key)?.value;
 if(maximum===undefined||!Number.isFinite(maximum)||maximum<0||maximum>1000000)throw new Error('Максимум бюджета должен быть от 0 до 1000000');
 return {key,maximum,remaining:Math.min(maximum,character.resources[key]??maximum)};
}
export function moveWithPath(campaign:Campaign,tokenId:string,column:number,row:number){
 const token=campaign.tokens.find(token=>token.id===tokenId),map=campaign.maps.find(map=>map.id===token?.mapId),character=campaign.characters.find(character=>character.id===token?.characterId);
 if(!token||!map||!character)throw new Error('Токен не найден');
 if(column===token.column&&row===token.row)return {campaign,cost:0,path:[{column,row}]};
 const budget=movementBudget(campaign,character),result=reachable(map,token,campaign.characters,campaign.tokens,budget.remaining,campaign.ruleset.movement);
 const destination=result.cells.get(`${column},${row}`);if(!destination)throw new Error(result.limited?'Клетка не найдена в пределах расчёта (20000 позиций). Уменьшите бюджет/масштаб или перемещайтесь короткими отрезками.':'Нет допустимого пути в пределах оставшихся ОД');
 const next=campaignSchema.parse({...campaign,tokens:campaign.tokens.map(existing=>existing.id===tokenId?{...existing,column,row}:existing),characters:campaign.characters.map(existing=>existing.id===character.id?{...existing,resources:{...existing.resources,[budget.key]:Math.max(0,budget.remaining-destination.cost)}}:existing)});
 return {campaign:next,cost:destination.cost,path:route(result,{column,row})};
}
