import {test,expect} from 'vitest';
import {createCampaign,campaignSchema,parseCampaign,type Campaign,type Character,defaultGrid} from '../src/shared/campaign.js';
import {startEncounter,nextTurn,selectEncounter,joinEncounter,leaveEncounter,mergeEncounter,endEncounter} from '../src/domain/encounter.js';
import {resourceBudget,setResource} from '../src/domain/resources.js';
import {condition,setCondition,advanceTime,applyPrisonRules,health,reactionAvailable} from '../src/domain/prison-state.js';
import {previewAttack,applyAttack,calculateAttack,useItem,pickupItem} from '../src/domain/game-actions.js';
import {raiseAlly,hospital,maneuver,sleep} from '../src/domain/prison-actions.js';
import {UNARMED,reload,aim} from '../src/domain/prison-combat.js';
import {prisonCatalog,catalogId,startCraft,advanceCraftTime,setProjectActive,installCatalog} from '../src/domain/prison-catalog.js';
import {createItem} from '../src/domain/items.js';
import {createPrisonCharacter,awardStoryXP,levelUp,levelFromXP} from '../src/domain/prison-progression.js';
import {moveWithPath,movementPolicy} from '../src/domain/movement-action.js';
import {applyFall,jump} from '../src/domain/prison-movement.js';
import {damageBarrier,barrierImpact,toggleDoor} from '../src/domain/prison-barriers.js';
import {vision,rememberVision,tokenVisible} from '../src/domain/visibility.js';
import {check} from '../src/domain/prison-checks.js';
import {carrySummary} from '../src/domain/prison-inventory.js';
import {legacyCampaign} from './legacy-fixture.js';
const one=()=>0,six=()=>5,twelve=()=>11;
function fixture(count=4){
 let c=createCampaign('Лейквью0.3');const map={id:crypto.randomUUID(),name:'Мастерская',width:1200,height:1000,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
 const characters:Character[]=Array.from({length:count},(_,i)=>({id:crypto.randomUUID(),name:`Игрок${i+1}`,kind:'character',footprint:{width:1,height:1},portrait:null,values:{strength:7,dexterity:5,constitution:5,charisma:3,level:1,armor:0},resources:{hp_max:20,ap_max:8},experience:0}));
 c={...c,session:{started:true,tacticalMovement:false},characters,maps:[map],view:{activeMapId:map.id,cameras:{}},tokens:characters.map((ch,i)=>({id:crypto.randomUUID(),characterId:ch.id,mapId:map.id,column:1+i,row:1}))};return campaignSchema.parse(c);
}
const ids=(c:Campaign)=>c.characters.map(ch=>ch.id);
function battle(c:Campaign,selected=[0,1]){return startEncounter(c,selected.map((i,j)=>({characterId:c.characters[i].id,initiative:20-j})),'turn');}
function equip(c:Campaign,n:number,owner=0){const item={...createItem(prisonCatalog().find(t=>t.id===catalogId(n))!,c.characters[owner].id),equipped:true};return {c:{...c,items:[...c.items,item]},item};}
function attackInput(c:Campaign,weaponId=UNARMED){return {actorTokenId:c.tokens[0].id,targetTokenId:c.tokens[1].id,weaponId,mode:'melee' as const,reaction:'dodge' as const};}

test('новая партия использует книгу0.3, создание20+2, навыки и жёсткий стартовый предел',()=>{
 const c=fixture();expect(c.gameplay.rulesVersion).toBe('prison03');expect(health(c,ids(c)[0]).maximum).toBe(20);expect(resourceBudget(c,c.characters[0],'ap_max').maximum).toBe(8);
 const ch=createPrisonCharacter({name:'Нора',values:{strength:7,dexterity:5,constitution:5,charisma:3},background:'skin',skill:'Ремонт',footprint:{width:1,height:1},portrait:null});expect(ch.values.constitution).toBe(7);expect(ch.prisonProfile?.skills).toEqual(['Ремонт']);
 expect(()=>createPrisonCharacter({name:'Нора',values:{strength:16,dexterity:2,constitution:1,charisma:1},background:'muscle',skill:'Ремонт',footprint:{width:1,height:1},portrait:null})).toThrow('15');
});
test('сохранение17 мигрирует без молчаливого пересчёта; явное применение сохраняет текущие и индивидуальныеHPNPC',()=>{
 let old=legacyCampaign('Старый');const base=fixture(2);old={...old,characters:base.characters.map((ch,i)=>({...ch,kind:i?'npc':'character',resources:{hp_max:7,ap_max:3}}))};
 const loaded=parseCampaign({...old,schemaVersion:17});expect(loaded.gameplay.rulesVersion).toBe('legacy');expect(loaded.schemaVersion).toBe(18);
 const maximum=health(loaded,loaded.characters[1].id).maximum,next=applyPrisonRules(loaded);expect(health(next,next.characters[0].id).remaining).toBe(7);expect(health(next,next.characters[1].id).maximum).toBe(maximum);expect(next.characters[0].resources.ap_max).toBe(3);
});
test('атака: предпросмотр, равенство, применение один раз и отклонение устаревшего расчёта',()=>{
 const c=battle(fixture()),before=structuredClone(c),i=attackInput(c),preview=previewAttack(c,i,six),r=calculateAttack(preview,i,preview.pendingAttack!.rolls);
 // strength7 ->+3, dex5 dodge ->+4, so equal dice miss.
 expect(r.attack).toBe(15);expect(r.defense).toBe(16);expect(r.damage).toBe(0);expect(preview.characters).toEqual(c.characters);
 const applied=applyAttack(preview);expect(applied.characters[0].resources.ap_max).toBe(6);expect(condition(applied,ids(c)[0]).attacks).toBe(1);expect(()=>applyAttack(applied)).toThrow('Нет расчёта');
 expect(()=>applyAttack(setCondition(preview,ids(c)[1],{bleeding:true}))).toThrow('Состояние изменилось');expect(c).toEqual(before);
});
test('бесплатный блок снижает проигранный урон, контратака расходует одну реакцию',()=>{
 const eq=equip(fixture(),2),c=battle(eq.c),input={...attackInput(c,eq.item.id),reaction:'block' as const};let n=0;const values=[11,11,0,0,5];const preview=previewAttack(c,input,()=>values[n++]??0),r=calculateAttack(preview,input,preview.pendingAttack!.rolls);expect(r.damage).toBe(7);const applied=applyAttack(preview);expect(applied.characters[1].resources.ap_max).toBe(8);
 const counter={...attackInput(c),reaction:'counter' as const};n=0;const response=applyAttack(previewAttack(c,counter,()=>[0,0,11,11,0,3][n++]??0));expect(reactionAvailable(response,ids(c)[1])).toBe(false);expect(()=>previewAttack(response,counter,one)).toThrow('реакция');
});
test('кровь перед первым ходом: при1HPнет действий и отрицательныхHP; таймер30мин вне боя',()=>{
 let c=fixture(2);c=setCondition(c,ids(c)[1],{bleeding:true});c=setResource(c,ids(c)[1],'hp_max',1);c=battle(c);c=nextTurn(c);expect(health(c,ids(c)[1]).remaining).toBe(0);expect(c.characters[1].resources.ap_max).toBe(0);
 let outside=fixture(1);const id=ids(outside)[0];outside=setCondition(outside,id,{bleeding:true});outside=advanceTime(outside,1799);expect(health(outside,id).remaining).toBe(20);outside=advanceTime(outside,1);expect(health(outside,id).remaining).toBe(19);expect(condition(outside,id).bleedSeconds).toBe(0);
});
test('внезапность только в первом ходе; свободные атаки не восстанавливаются переключением',()=>{
 const base=fixture(2),c=startEncounter(base,[{characterId:ids(base)[0],initiative:20,surprised:true},{characterId:ids(base)[1],initiative:10}],'turn');expect(c.characters[0].resources.ap_max).toBe(4);const next=nextTurn(nextTurn(c));expect(next.characters[0].resources.ap_max).toBe(8);
});
test('несколько боёв: переключение не обновляетОД, посторонний исследует и свой чужой ход запрещён',()=>{
 let c=fixture(5);c=battle(c,[0,1]);const first=c.encounter!.id;c=setResource(c,ids(c)[0],'ap_max',2);c=battle(c,[2,3]);const second=c.encounter!.id;
 expect(c.otherEncounters).toHaveLength(1);c=selectEncounter(c,first);expect(c.characters[0].resources.ap_max).toBe(2);expect(selectEncounter(c,second).characters[2].resources.ap_max).toBe(8);
 const before=c.characters[4].resources.ap_max;c=moveWithPath(c,c.tokens[4].id,5,2,true).campaign;expect(c.characters[4].resources.ap_max).toBe(before);
 expect(()=>moveWithPath(c,c.tokens[2].id,3,2,true)).toThrow('другом бою');expect(parseCampaign(JSON.parse(JSON.stringify(c)))).toEqual(c);
});
test('вступивший после своей позиции ждёт раунд; выход/возврат не даёт новый текущий ход',()=>{
 let c=battle(fixture(3));const newcomer=ids(c)[2];c=joinEncounter(c,newcomer,30);expect(c.encounter!.participants.find(p=>p.characterId===newcomer)?.availableRound).toBe(2);expect(c.encounter!.participants[c.encounter!.turnIndex].characterId).toBe(ids(c)[0]);
 c=nextTurn(c);expect(c.encounter!.participants[c.encounter!.turnIndex].characterId).toBe(ids(c)[1]);c=nextTurn(c);expect(c.encounter!.round).toBe(2);expect(c.encounter!.participants[c.encounter!.turnIndex].characterId).toBe(newcomer);
});
test('объединение боёв сохраняет использованный подъём и реакцию',()=>{
 let c=battle(fixture(4),[0,1]);const first=c.encounter!.id;c=battle(c,[2,3]);const second=c.encounter!.id,id=ids(c)[2];c=setCondition(c,id,{raisedIn:[second],reactionRound:`${second}:1`});c=selectEncounter(c,first);const merged=mergeEncounter(c,second);expect(merged.encounter!.participants).toHaveLength(4);expect(merged.otherEncounters).toHaveLength(0);expect(condition(merged,id).raisedIn).toContain(first);expect(reactionAvailable(merged,id)).toBe(false);
});
test('подъём20% вверх, один раз за бой; кровь остаётся; мастер может обойти лимит',()=>{
 let c=battle(fixture(2)),id=ids(c)[1];c=setResource(c,id,'hp_max',0);c=setCondition(c,id,{bleeding:true});c=raiseAlly(c,ids(c)[0],id);expect(health(c,id).remaining).toBe(4);expect(c.characters[0].resources.ap_max).toBe(5);expect(condition(c,id).bleeding).toBe(true);
 c=setResource(c,id,'hp_max',0);expect(()=>raiseAlly(c,ids(c)[0],id)).toThrow('уже');c=raiseAlly(c,ids(c)[0],id,true);expect(health(c,id).remaining).toBe(4);expect(c.characters[0].resources.ap_max).toBe(5);
});
test('лазарет ровно1игровой час; выписка20%, обычное лечение не будит0HP',()=>{
 let c=fixture(2);const item=createItem(prisonCatalog().find(t=>t.id===catalogId(11))!,ids(c)[0]);c={...c,items:[item]};c=setResource(c,ids(c)[1],'hp_max',0);c=setCondition(c,ids(c)[1],{bleeding:true});c=useItem(c,item.id,ids(c)[1]);expect(health(c,ids(c)[1]).remaining).toBe(0);expect(condition(c,ids(c)[1]).bleeding).toBe(false);expect(c.items).toHaveLength(0);
 c=hospital(c,ids(c)[1]);c=advanceTime(c,3599);expect(health(c,ids(c)[1]).remaining).toBe(0);c=advanceTime(c,1);expect(health(c,ids(c)[1]).remaining).toBe(4);
});
test('повязка тратится, еда один раз между снами, сон восстанавливает максимум',()=>{
 let c=fixture(1),id=ids(c)[0];const bandage=createItem(prisonCatalog().find(t=>t.id===catalogId(9))!,id),food=prisonCatalog().find(t=>t.id===catalogId(12))!;c={...c,items:[bandage,createItem(food,id),createItem(food,id)]};c=setCondition(c,id,{bleeding:true});c=setResource(c,id,'hp_max',10);c=useItem(c,bandage.id,id);expect(health(c,id).remaining).toBe(10);c=useItem(c,c.items[0].id,id);expect(health(c,id).remaining).toBe(12);expect(()=>useItem(c,c.items[0].id,id)).toThrow('повторно');c=sleep(c,[id]);expect(health(c,id).remaining).toBe(20);expect(useItem(c,c.items[0].id,id).items).toHaveLength(0);
});
test('стрельба: равенство попадает, прицел тратится, боезапас конечен и перезарядка из запаса',()=>{
 let eq=equip(fixture(2),6),c=battle(eq.c);c={...c,characters:c.characters.map((ch,i)=>i?{...ch,values:{...ch.values,armor:2}}:ch)};let ix=0;const vals=[5,6,9];const i={...attackInput(c,eq.item.id),mode:'ranged' as const,reaction:'none' as const};let p=previewAttack(c,i,()=>vals[ix++]);const r=calculateAttack(p,i,p.pendingAttack!.rolls);expect(r.attack).toBe(r.defense);expect(r.hit).toBe(true);expect(r.damage).toBe(10);c=applyAttack(p);expect(c.items[0].charges).toBe(5);expect(()=>reload(c,ids(c)[0],eq.item.id)).toThrow('патрон');
 const ammo=createItem(prisonCatalog().find(t=>t.id===catalogId(50))!,ids(c)[0]);c={...c,items:[...c.items,ammo]};c=reload(c,ids(c)[0],eq.item.id);expect(c.items[0].charges).toBe(6);expect(c.items[1].charges).toBe(5);c=aim(c,ids(c)[0]);expect(condition(c,ids(c)[0]).aim).toBe(true);c=applyAttack(previewAttack(c,i,one));expect(condition(c,ids(c)[0]).aim).toBe(false);
});
test('обычные атаки имеют0/−3/−6; быстрый кулак раз/ход; оглушающий не увеличивает счётчик',()=>{
 let c=battle(fixture(2)),i=attackInput(c),p=previewAttack(c,i,six);const first=calculateAttack(p,i,p.pendingAttack!.rolls).attack;c=applyAttack(p);p=previewAttack(c,i,six);expect(calculateAttack(p,i,p.pendingAttack!.rolls).attack).toBe(first-3);c=applyAttack(p);
 c=applyAttack(previewAttack(c,{...i,variant:'quick'},six));expect(condition(c,ids(c)[0]).quickUsed).toBe(true);expect(()=>previewAttack(c,{...i,variant:'quick'},one)).toThrow('раз за ход');
 const eq=equip(fixture(2),2);c=battle(eq.c);const stun={...attackInput(c,eq.item.id),variant:'stun' as const};let ix=0;const vals=[11,11,0,0,5,0,0];c=applyAttack(previewAttack(c,stun,()=>vals[ix++]??0));expect(condition(c,ids(c)[0]).attacks).toBe(0);expect(condition(c,ids(c)[1]).stunned).toBe(true);expect(()=>previewAttack(c,stun,one)).toThrow('попытка');c=nextTurn(c);expect(c.characters[1].resources.ap_max).toBe(6);
});
test('манёвры ограничены по цели и ходу; успешное обезоруживание сохраняет предмет на карте',()=>{
 let eq=equip(fixture(2),6,1),c=battle(eq.c),ix=0;c=maneuver(c,ids(c)[0],ids(c)[1],'disarm','strength',()=>[11,11,0,0][ix++]);expect(c.items[0]).toMatchObject({ownerId:null,equipped:false,charges:6});expect(c.items[0].ground?.mapId).toBe(c.maps[0].id);expect(condition(c,ids(c)[0]).attacks).toBe(0);expect(()=>maneuver(c,ids(c)[0],ids(c)[1],'disarm')).toThrow('попытка');
});
test('короткий крафт: реальные компоненты, прогресс, пауза и единственный результат',()=>{
 let c=fixture(1),id=ids(c)[0];c=installCatalog(c);const cloth=createItem(prisonCatalog().find(t=>t.id===catalogId(30))!,id);c={...c,items:[cloth]};c=startCraft(c,id,'bandage',[cloth.id],false);expect(c.items).toHaveLength(0);c=advanceCraftTime(c,60);expect(c.prison.projects[0].remainingSeconds).toBe(60);c=setProjectActive(c,c.prison.projects[0].id,false);c=advanceCraftTime(c,120);expect(c.prison.projects[0].remainingSeconds).toBe(60);c=setProjectActive(c,c.prison.projects[0].id,true);c=advanceCraftTime(c,60);expect(c.items).toHaveLength(1);expect(c.items[0].template.mechanics?.treatment).toBe('bandage');expect(c.prison.projects).toHaveLength(0);expect(advanceCraftTime(c,120).items).toHaveLength(1);
});
test('крафт отвергает чужие/повторённые материалы и недоступные средства',()=>{
 let c=fixture(2);const wood=createItem(prisonCatalog().find(t=>t.id===catalogId(32))!,ids(c)[0]);c={...c,items:[wood]};expect(()=>startCraft(c,ids(c)[1],'lightClub',[wood.id],false)).toThrow('инвентаре');expect(()=>startCraft(c,ids(c)[0],'club',[wood.id],false)).toThrow('инструмент');expect(()=>startCraft(c,ids(c)[0],'lightClub',[wood.id,wood.id],false)).toThrow('дважды');expect(c.items).toHaveLength(1);
});
test('сюжетный опыт без повторов, повышение с выбором характеристики, навык5 и приростHP',()=>{
 let c=fixture(1),id=ids(c)[0];c=awardStoryXP(c,'plan','Найден путь',115,[id]);expect(c.characters[0].values.level).toBe(1);expect(levelFromXP(c.characters[0].experience!)).toBe(6);expect(()=>awardStoryXP(c,'plan','Повтор',10,[id])).toThrow('уже');
 for(let n=2;n<=6;n++)c=levelUp(c,id,'strength',n===5?'Взлом':undefined);expect(c.characters[0].values.level).toBe(6);expect(c.characters[0].values.strength).toBe(12);expect(health(c,id).maximum).toBe(30);expect(health(c,id).remaining).toBe(30);expect(c.characters[0].prisonProfile?.skills).toContain('Взлом');
});
test('обычная проверка использует полную характеристику, > и два полных броска',()=>{
 const c=fixture(1),id=ids(c)[0];let ix=0;const n=check(c,id,'strength',20,'advantage',0,false,()=>[0,0,5,6][ix++]);expect(n.prison.checks[0].total).toBe(20);expect(n.prison.checks[0].success).toBe(false);expect(n.diceRolls).toHaveLength(2);expect(c.diceRolls).toHaveLength(0);
});
test('лазание/лестница учитывают полный маршрут, падение игнорирует броню',()=>{
 let c=fixture(1),m=c.maps[0];c={...c,maps:[{...m,annotations:[{id:crypto.randomUUID(),kind:'elevation',name:'Площадка',visible:true,from:{x:200,y:100},to:{x:300,y:200},heightMeters:2,travel:'climb'}]}]};let moved=moveWithPath(c,c.tokens[0].id,2,1,true);expect(moved.cost).toBe(5);const ladder={...c,maps:c.maps.map(m=>({...m,annotations:m.annotations.map(a=>a.kind==='elevation'?{...a,travel:'ladder' as const}:a)}))};expect(moveWithPath(ladder,c.tokens[0].id,2,1,true).cost).toBe(3);
 c={...c,characters:c.characters.map(ch=>({...ch,values:{...ch.values,armor:100}}))};const fallen=applyFall(c,ids(c)[0],6,six);expect(health(fallen,ids(c)[0]).remaining).toBe(8);expect(health(applyFall(c,ids(c)[0],2,six),ids(c)[0]).remaining).toBe(20);
});
test('преграда хранит дроби и длинная стена получает только локальный пролом',()=>{
 let c=fixture(1),m=c.maps[0],id=crypto.randomUUID();const wall={id,kind:'wall' as const,name:'Сталь',visible:true,destructible:true,hp:1,from:{x:500,y:0},to:{x:500,y:1000},material:{resistance:25,hardness:12,fracture:.1}};
 c={...c,maps:[{...m,annotations:[wall]}]};c=damageBarrier(c,m.id,id,.2,{x:500,y:500});expect(c.maps[0].annotations).toHaveLength(3);expect(c.maps[0].annotations.find(a=>a.id===id)).toMatchObject({hp:.8});c=damageBarrier(c,m.id,id,.8,{x:500,y:500});expect(c.maps[0].annotations).toHaveLength(2);expect(barrierImpact(wall,13).damage).toBeCloseTo(.1);
});
test('туман войны: стены закрывают людей и свет; открытая дверь меняет обзор; память не раскрываетNPC',()=>{
 let c=fixture(2),m=c.maps[0],id=crypto.randomUUID();const wall={id,kind:'wall' as const,name:'Дверь',visible:true,door:true,open:false,destructible:false,hp:12,from:{x:200,y:0},to:{x:200,y:1000}};c={...c,maps:[{...m,annotations:[wall]}]};let v=vision(c,c.maps[0],ids(c)[0]);expect(tokenVisible(v,c.maps[0],c.tokens[1])).toBe(false);c=toggleDoor(c,ids(c)[0],id);v=vision(c,c.maps[0],ids(c)[0]);expect(tokenVisible(v,c.maps[0],c.tokens[1])).toBe(true);c=rememberVision(c,ids(c)[0],m.id);c=toggleDoor(c,ids(c)[0],id);v=vision(c,c.maps[0],ids(c)[0]);expect(v.explored.size).toBeGreaterThan(v.visible.size);expect(tokenVisible(v,c.maps[0],c.tokens[1])).toBe(false);
});
test('повторное вступление в независимый бой в тот же момент не возвращаетОД и не сбрасывает атаки',()=>{
 let c=battle(fixture(3));c=applyAttack(previewAttack(c,attackInput(c),six));const actor=ids(c)[0];expect(c.characters[0].resources.ap_max).toBe(6);c=leaveEncounter(c,actor);c=startEncounter(c,[{characterId:actor,initiative:30},{characterId:ids(c)[2],initiative:1}],'turn');expect(c.characters[0].resources.ap_max).toBe(6);expect(condition(c,actor).attacks).toBe(1);
});
test('положительный периодический эффект не заменяет подъём с0HP',()=>{
 let c=battle(fixture(2));const id=ids(c)[1];c=setResource(c,id,'hp_max',0);c={...c,effects:[{id:crypto.randomUUID(),ownerId:id,name:'Лечение',modifiers:{},periodicHP:5,remainingTurns:2,encounterId:c.encounter!.id}]};c=nextTurn(c);expect(health(c,id).remaining).toBe(0);
});

test('дополнительные ячейки мешка не обходят его предел 5 кг',()=>{
 let c=fixture(1);const id=ids(c)[0];c={...c,characters:c.characters.map(ch=>({...ch,values:{...ch.values,strength:20}}))};
 const bag=createItem(prisonCatalog().find(t=>t.id===catalogId(13))!,id),heavy=prisonCatalog().find(t=>t.id===catalogId(30))!;
 c={...c,items:[bag,...Array.from({length:5},()=>{const i=createItem(heavy,id);return {...i,template:{...i.template,mechanics:{...i.template.mechanics!,weight:6}}};})]};
 expect(carrySummary(c,id).weight).toBeLessThan(carrySummary(c,id).limit);expect(carrySummary(c,id).valid).toBe(false);
 c={...c,items:c.items.map((item,index)=>index===5?{...item,template:{...item.template,mechanics:{...item.template.mechanics!,weight:4}}}:item)};expect(carrySummary(c,id).valid).toBe(true);
});

test('исследование не ограничивается 8 ОД даже в старом сохранении с ручным режимом и нулём ОД',()=>{
 let c=fixture(1);c={...c,maps:c.maps.map(m=>({...m,width:4000})),session:{started:true,tacticalMovement:true}};c=setResource(c,ids(c)[0],'ap_max',0);
 expect(movementPolicy(c,ids(c)[0]).spend).toBe(false);
 const moved=moveWithPath(c,c.tokens[0].id,20,1,true);expect(moved.cost).toBe(19);expect(moved.campaign.tokens[0].column).toBe(20);expect(moved.campaign.characters[0].resources.ap_max).toBe(0);
});
test('ОД ограничивают только участника боя, а завершение возвращает свободное движение без лечения ресурсов',()=>{
 let c=fixture(3);c={...c,maps:c.maps.map(m=>({...m,width:4000})),session:{started:true,tacticalMovement:true}};c=battle(c);expect(movementPolicy(c,ids(c)[0]).spend).toBe(true);expect(movementPolicy(c,ids(c)[1]).canMove).toBe(false);
 c=moveWithPath(c,c.tokens[0].id,1,2,false).campaign;expect(c.characters[0].resources.ap_max).toBe(7);expect(()=>moveWithPath(c,c.tokens[0].id,20,2,false)).toThrow('ОД');
 const before=c.characters[2].resources.ap_max;c=moveWithPath(c,c.tokens[2].id,20,3,true).campaign;expect(c.characters[2].resources.ap_max).toBe(before);
 c=endEncounter(c);expect(c.session.tacticalMovement).toBe(false);const ap=c.characters[0].resources.ap_max;c=moveWithPath(c,c.tokens[0].id,20,2,true).campaign;expect(c.characters[0].resources.ap_max).toBe(ap);
});

test('политика игрового экрана не включает ручной расход из старого файла legacy',()=>{
 let c=fixture(1);c={...c,maps:c.maps.map(m=>({...m,width:4000})),gameplay:{...c.gameplay,rulesVersion:'legacy'},session:{started:true,tacticalMovement:true}};c=setResource(c,ids(c)[0],'ap_max',0);
 expect(movementPolicy(c,ids(c)[0]).spend).toBe(false);const moved=moveWithPath(c,c.tokens[0].id,20,1,false);expect(moved.campaign.characters[0].resources.ap_max).toBe(0);expect(moved.campaign.tokens[0].column).toBe(20);
});
