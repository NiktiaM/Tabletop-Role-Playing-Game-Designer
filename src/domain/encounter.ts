import {effectiveStats} from './effective-stats.js';
import {advanceCraftTime} from './prison-catalog.js';
import {isPrison,battles,battleFor,condition,enterPrisonTurn,advanceTime,health,setCondition,notice} from './prison-state.js';
import {tickEffects,preserveResources} from './game-actions.js';
import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {encounterSchema,type Participant,type Recovery} from '../shared/encounter.js';
import {resourceBudget} from './resources.js';

export function currentActor(campaign:Campaign):string|null {
 return campaign.encounter?.participants[campaign.encounter.turnIndex]?.characterId??null;
}

function enterTurn(campaign:Campaign,newRound:boolean):Campaign {
 const encounter=campaign.encounter!;
 const ids=new Set(encounter.recovery==='round'&&newRound?encounter.participants.map(row=>row.characterId):encounter.recovery==='turn'?[currentActor(campaign)!]:[]);
 return campaignSchema.parse({...campaign,characters:campaign.characters.map(character=>ids.has(character.id)?{...character,resources:{...character.resources,[encounter.apStat]:resourceBudget(campaign,character,encounter.apStat).maximum}}:character)});
}

export function startEncounter(campaign:Campaign,participants:Participant[],recovery:Recovery,sort=true):Campaign {
 if(!campaign.session.started)throw new Error('Сначала начните игру');
 if(campaign.encounter&&!isPrison(campaign))throw new Error('Бой уже идёт');
 if(isPrison(campaign)&&participants.some(p=>battleFor(campaign,p.characterId)))throw new Error('Участник уже находится в другом бою');
 const apStat=campaign.ruleset.movement.budgetStat;
 if(!apStat)throw new Error('Настройте показатель бюджета движения во вкладке «Правила»');
 const checked=encounterSchema.safeParse({id:crypto.randomUUID(),name:isPrison(campaign)?`Бой ${battles(campaign).length+1}`:undefined,startedAt:isPrison(campaign)?campaign.prison.seconds:undefined,participants,round:1,turnIndex:0,recovery,apStat,previousTacticalMovement:campaign.session.tacticalMovement});
 if(!checked.success)throw new Error('Выберите от 1 до 200 разных участников и задайте конечную инициативу от −1000000 до 1000000; выберите режим восстановления ОД');
 const encounter=checked.data;
 for(const row of encounter.participants){const character=campaign.characters.find(character=>character.id===row.characterId);if(!character)throw new Error('Участник не найден');resourceBudget(campaign,character,apStat);}
 if(sort)encounter.participants.sort((a,b)=>b.initiative-a.initiative||(isPrison(campaign)?((effectiveStats(campaign,campaign.characters.find(c=>c.id===b.characterId)!).find(s=>s.key==='dexterity')?.value??campaign.characters.find(c=>c.id===b.characterId)?.values.dexterity??5)-(effectiveStats(campaign,campaign.characters.find(c=>c.id===a.characterId)!).find(s=>s.key==='dexterity')?.value??campaign.characters.find(c=>c.id===a.characterId)?.values.dexterity??5)):0)||(b.tieBreaker??0)-(a.tieBreaker??0));
 if(campaign.gameplay.skipDefeatedTurns&&campaign.ruleset.healthStat){const index=encounter.participants.findIndex(p=>resourceBudget(campaign,campaign.characters.find(ch=>ch.id===p.characterId)!,campaign.ruleset.healthStat!).remaining>0);if(index<0)throw new Error('Нет участников с положительными HP');encounter.turnIndex=index;}
 const started=campaignSchema.parse({...campaign,otherEncounters:isPrison(campaign)&&campaign.encounter?[...campaign.otherEncounters,campaign.encounter]:campaign.otherEncounters,session:{...campaign.session,tacticalMovement:true},encounter});
 return isPrison(started)?campaignSchema.parse(enterPrisonTurn({...started,prison:{...started.prison,projects:started.prison.projects.map(p=>participants.some(x=>x.characterId===p.ownerId)?{...p,active:false}:p)}})):enterTurn(started,true);
}

export function nextTurn(campaign:Campaign):Campaign {
 if(campaign.pendingAttack)throw new Error('Сначала примените или отмените расчёт атаки');
 const encounter=campaign.encounter;if(!encounter)throw new Error('Бой не начат');
 if(isPrison(campaign))return nextPrisonTurn(campaign);
 const outgoing=currentActor(campaign)!;campaign=tickEffects(campaign,outgoing);
 let turnIndex=encounter.turnIndex,round=encounter.round,found=false;
 for(let count=0;count<encounter.participants.length;count++){turnIndex=(turnIndex+1)%encounter.participants.length;if(turnIndex===0)round++;const id=encounter.participants[turnIndex].characterId,ch=campaign.characters.find(c=>c.id===id)!;if(!campaign.gameplay.skipDefeatedTurns||!campaign.ruleset.healthStat||resourceBudget(campaign,ch,campaign.ruleset.healthStat).remaining>0){found=true;break;}if(id!==outgoing)campaign=tickEffects(campaign,id);}
 if(!found)return endEncounter(campaign);
 const newRound=round!==encounter.round,next=campaignSchema.parse({...campaign,encounter:{...encounter,turnIndex,round}});
 return enterTurn(next,newRound);
}

export function reorderEncounter(campaign:Campaign,ids:string[]):Campaign {
 const encounter=campaign.encounter;if(!encounter)throw new Error('Бой не начат');
 if(ids.length!==encounter.participants.length||new Set(ids).size!==ids.length||ids.some(id=>!encounter.participants.some(row=>row.characterId===id)))throw new Error('Нужна перестановка всех участников боя');
 const actor=currentActor(campaign);
 return campaignSchema.parse({...campaign,encounter:{...encounter,participants:ids.map(id=>encounter.participants.find(row=>row.characterId===id)!),turnIndex:ids.indexOf(actor!)}});
}

export function endEncounter(campaign:Campaign):Campaign {
 if(!campaign.encounter)throw new Error('Бой не начат');
 if(isPrison(campaign)){const id=campaign.encounter.id;let next:Campaign={...campaign,encounter:campaign.otherEncounters[0]??null,otherEncounters:campaign.otherEncounters.slice(1),pendingAttack:null,effects:campaign.effects.filter(e=>e.encounterId!==id),session:{...campaign.session,tacticalMovement:campaign.otherEncounters.length>0}};for(const p of campaign.encounter.participants)next=setCondition(next,p.characterId,{stunned:false,grappledBy:null});return campaignSchema.parse(preserveResources(campaign,notice(next,'Бой завершён; HP, ОД, кровь и вещи сохранены.')));}
 return campaignSchema.parse(preserveResources(campaign,{...campaign,pendingAttack:null,effects:campaign.effects.filter(e=>e.encounterId!==campaign.encounter!.id),encounter:null,session:{...campaign.session,tacticalMovement:campaign.encounter.previousTacticalMovement}}));
}

function nextPrisonTurn(c:Campaign):Campaign {
 let next=tickEffects(c,currentActor(c)!);const b=c.encounter!;
 for(let n=0;n<b.participants.length*2;n++){
  const old=next.encounter!,index=(old.turnIndex+1)%old.participants.length,round=old.round+(index===0?1:0);
  next={...next,encounter:{...old,turnIndex:index,round}};
  const p=next.encounter!.participants[index];
  if((p.availableRound??1)>round||health(next,p.characterId).remaining<=0)continue;
  const target=(old.startedAt??c.prison.seconds)+(round-1)*6;
  if(target>next.prison.seconds)next=advanceCraftTime(next,target-next.prison.seconds);
  next=enterPrisonTurn(next);
  if(health(next,p.characterId).remaining>0)return campaignSchema.parse(next);
 }
 return endEncounter(next);
}
export function selectEncounter(c:Campaign,id:string):Campaign {
 if(c.pendingAttack)throw new Error('Сначала примените или отмените расчёт атаки');
 if(c.encounter?.id===id)return c;
 const target=c.otherEncounters.find(b=>b.id===id);if(!target)throw new Error('Бой не найден');
 return campaignSchema.parse({...c,encounter:target,otherEncounters:[...c.otherEncounters.filter(b=>b.id!==id),...(c.encounter?[c.encounter]:[])]});
}
export function joinEncounter(c:Campaign,characterId:string,initiative:number,surprised=false):Campaign {
 const b=c.encounter;if(!b)throw new Error('Выберите бой');if(c.pendingAttack)throw new Error('Сначала завершите расчёт атаки');
 if(battleFor(c,characterId))throw new Error('Персонаж уже участвует в бою');
 const ch=c.characters.find(ch=>ch.id===characterId);if(!ch||health(c,characterId).remaining<=0)throw new Error('Нужен персонаж в сознании');
 const now=(b.startedAt??c.prison.seconds)+(b.round-1)*6;if(condition(c,characterId).lastTurnAt>now)throw new Error('Персонаж ещё не прибыл в это игровое время');
 const actor=currentActor(c),rows=[...b.participants,{characterId,initiative,surprised}].sort((a,b)=>b.initiative-a.initiative);
 const index=rows.findIndex(p=>p.characterId===characterId),turnIndex=rows.findIndex(p=>p.characterId===actor);
 rows[index]={...rows[index],availableRound:index<=turnIndex?b.round+1:b.round};
 return campaignSchema.parse({...c,prison:{...c.prison,projects:c.prison.projects.map(p=>p.ownerId===characterId?{...p,active:false}:p)},encounter:{...b,participants:rows,turnIndex}});
}
export function leaveEncounter(c:Campaign,characterId:string):Campaign {
 const b=c.encounter;if(!b||c.pendingAttack)throw new Error('Выберите бой и завершите расчёт');
 if(condition(c,characterId).grappledBy)throw new Error('Сначала освободитесь из захвата');
 const rows=b.participants.filter(p=>p.characterId!==characterId);if(rows.length===b.participants.length)throw new Error('Участник не найден');
 if(!rows.length)return endEncounter(c);
 const actor=currentActor(c),turnIndex=actor===characterId?Math.min(b.turnIndex,rows.length-1):rows.findIndex(p=>p.characterId===actor);
 let next:Campaign={...c,encounter:{...b,participants:rows,turnIndex}};
 if(actor===characterId)next=enterPrisonTurn(next);
 return campaignSchema.parse(next);
}
export function mergeEncounter(c:Campaign,id:string):Campaign {
 if(!c.encounter||c.pendingAttack)throw new Error('Выберите бой и завершите расчёт');
 const other=c.otherEncounters.find(b=>b.id===id);if(!other)throw new Error('Второй бой не найден');
 const active=c.encounter,actor=currentActor(c),rows=[...active.participants,...other.participants].sort((a,b)=>b.initiative-a.initiative);
 let next:Campaign={...c,encounter:{...active,participants:rows,turnIndex:rows.findIndex(p=>p.characterId===actor)},otherEncounters:c.otherEncounters.filter(b=>b.id!==id)};
 for(const p of other.participants){const st=condition(c,p.characterId);next=setCondition(next,p.characterId,{raisedIn:st.raisedIn.includes(other.id)?[...new Set([...st.raisedIn,active.id])]:st.raisedIn,reactionRound:st.reactionRound===`${other.id}:${other.round}`?`${active.id}:${active.round}`:st.reactionRound,enteredTurn:`${active.id}:${active.round}:${p.characterId}`});}
 return campaignSchema.parse(notice(next,'Бои объединены без восстановления ресурсов и дополнительных ходов.'));
}
