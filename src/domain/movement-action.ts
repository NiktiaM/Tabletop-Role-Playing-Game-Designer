import {freeHands} from './prison-combat.js';
import {battleFor,isPrison,condition,setCondition} from './prison-state.js';
import {terrainAt} from './environment.js';
import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {resourceBudget} from './resources.js';
import {currentActor} from './encounter.js';
import {reachable,route} from './movement.js';
export function movementBudget(campaign:Campaign,character:Character){
 const key=campaign.ruleset.movement.budgetStat;if(!key)throw new Error('Выберите показатель бюджета движения во вкладке «Правила»');
 return resourceBudget(campaign,character,key);
}
export function moveWithPath(campaign:Campaign,tokenId:string,column:number,row:number,spend=true){
 const token=campaign.tokens.find(token=>token.id===tokenId),map=campaign.maps.find(map=>map.id===token?.mapId),character=campaign.characters.find(character=>character.id===token?.characterId);
 if(!token||!map||!character)throw new Error('Токен не найден');
 if(column===token.column&&row===token.row)return {campaign,cost:0,path:[{column,row}]};
 if((!isPrison(campaign)&&campaign.encounter||isPrison(campaign)&&battleFor(campaign,character.id))&&currentActor(campaign)!==character.id)throw new Error('Сейчас ход другого участника боя. Для вмешательства включите расстановку мастера.');
 if(campaign.ruleset.healthStat&&resourceBudget(campaign,character,campaign.ruleset.healthStat).remaining<=0)throw new Error('Нет HP для движения. Используйте расстановку мастера.');
 if(isPrison(campaign)&&condition(campaign,character.id).grappledBy)throw new Error('Сначала освободитесь из захвата');
 spend=isPrison(campaign)?(battleFor(campaign,character.id)?true:campaign.encounter||campaign.otherEncounters.length?false:spend):spend||!!campaign.encounter;
 const budget=spend?movementBudget(campaign,character):{key:'',maximum:1000000,remaining:1000000},result=reachable(map,token,campaign.characters,campaign.tokens,budget.remaining,{...campaign.ruleset.movement,prison:isPrison(campaign),freeHands:freeHands(campaign,character.id),terrain:campaign.gameplay.terrain});
 const destination=result.cells.get(`${column},${row}`);if(!destination)throw new Error(result.limited?'Клетка не найдена в пределах расчёта (20000 позиций). Уменьшите бюджет/масштаб или перемещайтесь короткими отрезками.':(spend?'Нет допустимого пути в пределах оставшихся ОД':'Нет допустимого пути'));
 const path=route(result,{column,row}),damage=path.slice(1).reduce((sum,cell)=>{const t=terrainAt(map,cell,character.footprint);return sum+(t.lava?campaign.gameplay.terrain.lavaDamage:t.acid?campaign.gameplay.terrain.acidDamage:0);},0);
 if(damage&&!campaign.ruleset.healthStat)throw new Error('Для урона опасной жидкости настройте максимум HP');
 const health=damage&&campaign.ruleset.healthStat?resourceBudget(campaign,character,campaign.ruleset.healthStat):null;
 let next=campaignSchema.parse({...campaign,tokens:campaign.tokens.map(existing=>existing.id===tokenId?{...existing,column,row}:existing),characters:campaign.characters.map(existing=>existing.id===character.id&&(spend||health)?{...existing,resources:{...existing.resources,...(spend?{[budget.key]:Math.max(0,budget.remaining-destination.cost)}:{}),...(health?{[health.key]:Math.max(0,health.remaining-damage)}:{})}}:existing)});
 if(isPrison(campaign)){const end=path[path.length-1];let length=0;const dx=end.column-path[path.length-2].column,dy=end.row-path[path.length-2].row;for(let i=path.length-1;i>0;i--){if(path[i].column-path[i-1].column!==dx||path[i].row-path[i-1].row!==dy)break;length+=map.grid.metersPerCell*Math.hypot(dx,dy);}next=setCondition(next,character.id,{runUpMeters:length});}
 return {campaign:next,cost:destination.cost,path,damage};
}
