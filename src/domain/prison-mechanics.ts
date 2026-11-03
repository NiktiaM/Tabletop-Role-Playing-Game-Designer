import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {mechanicsSchema} from '../shared/mechanics.js';
import {type RandomSource,rollDice} from './dice.js';
import {requireReach,treat} from './prison-actions.js';
import {spendAP,health,hpChange,notice,battleFor} from './prison-state.js';
import {dice} from './prison-combat.js';
export function usePrisonItem(c:Campaign,id:string,targetId:string,random?:RandomSource):Campaign {
 const item=c.items.find(i=>i.id===id&&i.ownerId);if(!item?.ownerId)throw new Error('Предмет не в инвентаре');if(item.template.mechanics?.treatment)return treat(c,id,targetId);
 if(item.template.category!=='consumable'||!item.template.mechanics)throw new Error('У этого предмета нет действия применения');
 if(item.template.maxCharges&&item.charges<=0)throw new Error('Заряды закончились');
 const next=apply(c,item.ownerId,targetId,item.template.mechanics,item.template.name,random);
 return campaignSchema.parse({...next,items:next.items.flatMap(i=>i.id!==id?[i]:i.template.maxCharges>1?[{...i,charges:i.charges-1}]:[])});
}
export function usePrisonAbility(c:Campaign,id:string,targetId:string,random?:RandomSource):Campaign {const a=c.abilities.find(a=>a.id===id);if(!a||!a.definition.mechanics)throw new Error('Нет настроенного действия способности');if(a.definition.maxUses&&a.usesRemaining<=0)throw new Error('Использования закончились');const next=apply(c,a.ownerId,targetId,a.definition.mechanics,a.definition.name,random);return campaignSchema.parse({...next,abilities:next.abilities.map(row=>row.id===id&&row.definition.maxUses?{...row,usesRemaining:row.usesRemaining-1}:row)});}
function apply(c:Campaign,actor:string,target:string,raw:unknown,label:string,random?:RandomSource):Campaign {
 const m=mechanicsSchema.parse(raw);requireReach(c,actor,target,m.rangeMeters);if(health(c,actor).remaining<=m.hpCost)throw new Error('Недостаточно здоровья для действия');if(Object.keys(m.modifiers).some(key=>!c.ruleset.stats.some(s=>s.key===key)))throw new Error('Неизвестная характеристика эффекта');
 let next=spendAP(c,actor,m.apCost);next=hpChange(next,actor,-m.hpCost);
 const spec=m.dice?dice(m.dice):null,r=spec?rollDice(spec.count,spec.sides,spec.modifier,label,random):null,delta=m.hpChange+(r?.total??0)*(m.harmful?-1:1);
 if(delta>0&&health(c,target).remaining===0)throw new Error('При 0HP используйте подъём союзником или лазарет');
 next=hpChange(next,target,delta);
 if(Object.keys(m.modifiers).length||m.periodicHP)next={...next,effects:[...next.effects,{id:crypto.randomUUID(),ownerId:target,name:label,modifiers:m.modifiers,remainingTurns:m.durationTurns,periodicHP:m.periodicHP,encounterId:battleFor(c,target)?.id??null}]};
 if(r)next={...next,diceRolls:[...next.diceRolls,r].slice(-200)};
 return notice(next,`${label}: изменениеHP ${delta}, ОД −${m.apCost} в бою.`);
}
