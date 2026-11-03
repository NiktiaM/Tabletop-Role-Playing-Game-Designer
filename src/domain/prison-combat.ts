import {barriersOnLine,barrierImpact,damageBarrier} from './prison-barriers.js';
import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {attackInputSchema,type AttackInput} from '../shared/gameplay.js';
import {itemTemplateSchema,type ItemInstance} from '../shared/items.js';
import {type DiceRoll} from '../shared/dice.js';
import {type RandomSource,rollDice} from './dice.js';
import {tokenGeometry,sight} from './environment.js';
import {resourceBudget} from './resources.js';
import {bonus,stat,health,hpChange,condition,setCondition,battleFor,reactionAvailable,consumeReaction,spendAP,notice} from './prison-state.js';
export const UNARMED='00000000-0000-4000-8000-000000000001';
export function fists(ownerId:string):ItemInstance {return {id:UNARMED,ownerId,ground:null,equipped:true,durability:0,charges:0,template:itemTemplateSchema.parse({id:UNARMED,revision:1,name:'Кулаки',category:'weapon',description:'Быстрый удар раз за ход.',damageDice:'1d4',maxDurability:0,maxCharges:0,mechanics:{attackType:'melee',rangeMeters:1.5,apCost:2,hands:'one'}})};}
export function dice(text:string){const m=/^(\d+)d(\d+)([+-]\d+)?$/.exec(text);if(!m)throw new Error('Неверные кости оружия');return {count:Number(m[1]),sides:Number(m[2]),modifier:Number(m[3]??0)};}
export function getWeapon(c:Campaign,id:string,ownerId:string,allowEmpty=false):ItemInstance {
 if(id===UNARMED)return fists(ownerId);
 const item=c.items.find(i=>i.id===id&&i.ownerId===ownerId&&i.equipped&&i.template.category==='weapon');
 if(!item?.template.damageDice)throw new Error('Выберите экипированное оружие');
 if(item.template.maxDurability&&item.durability<=0)throw new Error('Оружие сломано');
 if(!allowEmpty&&item.template.maxCharges&&item.charges<=0)throw new Error('Нужна перезарядка');return item;
}
export const freeHands=(c:Campaign,id:string)=>Math.max(0,2-c.items.filter(i=>i.ownerId===id&&i.equipped&&(i.template.category==='weapon'||i.template.mechanics?.hands)).reduce((n,i)=>n+(i.template.mechanics?.hands==='two'?2:1),0));
function context(c:Campaign,input:AttackInput){
 const aToken=c.tokens.find(t=>t.id===input.actorTokenId),tToken=c.tokens.find(t=>t.id===input.targetTokenId);
 if(!aToken||!tToken||aToken.characterId===tToken.characterId)throw new Error('Нужны разные участники');
 const actor=c.characters.find(ch=>ch.id===aToken.characterId)!,target=c.characters.find(ch=>ch.id===tToken.characterId)!;
 const battle=c.encounter;if(!battle||battle.participants[battle.turnIndex].characterId!==actor.id||!battle.participants.some(p=>p.characterId===target.id))throw new Error('Выберите бой, текущего участника и цель из этого боя');
 if(aToken.mapId!==c.view.activeMapId)throw new Error('Откройте поле атакующего');
 if(health(c,actor.id).remaining<=0||health(c,target.id).remaining<=0)throw new Error('Нельзя атаковать без сознания или выбирать цель с 0 HP');
 const item=getWeapon(c,input.weaponId,actor.id),m=item.template.mechanics!,mode=m.attackType;
 if(mode!==input.mode)throw new Error('Тип атаки не совпадает с оружием');
 const geometry=tokenGeometry(c,aToken,tToken);
 if(!geometry.visible&&!input.throughBarrier)throw new Error('Цель не видна');
 if(input.throughBarrier&&mode!=='ranged')throw new Error('Прострел доступен дальнему оружию');
 if(geometry.distance>(m.rangeMeters??1.5)+1e-7)throw new Error('Вне предельной дальности');
 const variant=input.variant??'normal',state=condition(c,actor.id);
 if(variant==='quick'&&(item.id!==UNARMED||state.quickUsed||freeHands(c,actor.id)<1))throw new Error('Быстрый кулак требует свободной руки и доступен раз за ход');
 if(item.id===UNARMED&&freeHands(c,actor.id)<1)throw new Error('Для кулака освободите руку');
 if((variant==='strong'||variant==='stun')&&mode!=='melee')throw new Error('Приём доступен только в ближнем бою');
 if(variant==='stun'&&!m.stunCapable)throw new Error('Оружие не подходит для оглушающего удара');
 if(variant==='stun'&&state.maneuvers.includes(`stun:${target.id}`))throw new Error('Одна попытка оглушающего удара по этой цели за ход');
 const cost=variant==='quick'?1:(m.apCost||2)+(variant==='strong'||variant==='stun'?2:0);
 spendAP(c,actor.id,cost);
 if(mode==='ranged'&&input.reaction!=='none'&&input.reaction!=='disarm')throw new Error('Обычная защита от пули не бросается');
 if(input.reaction==='disarm'&&(mode!=='ranged'||geometry.distance>1.5||freeHands(c,target.id)<1||!reactionAvailable(c,target.id)))throw new Error('Для выбивания ствола нужны свободная рука, дистанция до 1,5 м и специальная реакция');
 if(input.reaction==='counter'&&!reactionAvailable(c,target.id))throw new Error('Специальная реакция недоступна');
 const counter=input.reaction==='counter'?(c.items.find(i=>i.ownerId===target.id&&i.equipped&&i.template.category==='weapon'&&i.template.mechanics?.attackType==='melee'&&(!i.template.maxDurability||i.durability>0))??fists(target.id)):null;
 if(counter?.id===UNARMED&&freeHands(c,target.id)<1)throw new Error('Для контратаки кулаком освободите руку');
 if(counter&&geometry.distance>(counter.template.mechanics?.rangeMeters??1.5))throw new Error('Оружие контратаки не достаёт');
 if(input.reaction==='block'&&m.bleeding&&!c.items.some(i=>i.ownerId===target.id&&i.equipped&&i.template.category==='weapon'&&i.template.mechanics?.attackType==='melee'))throw new Error('Нельзя безопасно блокировать режущее оружие голыми руками');
 return {actor,target,item,m,mode,geometry,variant,state,cost,counter,battle};
}
export function combatStamp(c:Campaign){const source=JSON.stringify({rules:c.ruleset,gameplay:c.gameplay,characters:c.characters.map(({portrait,...ch})=>ch),items:c.items.map(({template,...i})=>({...i,template:{...template,image:null}})),effects:c.effects,prison:c.prison,encounter:c.encounter,others:c.otherEncounters,tokens:c.tokens,maps:c.maps.map(({image,...m})=>m),active:c.view.activeMapId});let a=2166136261,b=5381;for(let i=0;i<source.length;i++){a=Math.imul(a^source.charCodeAt(i),16777619);b=Math.imul(b,33)^source.charCodeAt(i);}return `${a>>>0}-${b>>>0}`;}
function rollSpec(c:Campaign,input:AttackInput){const x=context(c,input),specs=[{count:2,sides:12,modifier:0,label:'Атака'}];if(input.rollMode&&input.rollMode!=='normal')specs.push({count:2,sides:12,modifier:0,label:'Атака: второй бросок'});if(x.mode==='melee'||input.reaction==='disarm')specs.push({count:2,sides:12,modifier:0,label:'Защита'});const d=dice(x.item.template.damageDice!);specs.push({...d,count:d.count+(x.variant==='strong'?1:0),label:'Урон'});if(x.counter)specs.push({...dice(x.counter.template.damageDice!),label:'Контратака'});if(x.variant==='stun')specs.push({count:2,sides:12,modifier:0,label:'Сопротивление оглушению'});return {x,specs};}
export function calculatePrisonAttack(c:Campaign,input:AttackInput,rolls:DiceRoll[]){
 const {x,specs}=rollSpec(c,input);if(rolls.length!==specs.length||rolls.some((r,i)=>r.count!==specs[i].count||r.sides!==specs[i].sides||r.modifier!==specs[i].modifier))throw new Error('Кости не соответствуют действию');
 let ix=0,attackRoll=rolls[ix++].total;if(input.rollMode&&input.rollMode!=='normal'){const other=rolls[ix++].total;attackRoll=input.rollMode==='advantage'?Math.max(attackRoll,other):Math.min(attackRoll,other);}
 const defenseRoll=x.mode==='melee'||input.reaction==='disarm'?rolls[ix++].total:0,damageRoll=rolls[ix++].total,counterRoll=x.counter?rolls[ix++].total:0,stunRoll=x.variant==='stun'?rolls[ix++].total:0;
 const strength=bonus(stat(c,x.actor,c.gameplay.strengthStat)),dex=bonus(stat(c,x.actor,c.gameplay.dexterityStat)),defStr=bonus(stat(c,x.target,c.gameplay.strengthStat)),defDex=bonus(stat(c,x.target,c.gameplay.dexterityStat));
 const range=x.m.normalRange??x.m.rangeMeters,dist=x.geometry.distance,distancePenalty=x.mode==='ranged'?(dist<=range/2?0:dist<=range?2:dist<=2*range?4:6):0;
 const repeatPenalty=[0,3,6][Math.min(x.state.attacks,2)],high=x.mode==='ranged'&&x.geometry.high>=2?2:0,aim=x.mode==='ranged'&&x.state.aim?2:0,veteran=x.mode==='ranged'&&x.actor.prisonProfile?.background==='veteran'?1:0;
 const attack=attackRoll+(x.mode==='melee'?strength:dex)-repeatPenalty-distancePenalty+high+aim+veteran+(input.modifier??0);
 let defense=13+defDex+x.geometry.cover;
 if(x.mode==='melee')defense=defenseRoll+(input.reaction==='counter'?defStr-2:input.reaction==='block'?defStr:defDex+2);
 if(input.reaction==='disarm')defense=defenseRoll+Math.max(defStr,defDex)-4;
 const intercepted=input.reaction==='disarm'&&defense>attack;
 const hit=input.reaction==='disarm'?!intercepted:x.mode==='ranged'?attack>=defense:attack>defense;
 const tie=x.mode==='melee'&&attack===defense,rawDamage=damageRoll+(x.variant==='quick'?0:x.mode==='melee'?strength:dex),reduced=x.variant==='stun'?Math.floor(rawDamage/2):rawDamage;
 const armor=Math.max(0,stat(c,x.target,c.gameplay.armorStat)-(x.variant==='strong'?2:0)),block=input.reaction==='block'?2:0;
 const line=barriersOnLine(x.geometry.map,x.geometry.a,x.geometry.b),barrierHits:{id:string;damage:number}[]=[];let residual=reduced;
 if(x.mode==='ranged'){if(hit&&input.throughBarrier){for(const z of line.filter(z=>z.kind==='wall')){const impact=barrierImpact(z,residual,x.m.penetration??0);barrierHits.push({id:z.id,damage:impact.damage});residual=impact.remaining;}}else if(!hit&&line[0]){const impact=barrierImpact(line[0],reduced,x.m.penetration??0);barrierHits.push({id:line[0].id,damage:impact.damage});}}
 const damage=hit?Math.max(0,residual-armor-block):0;
 const counterTriggered=!!x.counter&&defense>attack;
 const counterDamage=counterTriggered?Math.max(0,Math.floor((counterRoll+defStr)/2)-stat(c,x.actor,c.gameplay.armorStat)):0;
 const stunned=hit&&x.variant==='stun'&&stunRoll+stat(c,x.target,'constitution')<=16;
 const bleeding=hit&&damage>0&&!!x.m.bleeding&&attack-defense>=5;
 const aHP=health(c,x.actor.id),tHP=health(c,x.target.id),text=`${x.actor.name} → ${x.target.name}: атака ${attack}, защита ${defense}. ${intercepted?'Выстрел прерван, оружие выбито':tie?'Равенство: попадания и контратаки нет':hit?'Попадание':'Промах'}. Урон ${damage}${counterTriggered?`, ответ ${counterDamage}`:''}. ОД −${x.cost}; штраф атак −${repeatPenalty}${distancePenalty?`, дистанция −${distancePenalty}`:''}${aim?`, прицел +${aim}`:''}${high?`, высота +${high}`:''}${bleeding?'. Кровотечение':''}${stunned?'. Оглушение':''}.`;
 return {...x,attack,defense,hit,tie,damage,counterDamage,counterTriggered,stunned,bleeding,intercepted,aHP,tHP,text,rawDamage:reduced,armor,block,barrierHits};
}
export function previewPrisonAttack(c:Campaign,raw:AttackInput,random?:RandomSource):Campaign {
 if(c.pendingAttack)throw new Error('Сначала завершите текущий расчёт');const input=attackInputSchema.parse(raw),{specs}=rollSpec(c,input);
 const rolls=specs.map(s=>rollDice(s.count,s.sides,s.modifier,s.label,random));calculatePrisonAttack(c,input,rolls);
 return campaignSchema.parse({...c,diceRolls:[...c.diceRolls,...rolls].slice(-200),pendingAttack:{id:crypto.randomUUID(),stamp:combatStamp(c),input,rolls}});
}
export function dropWeapon(c:Campaign,itemId:string,ownerId:string):Campaign {
 const token=c.tokens.find(t=>t.characterId===ownerId&&t.mapId===c.view.activeMapId);if(!token)throw new Error('Нет токена владельца на текущей карте');
 const map=c.maps.find(m=>m.id===token.mapId)!;
 const spot=[[1,0],[-1,0],[0,1],[0,-1],[0,0]].map(([x,y])=>({column:token.column+x,row:token.row+y})).find(p=>{const x=map.grid.originPx.x+p.column*map.grid.cellSizePx,y=map.grid.originPx.y+p.row*map.grid.cellSizePx;const origin={x:map.grid.originPx.x+(token.column+0.5)*map.grid.cellSizePx,y:map.grid.originPx.y+(token.row+0.5)*map.grid.cellSizePx};return x>=0&&y>=0&&x+map.grid.cellSizePx<=map.width&&y+map.grid.cellSizePx<=map.height&&sight(map,origin,{x:x+map.grid.cellSizePx/2,y:y+map.grid.cellSizePx/2});});
 if(!spot)throw new Error('Нет доступного места для предмета');
 return {...c,items:c.items.map(i=>i.id===itemId&&i.ownerId===ownerId?{...i,equipped:false,ownerId:null,ground:{mapId:token.mapId,...spot}}:i)};
}
export function applyPrisonAttack(c:Campaign):Campaign {
 const pending=c.pendingAttack;if(!pending)throw new Error('Нет расчёта атаки');if(pending.stamp!==combatStamp(c))throw new Error('Состояние изменилось. Отмените расчёт и бросьте заново');
 const r=calculatePrisonAttack(c,pending.input,pending.rolls);let next:Campaign={...c,pendingAttack:null};next=spendAP(next,r.actor.id,r.cost);next=hpChange(next,r.target.id,-r.damage);next=hpChange(next,r.actor.id,-r.counterDamage);
 const st=condition(next,r.actor.id);next=setCondition(next,r.actor.id,{attacks:st.attacks+(r.variant==='stun'?0:1),quickUsed:st.quickUsed||r.variant==='quick',aim:r.mode==='ranged'?false:st.aim,maneuvers:r.variant==='stun'?[...st.maneuvers,`stun:${r.target.id}`]:st.maneuvers});
 if(pending.input.reaction==='counter'||pending.input.reaction==='disarm'){
  // A reaction selected before the roll is spent even on a tie or fatal incoming hit.
  const b=battleFor(c,r.target.id)!;next=setCondition(next,r.target.id,{reactionRound:`${b.id}:${b.round}`});
 }
 if(r.bleeding)next=setCondition(next,r.target.id,{bleeding:true});if(r.stunned)next=setCondition(next,r.target.id,{stunned:true});
 next={...next,items:next.items.map(i=>i.id===r.item.id?{...i,charges:i.template.maxCharges&&!r.intercepted?Math.max(0,i.charges-1):i.charges,durability:i.template.maxDurability?Math.max(0,i.durability-(r.m.wearPerUse??0)):i.durability}:i)};
 for(const hit of r.barrierHits)next=damageBarrier(next,r.geometry.map.id,hit.id,hit.damage,r.geometry.b);
 if(r.intercepted)next=dropWeapon(next,r.item.id,r.actor.id);
 return campaignSchema.parse(notice(next,r.text));
}
export function aim(c:Campaign,id:string){let next=spendAP(c,id,1);if(!battleFor(c,id))throw new Error('Прицеливание доступно в бою');next=setCondition(next,id,{aim:true});return campaignSchema.parse(notice(next,'Прицеливание: +2 к следующему выстрелу этого хода.'));}
export function reload(c:Campaign,id:string,itemId:string){const item=getWeapon(c,itemId,id,true);if(item.template.mechanics?.attackType!=='ranged'||!item.template.maxCharges)throw new Error('Нужно огнестрельное оружие');if(item.charges===item.template.maxCharges)throw new Error('Оружие уже заряжено');
 const ammo=c.items.filter(i=>i.ownerId===id&&i.template.mechanics?.materialTag==='ammo'&&i.template.mechanics.caliber===item.template.mechanics?.caliber&&i.charges>0);
 if(!ammo.length)throw new Error('Нет подходящих патронов в инвентаре');let next=spendAP(c,id,2),remaining=item.template.maxCharges-item.charges,loaded=0;const items=next.items.map(i=>{if(!ammo.some(a=>a.id===i.id))return i;const n=Math.min(i.charges,remaining);remaining-=n;loaded+=n;return {...i,charges:i.charges-n};});
 next={...next,items:items.map(i=>i.id===item.id?{...i,charges:i.charges+loaded}:i)};return campaignSchema.parse(notice(next,`Перезарядка: загружено ${loaded} патронов, ОД −2.`));
}

export function rerollPendingAttack(c:Campaign,random?:RandomSource):Campaign {const p=c.pendingAttack;if(!p||p.stamp!==combatStamp(c))throw new Error('Нужен актуальный предпросмотр атаки');const actor=c.tokens.find(t=>t.id===p.input.actorTokenId)?.characterId,ch=c.characters.find(ch=>ch.id===actor);if(!ch||ch.prisonProfile?.background!=='gambler')throw new Error('Переброс доступен Карточному шулеру');const s=condition(c,ch.id),day=Math.floor(c.prison.seconds/86400);if(s.rerollDay===day)throw new Error('Дневной переброс уже использован');const rolled=rollDice(2,12,0,'Обязательный переброс атаки шулера',random),rolls=[rolled,...p.rolls.slice(1)];let next=setCondition(c,ch.id,{rerollDay:day});calculatePrisonAttack(next,p.input,rolls);next={...next,diceRolls:[...next.diceRolls,rolled].slice(-200),pendingAttack:{...p,rolls,stamp:combatStamp(next)}};return campaignSchema.parse(notice(next,'Переброс атаки обязателен; возможность за игровой день потрачена.'));}
