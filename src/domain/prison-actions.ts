import {stepAllowed} from './movement.js';
import {advanceCraftTime} from './prison-catalog.js';
import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {type RandomSource,rollDice} from './dice.js';
import {tokenGeometry,sight} from './environment.js';
import {resourceBudget} from './resources.js';
import {health,hpChange,condition,setCondition,spendAP,battleFor,consumeReaction,bonus,stat,notice,advanceTime} from './prison-state.js';
import {getWeapon,dropWeapon,freeHands} from './prison-combat.js';
export function requireReach(c:Campaign,actorId:string,targetId:string,range=1.5){
 if(actorId===targetId)return;
 const pairs=c.tokens.filter(t=>t.characterId===actorId&&t.mapId===c.view.activeMapId).flatMap(a=>c.tokens.filter(t=>t.characterId===targetId&&t.mapId===a.mapId).map(b=>tokenGeometry(c,a,b)));
 if(!pairs.some(p=>p.distance<=range+1e-7&&sight(p.map,p.a,p.b)))throw new Error('Цель недоступна: расстояние, стена или другое поле');
}
export function raiseAlly(c:Campaign,actorId:string,targetId:string,master=false):Campaign {
 const battle=battleFor(c,targetId),h=health(c,targetId);
 if(h.remaining!==0)throw new Error('Подъём применяется к 0 HP');
 if(!master){if(actorId===targetId)throw new Error('Самоподъём без сознания невозможен');if(!battle||battleFor(c,actorId)?.id!==battle.id)throw new Error('Подъём доступен союзникам в одном бою');if(condition(c,targetId).raisedIn.includes(battle.id))throw new Error('Этот персонаж уже был поднят в текущем бою');requireReach(c,actorId,targetId);if(freeHands(c,actorId)<1)throw new Error('Освободите руку для помощи');}
 let next=master?c:spendAP(c,actorId,3);next=hpChange(next,targetId,Math.ceil(.2*h.maximum));
 if(master)next=setCondition(next,targetId,{hospitalUntil:null});
 if(battle)next=setCondition(next,targetId,{raisedIn:[...new Set([...condition(next,targetId).raisedIn,battle.id])]});
 return campaignSchema.parse(notice(next,`${master?'Мастер: подъём сверх ограничений':'Помощь за 3 ОД'} → ${c.characters.find(ch=>ch.id===targetId)!.name}, ${Math.ceil(.2*h.maximum)} HP. Кровотечение не снято.`));
}
export function hospital(c:Campaign,id:string):Campaign {
 if(battleFor(c,id))throw new Error('Сначала выведите персонажа из боя');if(health(c,id).remaining!==0)throw new Error('Лазарет после поражения применяется к 0 HP');
 return campaignSchema.parse(notice(setCondition(c,id,{hospitalUntil:c.prison.seconds+3600,bleeding:false,bleedSeconds:0,stunned:false,grappledBy:null}),'Лазарет: возвращение через один игровой час с 20% HP.'));
}
export function sleep(c:Campaign,ids:string[]):Campaign {
 if(!ids.length||ids.some(id=>battleFor(c,id)||condition(c,id).bleeding||health(c,id).remaining<=0))throw new Error('Нужны персонажи вне боя, без крови и с положительными HP');
 let next=advanceCraftTime(c,8*3600);for(const id of ids){const h=health(next,id);next=hpChange(next,id,h.maximum-h.remaining);next=setCondition(next,id,{foodDay:-1});}
 return campaignSchema.parse(notice(next,'Полноценный сон: 8 часов, здоровье восстановлено.'));
}
export function treat(c:Campaign,itemId:string,targetId:string):Campaign {
 const item=c.items.find(i=>i.id===itemId&&i.ownerId),type=item?.template.mechanics?.treatment;
 if(!item?.ownerId||!type)throw new Error('Выберите лечебный предмет');
 if(item.template.maxCharges&&item.charges<=0)throw new Error('Заряды закончились');requireReach(c,item.ownerId,targetId);
 if(freeHands(c,item.ownerId)<1)throw new Error('Освободите руку для лечения');
 if(type==='food'&&(condition(c,targetId).bleeding||condition(c,targetId).foodDay===1||health(c,targetId).remaining<=0))throw new Error('Еда не лечит при крови, на 0 HP и повторно до полноценного сна');
 let next=spendAP(c,item.ownerId,3);
 if(type!=='food')next=setCondition(next,targetId,{bleeding:false,bleedSeconds:0});else next=setCondition(next,targetId,{foodDay:1});
 const delta=type==='kit'?8:type==='improvised'?4:type==='food'?2:0;
 if(health(next,targetId).remaining>0)next=hpChange(next,targetId,delta);
 next={...next,items:next.items.flatMap(i=>i.id!==itemId?[i]:i.template.maxCharges>1?[{...i,charges:i.charges-1}]:[])};
 return campaignSchema.parse(notice(next,`${item.template.name}: помощь ${c.characters.find(ch=>ch.id===targetId)!.name}; предмет/заряд потрачен, ОД −3 в бою.`));
}
export type Maneuver='grab'|'escape'|'push'|'disarm'|'intercept';
export function maneuver(c:Campaign,actorId:string,targetId:string,type:Maneuver,approach:'strength'|'dexterity'='strength',random?:RandomSource):Campaign {
 if(actorId===targetId)throw new Error('Нужны разные участники');
 const b=battleFor(c,actorId);if(!b||battleFor(c,targetId)?.id!==b.id||c.encounter?.id!==b.id)throw new Error('Нужны участники выбранного боя');
 if(health(c,actorId).remaining<=0||health(c,targetId).remaining<=0)throw new Error('Манёвр требует участников в сознании');requireReach(c,actorId,targetId);
 const st=condition(c,actorId),key=`${type}:${targetId}`;if(st.maneuvers.includes(key)&&type!=='intercept')throw new Error('Одна такая попытка по этой цели за ход');
 if(type==='escape'&&st.grappledBy!==targetId)throw new Error('Этот персонаж вас не удерживает');
 let next=type==='intercept'?consumeReaction(c,actorId):spendAP(c,actorId,2);
 const a=c.characters.find(ch=>ch.id===actorId)!,t=c.characters.find(ch=>ch.id===targetId)!;
 const attackKey=type==='grab'||type==='push'||type==='intercept'?'strength':approach;
 const defense=type==='escape'?bonus(stat(c,t,'strength')):Math.max(bonus(stat(c,t,'strength')),bonus(stat(c,t,'dexterity')));
 const ar=rollDice(2,12,0,'Манёвр',random),dr=rollDice(2,12,0,'Противодействие',random),penalty=type==='intercept'?0:[0,3,6][Math.min(st.attacks,2)];
 const total=ar.total+bonus(stat(c,a,attackKey))-penalty,against=dr.total+defense,success=total>against;
 if(type!=='intercept')next=setCondition(next,actorId,{maneuvers:[...st.maneuvers,key]});
 if(success){
  if(type==='grab'||type==='intercept')next=setCondition(next,targetId,{grappledBy:actorId});
  if(type==='escape')next=setCondition(next,actorId,{grappledBy:null});
  if(type==='push'){const token=next.tokens.find(t=>t.characterId===targetId&&t.mapId===next.view.activeMapId),from=next.tokens.find(t=>t.characterId===actorId&&t.mapId===next.view.activeMapId),map=next.maps.find(m=>m.id===token?.mapId);if(token&&from&&map){const dx=token.column-from.column,dy=token.row-from.row,step=Math.abs(dx)>=Math.abs(dy)?{x:Math.sign(dx)||1,y:0}:{x:0,y:Math.sign(dy)||1};let cell={column:token.column,row:token.row};for(let n=0;n<Math.floor(1/map.grid.metersPerCell);n++){const to={column:cell.column+step.x,row:cell.row+step.y};if(!stepAllowed(map,cell,to,t,token,next.tokens,next.characters,true))break;cell=to;}next={...next,tokens:next.tokens.map(row=>row.id===token.id?{...row,...cell}:row)};}}
  if(type==='disarm'){const weapon=c.items.find(i=>i.ownerId===targetId&&i.equipped&&i.template.category==='weapon');if(!weapon)throw new Error('У цели нет удерживаемого оружия');next=dropWeapon(next,weapon.id,targetId);}
 }
 next={...next,diceRolls:[...next.diceRolls,ar,dr].slice(-200)};
 return campaignSchema.parse(notice(next,`Манёвр ${type}: ${total} против ${against} — ${success?'успех':'без изменения'}.${success&&type==='push'?' Цель сдвинута на доступное расстояние до 1 метра с учётом сетки и препятствий.':''}`));
}
export function switchWeapon(c:Campaign,id:string,itemId:string):Campaign {const item=c.items.find(i=>i.id===itemId&&i.ownerId===id&&i.template.category==='weapon');if(!item)throw new Error('Оружие не в инвентаре');const next=spendAP(c,id,2);return campaignSchema.parse(notice({...next,items:next.items.map(i=>i.ownerId===id&&(i.template.category==='weapon'||i.template.mechanics?.hands)?{...i,equipped:i.id===itemId}:i)},'Оружие сменено за 2 ОД.'));}
export function manualAction(c:Campaign,id:string,cost:number,label:string):Campaign {if(!label.trim()||label.length>200)throw new Error('Опишите действие');return campaignSchema.parse(notice(spendAP(c,id,cost),`${label}: ОД −${cost} в бою.`));}

export function stowWeapons(c:Campaign,id:string):Campaign {const next=spendAP(c,id,2);return campaignSchema.parse(notice({...next,items:next.items.map(i=>i.ownerId===id&&(i.template.category==='weapon'||i.template.mechanics?.hands)?{...i,equipped:false}:i)},'Оружие и удерживаемые инструменты убраны за2ОД.'));}
