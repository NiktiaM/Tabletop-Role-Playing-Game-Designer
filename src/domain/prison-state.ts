import {prisonCatalog} from './prison-catalog-data.js';
import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {conditionSchema,type Condition} from '../shared/prison.js';
import {resourceBudget} from './resources.js';
import {effectiveStats} from './effective-stats.js';
import {rPrisonDraft} from './presets/rprison.js';
export const isPrison=(c:Campaign)=>c.gameplay.rulesVersion==='prison03';
export const battles=(c:Campaign)=>[...(c.encounter?[c.encounter]:[]),...c.otherEncounters];
export const battleFor=(c:Campaign,id:string)=>battles(c).find(b=>b.participants.some(p=>p.characterId===id));
export function condition(c:Campaign,id:string):Condition{return conditionSchema.parse(c.prison.conditions[id]??{});}
export function setCondition(c:Campaign,id:string,patch:Partial<Condition>):Campaign {
 if(!c.characters.some(ch=>ch.id===id))throw new Error('Персонаж не найден');
 return {...c,prison:{...c.prison,conditions:{...c.prison.conditions,[id]:conditionSchema.parse({...condition(c,id),...patch})}}};
}
export function stat(c:Campaign,ch:Character,key:string){const row=effectiveStats(c,ch).find(s=>s.key===key);if(!row||!Number.isFinite(row.value))throw new Error(`Нет характеристики ${key}`);return row.value;}
export const bonus=(n:number)=>Math.ceil(n/3);
export function health(c:Campaign,id:string){const ch=c.characters.find(ch=>ch.id===id);if(!ch||!c.ruleset.healthStat)throw new Error('Персонаж или показатель HP не найден');return resourceBudget(c,ch,c.ruleset.healthStat);}
export function hpChange(c:Campaign,id:string,delta:number){const h=health(c,id),remaining=Math.max(0,Math.min(h.maximum,h.remaining+delta));return {...c,prison:remaining===0?{...c.prison,conditions:Object.fromEntries(Object.entries(c.prison.conditions).map(([key,s])=>[key,s.grappledBy===id?{...s,grappledBy:null}:s]))}:c.prison,characters:c.characters.map(ch=>ch.id===id?{...ch,resources:{...ch.resources,[h.key]:remaining}}:ch)};}
export function notice(c:Campaign,message:string):Campaign{return {...c,events:[...c.events,{id:crypto.randomUUID(),at:new Date().toISOString(),message}].slice(-500)};}
export function spendAP(c:Campaign,id:string,cost:number):Campaign {
 if(!Number.isFinite(cost)||cost<0)throw new Error('Неверная цена действия');
 const ch=c.characters.find(ch=>ch.id===id);if(!ch||health(c,id).remaining<=0)throw new Error('Нет HP для действия');
 const b=battleFor(c,id);
 if(b&&(c.encounter?.id!==b.id||b.participants[b.turnIndex]?.characterId!==id))throw new Error('Сначала выберите бой и ход этого персонажа');
 if(!b)return c;
 const ap=resourceBudget(c,ch,b.apStat);if(ap.remaining+1e-9<cost)throw new Error(`Недостаточно ОД: нужно ${cost}`);
 return {...c,characters:c.characters.map(row=>row.id===id?{...row,resources:{...row.resources,[ap.key]:Math.max(0,ap.remaining-cost)}}:row)};
}
export function reactionAvailable(c:Campaign,id:string){const b=battleFor(c,id),s=condition(c,id);if(!b||health(c,id).remaining<=0||s.stunned)return false;const p=b.participants.find(p=>p.characterId===id)!;return !(p.surprised&&!s.enteredTurn?.startsWith(b.id))&&s.reactionRound!==`${b.id}:${b.round}`;}
export function consumeReaction(c:Campaign,id:string){if(!reactionAvailable(c,id))throw new Error('Специальная реакция уже использована или недоступна');const b=battleFor(c,id)!;return setCondition(c,id,{reactionRound:`${b.id}:${b.round}`});}
export function applyPrisonRules(c:Campaign):Campaign {
 if(battles(c).length||c.pendingAttack)throw new Error('Перед сменой правил завершите бои и расчёты');
 const previous=new Map(c.characters.map(ch=>[ch.id,{hp:c.ruleset.healthStat?resourceBudget(c,ch,c.ruleset.healthStat):null,ap:c.ruleset.movement.budgetStat?resourceBudget(c,ch,c.ruleset.movement.budgetStat):null}]));
 const preset=rPrisonDraft(),keys=new Set(preset.stats.map(s=>s.key));
 let next:Campaign={...c,itemTemplates:[...c.itemTemplates,...prisonCatalog().filter(t=>!c.itemTemplates.some(old=>old.id===t.id))],ruleset:{...preset,id:c.ruleset.id,revision:c.ruleset.revision+1,stats:[...preset.stats,...c.ruleset.stats.filter(s=>!keys.has(s.key))]},gameplay:{...c.gameplay,rulesVersion:'prison03',armorAbsorbs:true,noReactionHits:false,dodgeCost:0,blockCost:0,counterCost:0,rangedDistanceUnit:'meters',attackCost:2},characters:c.characters.map(ch=>ch.kind==='npc'&&previous.get(ch.id)?.hp?{...ch,prisonProfile:{...ch.prisonProfile,skills:ch.prisonProfile?.skills??[],npcMaxHP:previous.get(ch.id)!.hp!.maximum}}:ch)};
 next={...next,characters:next.characters.map(ch=>{const old=previous.get(ch.id)!;return {...ch,resources:{...ch.resources,...(old.hp?{hp_max:Math.min(old.hp.remaining,resourceBudget(next,ch,'hp_max').maximum)}:{}),...(old.ap?{ap_max:Math.min(old.ap.remaining,resourceBudget(next,ch,'ap_max').maximum)}:{})}};})};
 return campaignSchema.parse(notice(next,'Применены правила Prison 0.3. Текущие HP/ОД сохранены; индивидуальные максимумы NPC закреплены.'));
}
export function enterPrisonTurn(c:Campaign):Campaign {
 const b=c.encounter;if(!b)return c;const id=b.participants[b.turnIndex].characterId,key=`${b.id}:${b.round}:${id}`,s=condition(c,id);
 if(s.enteredTurn===key)return c;
 const turnAt=(b.startedAt??c.prison.seconds)+(b.round-1)*6,first=!s.enteredTurn?.startsWith(b.id),sameTime=first&&s.enteredTurn!==null&&s.lastTurnAt>=turnAt,surprise=first&&b.participants[b.turnIndex].surprised;
 if(sameTime){const oldBattle=s.enteredTurn!.split(':')[0],raised=s.raisedIn.includes(oldBattle)?[...new Set([...s.raisedIn,b.id])]:s.raisedIn;return setCondition(c,id,{enteredTurn:key,reactionRound:s.reactionRound===`${oldBattle}:${s.enteredTurn!.split(':')[1]}`?`${b.id}:${b.round}`:null,raisedIn:raised});}
 let next=setCondition(c,id,{enteredTurn:key,attacks:0,runUpMeters:0,quickUsed:false,aim:false,maneuvers:[],lastTurnAt:(b.startedAt??c.prison.seconds)+(b.round-1)*6,stunned:false});
 if(s.bleeding&&health(next,id).remaining>0)next=hpChange(next,id,-1);
 const ch=next.characters.find(ch=>ch.id===id)!,max=resourceBudget(next,ch,b.apStat).maximum;
 const ap=health(next,id).remaining>0?Math.max(0,(surprise?Math.min(4,max):max)-(s.stunned?2:0)):0;
 next={...next,characters:next.characters.map(ch=>ch.id===id?{...ch,resources:{...ch.resources,[b.apStat]:ap}}:ch)};
 return next;
}
export function advanceTime(c:Campaign,seconds:number):Campaign {
 if(c.pendingAttack)throw new Error('Сначала примените или отмените расчёт атаки');
 if(!Number.isFinite(seconds)||seconds<0||seconds>86400*30)throw new Error('Сдвиг времени должен быть от 0 до 30 суток');
 let next:Campaign={...c,prison:{...c.prison,seconds:c.prison.seconds+seconds}};
 for(const ch of c.characters){
  const s=condition(next,ch.id);
  if(!battleFor(c,ch.id)&&s.bleeding&&health(next,ch.id).remaining>0){const elapsed=s.bleedSeconds+seconds;next=hpChange(next,ch.id,-Math.floor(elapsed/1800));next=setCondition(next,ch.id,{bleedSeconds:elapsed%1800});}
  if(s.hospitalUntil!==null&&next.prison.seconds>=s.hospitalUntil){const h=health(next,ch.id);next=hpChange(next,ch.id,Math.ceil(.2*h.maximum)-h.remaining);next=setCondition(next,ch.id,{hospitalUntil:null,bleeding:false,bleedSeconds:0,stunned:false,grappledBy:null});}
 }
 return notice(next,`Прошло ${seconds/60} игровых минут.`);
}
export function newScene(c:Campaign):Campaign {if(battles(c).length)throw new Error('Сначала завершите продолжающиеся столкновения');return {...c,prison:{...c.prison,scene:c.prison.scene+1,conditions:Object.fromEntries(Object.entries(c.prison.conditions).map(([id,s])=>[id,{...s,sceneUses:[],socialBonus:0}]))}};}
