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
 if(campaign.encounter)throw new Error('Бой уже идёт');
 const apStat=campaign.ruleset.movement.budgetStat;
 if(!apStat)throw new Error('Настройте показатель бюджета движения во вкладке «Правила»');
 const checked=encounterSchema.safeParse({id:crypto.randomUUID(),participants,round:1,turnIndex:0,recovery,apStat,previousTacticalMovement:campaign.session.tacticalMovement});
 if(!checked.success)throw new Error('Выберите от 1 до 200 разных участников и задайте конечную инициативу от −1000000 до 1000000; выберите режим восстановления ОД');
 const encounter=checked.data;
 for(const row of encounter.participants){const character=campaign.characters.find(character=>character.id===row.characterId);if(!character)throw new Error('Участник не найден');resourceBudget(campaign,character,apStat);}
 if(sort)encounter.participants.sort((a,b)=>b.initiative-a.initiative);
 if(campaign.gameplay.skipDefeatedTurns&&campaign.ruleset.healthStat){const index=encounter.participants.findIndex(p=>resourceBudget(campaign,campaign.characters.find(ch=>ch.id===p.characterId)!,campaign.ruleset.healthStat!).remaining>0);if(index<0)throw new Error('Нет участников с положительными HP');encounter.turnIndex=index;}
 const started=campaignSchema.parse({...campaign,session:{...campaign.session,tacticalMovement:true},encounter});
 return enterTurn(started,true);
}

export function nextTurn(campaign:Campaign):Campaign {
 if(campaign.pendingAttack)throw new Error('Сначала примените или отмените расчёт атаки');
 const encounter=campaign.encounter;if(!encounter)throw new Error('Бой не начат');
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
 return campaignSchema.parse(preserveResources(campaign,{...campaign,pendingAttack:null,effects:campaign.effects.filter(e=>e.encounterId!==campaign.encounter!.id),encounter:null,session:{...campaign.session,tacticalMovement:campaign.encounter.previousTacticalMovement}}));
}
