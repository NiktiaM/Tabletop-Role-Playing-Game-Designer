import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {rollDice,type RandomSource} from './dice.js';
import {stat,health,condition,setCondition,notice} from './prison-state.js';
export function check(c:Campaign,id:string,key:string,threshold:number,mode:'normal'|'advantage'|'disadvantage'='normal',modifier=0,feature=false,random?:RandomSource):Campaign {
 const ch=c.characters.find(ch=>ch.id===id);if(!ch||!['strength','dexterity','constitution','charisma'].includes(key)||!Number.isFinite(threshold)||Math.abs(threshold)>1000||!Number.isFinite(modifier)||Math.abs(modifier)>100)throw new Error('Проверьте участника, характеристику, порог и модификатор');
 if(health(c,id).remaining<=0)throw new Error('Персонаж без сознания не выполняет проверки');
 let next=c;const s=condition(c,id);
 if(feature){const bg=ch.prisonProfile?.background;if(!bg||!['gap','tongue','muscle','hands','nothing'].includes(bg))throw new Error('Эта предыстория не даёт такого преимущества');if(bg!=='nothing'&&s.sceneUses.includes(bg))throw new Error('Особенность уже использована в сцене');if(mode==='normal')mode='advantage';else if(mode==='disadvantage')mode='normal';next=setCondition(next,id,{sceneUses:bg==='nothing'?s.sceneUses:[...s.sceneUses,bg]});}
 const rolls=[rollDice(2,12,0,`${ch.name}: ${c.ruleset.stats.find(s=>s.key===key)?.name??key}`.slice(0,120),random)];if(mode!=='normal')rolls.push(rollDice(2,12,0,'Второй полный бросок 2d12',random));
 const value=mode==='advantage'?Math.max(...rolls.map(r=>r.total)):mode==='disadvantage'?Math.min(...rolls.map(r=>r.total)):rolls[0].total,total=value+stat(next,ch,key)+modifier+(key==='charisma'?condition(c,id).socialBonus:0);
 if(key==='charisma'&&condition(c,id).socialBonus)next=setCondition(next,id,{socialBonus:0});
 const effectiveModifier=modifier+(key==='charisma'?condition(c,id).socialBonus:0);
 const result={id:crypto.randomUUID(),characterId:id,stat:key,threshold,total,modifier:effectiveModifier,mode,success:total>threshold,rerolled:false};
 next={...next,diceRolls:[...next.diceRolls,...rolls].slice(-200),prison:{...next.prison,checks:[...next.prison.checks,result].slice(-200)}};
 return campaignSchema.parse(notice(next,`${ch.name}: ${rolls.map(r=>r.total).join(' / ')} + ${stat(next,ch,key)} ${effectiveModifier>=0?'+':''}${effectiveModifier} =${total}; нужно >${threshold}. ${result.success?'Успех':'Неудача'}.`));
}
export function rerollCheck(c:Campaign,id:string,random?:RandomSource):Campaign {const old=c.prison.checks.find(r=>r.id===id),ch=c.characters.find(ch=>ch.id===old?.characterId);if(!old||!ch||ch.prisonProfile?.background!=='gambler')throw new Error('Нужна собственная проверка Карточного шулера');const s=condition(c,ch.id),day=Math.floor(c.prison.seconds/86400);if(s.rerollDay===day||old.rerolled)throw new Error('Дневной переброс уже использован');const next=check(c,ch.id,old.stat,old.threshold,old.mode,old.modifier,false,random),last=next.prison.checks[next.prison.checks.length-1];return campaignSchema.parse(setCondition({...next,prison:{...next.prison,checks:next.prison.checks.map(row=>row.id===old.id||row.id===last.id?{...row,rerolled:true}:row)}},ch.id,{rerollDay:day}));}

export function showman(c:Campaign,id:string,targetId:string):Campaign {const ch=c.characters.find(ch=>ch.id===id);if(!ch||ch.prisonProfile?.background!=='showman'||id===targetId)throw new Error('Нужны шоумен и другой союзник');const s=condition(c,id);if(s.sceneUses.includes('showman'))throw new Error('Выступление уже использовано в сцене');let next=setCondition(c,id,{sceneUses:[...s.sceneUses,'showman']});next=setCondition(next,targetId,{socialBonus:2});return campaignSchema.parse(notice(next,'Выступление: +2 к следующей связанной социальной проверке выбранного союзника в этой сцене.'));}
