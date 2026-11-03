import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {readFile} from 'node:fs/promises';
import {contentSchema} from '../src/shared/content.js';
import {mergeContent} from '../src/domain/content.js';
import {test,expect} from 'vitest';
import {campaignSchema,parseCampaign,defaultGrid,type Campaign,type Character} from '../src/shared/campaign.js';
import {createItem} from '../src/domain/items.js';
import {defaultMechanics} from '../src/shared/mechanics.js';
import {startEncounter,nextTurn,endEncounter} from '../src/domain/encounter.js';
import {previewAttack,applyAttack,calculateAttack,useAbility,useItem,pickupItem,awardExperience,breakWall,preserveResources,ensureCoreStats,strikeWall} from '../src/domain/game-actions.js';
import {effectiveStats} from '../src/domain/effective-stats.js';
import {resourceBudget} from '../src/domain/resources.js';
import {moveWithPath} from '../src/domain/movement-action.js';
import {reachable} from '../src/domain/movement.js';
import {emptyRuleset} from '../src/shared/rules.js';
function fixture(){
 const c=createCampaign('Полный цикл'),a:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{strength:8,dexterity:21,level:1},resources:{hp_max:12,ap_max:12}},b:Character={...a,id:crypto.randomUUID(),name:'Враг',kind:'npc',values:{strength:4,dexterity:5,armor:2,level:1},resources:{hp_max:3,ap_max:7}};
 const map={id:crypto.randomUUID(),name:'Поле',width:1000,height:1000,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
 const sword=createItem({id:crypto.randomUUID(),revision:1,name:'Меч',category:'weapon',description:'',damageDice:'1d6',maxDurability:10,maxCharges:3,image:null,mechanics:{...defaultMechanics(),rangeMeters:2}},a.id);sword.equipped=true;
 const counter=createItem({...sword.template,id:crypto.randomUUID(),name:'Кинжал',damageDice:'1d4'},b.id);counter.equipped=true;
 const source={...c,session:{started:true,tacticalMovement:false},characters:[a,b],maps:[map],view:{activeMapId:map.id,cameras:{}},tokens:[{id:crypto.randomUUID(),characterId:a.id,mapId:map.id,column:1,row:1},{id:crypto.randomUUID(),characterId:b.id,mapId:map.id,column:2,row:1}],items:[sword,counter]};
 const battle=startEncounter(source,[{characterId:a.id,initiative:20},{characterId:b.id,initiative:10}],'manual');
 return {c:battle,a,b,sword,map,input:{actorTokenId:battle.tokens[0].id,targetTokenId:battle.tokens[1].id,weaponId:sword.id,mode:'melee' as const,reaction:'none' as const}};
}
const six=()=>5;
test('атака: расчёт не тратит ресурсы, применение атомарно и не повторяется, состояние устаревает',()=>{
 const {c,input}=fixture(),before=structuredClone(c),preview=previewAttack(c,input,six);expect(preview.characters).toEqual(c.characters);expect(preview.items).toEqual(c.items);expect(preview.diceRolls).toHaveLength(3);
 const result=calculateAttack(preview,input,preview.pendingAttack!.rolls);expect(result.damage).toBe(8);
 const applied=applyAttack(preview);expect(applied.characters[0].resources.ap_max).toBe(10);expect(applied.characters[1].resources.hp_max).toBe(0);expect(applied.items[0].charges).toBe(2);expect(applied.pendingAttack).toBeNull();expect(()=>applyAttack(applied)).toThrow('Нет расчёта');
 const changed={...preview,characters:preview.characters.map((ch,i)=>i?ch:{...ch,resources:{...ch.resources,ap_max:9}})};expect(()=>applyAttack(changed)).toThrow('Состояние изменилось');expect(()=>nextTurn(preview)).toThrow('расчёт');expect(c).toEqual(before);
 const reopened=applyAttack(parseCampaign(JSON.parse(JSON.stringify(preview))));expect({...reopened,events:applied.events}).toEqual(applied);
});
test('реакции, броня и контратака используют сохранённые кости и оплачиваются даже при неудаче',()=>{
 const {c,input}=fixture();let index=0;const values=[0,0,11,11,0,3];const block=previewAttack(c,{...input,reaction:'block'},()=>values[index++]);const applied=applyAttack(block);expect(applied.characters[1].resources.hp_max).toBe(3);expect(applied.characters[1].resources.ap_max).toBe(5);
 index=0;const counter=previewAttack(c,{...input,reaction:'counter'},()=>values[index++]??3);const result=applyAttack(counter);expect(result.characters[0].resources.hp_max).toBe(7);expect(result.characters[1].resources.hp_max).toBe(3);
 index=0;const absorbing={...c,gameplay:{...c.gameplay,armorAbsorbs:true},characters:c.characters.map((ch,n)=>n?ch:{...ch,values:{...ch.values,armor:100}})},absorbed=applyAttack(previewAttack(absorbing,{...input,reaction:'counter'},()=>values[index++]??3));expect(absorbed.characters[0].resources.hp_max).toBe(12);expect(absorbed.items[1].charges).toBe(2);
 const armored=previewAttack({...c,gameplay:{...c.gameplay,armorAbsorbs:true}},input,six);expect(calculateAttack(armored,input,armored.pendingAttack!.rolls).damage).toBe(6);
 const failed=applyAttack(previewAttack(c,{...input,reaction:'dodge'},six));expect(failed.characters[1].resources.ap_max).toBe(6);expect(failed.characters[1].resources.hp_max).toBe(0);
});
test('дальность, стена, темнота и экипировка отвергают атаку до применения',()=>{
 const {c,input,map}=fixture();const wall={id:crypto.randomUUID(),kind:'wall' as const,name:'Стена',visible:false,destructible:true,hp:2,from:{x:200,y:0},to:{x:200,y:500}};
 expect(()=>previewAttack({...c,maps:[{...map,annotations:[wall]}]},input,six)).toThrow('не видна');
 expect(()=>previewAttack({...c,gameplay:{...c.gameplay,ambientLight:false}},input,six)).toThrow('не видна');
 expect(()=>previewAttack({...c,tokens:c.tokens.map((t,i)=>i?{...t,column:5}:t)},input,six)).toThrow('дальности');
 expect(()=>previewAttack({...c,items:c.items.map((i,n)=>n?i:{...i,equipped:false})},input,six)).toThrow('экипированное');
 const dark={...c,gameplay:{...c.gameplay,ambientLight:false},maps:[{...map,annotations:[{id:crypto.randomUUID(),kind:'light' as const,name:'Свет',visible:false,center:{x:250,y:150},radius:100}]}]};expect(previewAttack(dark,input,six).pendingAttack).not.toBeNull();
 const struck=strikeWall({...c,maps:[{...map,annotations:[wall]}]},c.characters[0].id,input.weaponId,wall.id,six);expect(struck.maps[0].annotations).toHaveLength(0);expect(struck.characters[0].resources.ap_max).toBe(10);
 const broken=breakWall({...c,maps:[{...map,annotations:[wall]}]},wall.id,2);expect(broken.maps[0].annotations).toHaveLength(0);expect(previewAttack(broken,input,six).pendingAttack).not.toBeNull();
});
test('стрельба учитывает укрытие и высоту, бросает только проверку и урон',()=>{
 const {c,input,map}=fixture(),ranged={...c,items:c.items.map((i,n)=>n?i:{...i,template:{...i.template,mechanics:{...defaultMechanics(),attackType:'ranged' as const,rangeMeters:30}}}),tokens:c.tokens.map((t,i)=>i?{...t,column:8}:t),maps:[{...map,annotations:[{id:crypto.randomUUID(),kind:'cover' as const,name:'Укрытие',visible:false,from:{x:800,y:100},to:{x:900,y:200},level:'medium' as const},{id:crypto.randomUUID(),kind:'elevation' as const,name:'Высота',visible:false,from:{x:100,y:100},to:{x:200,y:200},heightMeters:3}]}]};
 const preview=previewAttack(ranged,{...input,mode:'ranged'},six),result=calculateAttack(preview,{...input,mode:'ranged'},preview.pendingAttack!.rolls);expect(preview.diceRolls).toHaveLength(2);expect(result.defense).toBe(16);expect(result.attack).toBe(35);const scaled={...ranged,maps:ranged.maps.map(m=>({...m,grid:{...m.grid,metersPerCell:2}}))},meters={...scaled,gameplay:{...scaled.gameplay,rangedDistanceUnit:'meters' as const}},previewMeters=previewAttack(meters,{...input,mode:'ranged'},six);expect(calculateAttack(previewMeters,{...input,mode:'ranged'},previewMeters.pendingAttack!.rolls).defense).toBe(18);
});
test('способность тратит ОД/лимит, эффект на цели доживает до конца её хода и не лечит от бонуса HP',()=>{
 const {c,a,b}=fixture(),definition={id:crypto.randomUUID(),revision:1,name:'Ослабление',description:'',costText:'',maxUses:2,mechanics:{...defaultMechanics(),apCost:2,rangeMeters:3,modifiers:{strength:-2},durationTurns:1,periodicHP:-1}},ability={id:crypto.randomUUID(),ownerId:a.id,definition,usesRemaining:2};
 const used=useAbility({...c,abilities:[ability]},ability.id,b.id);expect(used.characters[0].resources.ap_max).toBe(10);expect(used.abilities[0].usesRemaining).toBe(1);expect(effectiveStats(used,used.characters[1]).find(s=>s.key==='strength')?.value).toBe(2);
 const theirTurn=nextTurn(used);expect(theirTurn.effects).toHaveLength(1);const expired=nextTurn(theirTurn);expect(expired.effects).toHaveLength(0);expect(expired.characters[1].resources.hp_max).toBe(2);
 const buff={...ability,definition:{...definition,mechanics:{...defaultMechanics(),modifiers:{hp_max:5}}}},buffed=useAbility({...c,abilities:[buff]},buff.id,a.id);expect(resourceBudget(buffed,buffed.characters[0],'hp_max')).toMatchObject({maximum:17,remaining:12});expect(endEncounter(buffed).effects).toHaveLength(0);
});
test('экипировка изменяет формулы, не восполняет HP; расходники тратят заряды и не применяются бесконечно',()=>{
 const {c,a,sword}=fixture(),gear={...sword,id:crypto.randomUUID(),template:{...sword.template,category:'armor' as const,mechanics:{...defaultMechanics(),modifiers:{constitution:1}}}};
 const equipped=preserveResources(c,{...c,items:[...c.items,gear]});expect(resourceBudget(equipped,equipped.characters[0],'hp_max')).toMatchObject({maximum:14,remaining:12});
 const potion=createItem({...sword.template,id:crypto.randomUUID(),category:'consumable',name:'Зелье',maxCharges:1,mechanics:{...defaultMechanics(),apCost:1,hpChange:4}},a.id),hurt={...c,characters:c.characters.map((ch,i)=>i?ch:{...ch,resources:{...ch.resources,hp_max:5}}),items:[...c.items,potion]},used=useItem(hurt,potion.id,a.id);
 expect(used.characters[0].resources).toMatchObject({hp_max:9,ap_max:11});expect(used.items.at(-1)?.charges).toBe(0);expect(()=>useItem(used,potion.id,a.id)).toThrow('Заряды');
});
test('подбор требует расстояние, видимость и ОД и сохраняет тот же экземпляр',()=>{
 const {c,a,sword,map}=fixture(),ground={...sword,id:crypto.randomUUID(),ownerId:null,equipped:false,ground:{mapId:map.id,column:2,row:1}},source={...c,items:[...c.items,ground]};
 const picked=pickupItem(source,ground.id,a.id);expect(picked.items.at(-1)).toMatchObject({id:ground.id,ownerId:a.id,ground:null,charges:3});expect(picked.characters[0].resources.ap_max).toBe(11);
 expect(()=>pickupItem({...source,items:[{...ground,ground:{...ground.ground,column:8}}]},ground.id,a.id)).toThrow('далеко');expect(()=>pickupItem(picked,ground.id,a.id)).toThrow('на поле');
});
test('местность влияет на путь и урон; кисть учитывается по форме, а не bounding box',()=>{
 const {c,map}=fixture(),acid={id:crypto.randomUUID(),kind:'liquid' as const,name:'Кислота',visible:false,from:{x:200,y:100},to:{x:300,y:200},liquidType:'acid' as const},source={...c,maps:[{...map,annotations:[acid]}],tokens:[c.tokens[0]]};
 const moved=moveWithPath(source,c.tokens[0].id,2,1).campaign;expect(moved.characters[0].resources.ap_max).toBe(10);expect(moved.characters[0].resources.hp_max).toBe(10);
 const high={...map,annotations:[{id:crypto.randomUUID(),kind:'elevation' as const,name:'Ступень',visible:false,from:{x:200,y:100},to:{x:300,y:200},heightMeters:2}]};expect(reachable(high,c.tokens[0],c.characters,[c.tokens[0]],2,{mode:'meters',diagonal:true,terrain:c.gameplay.terrain}).cells.has('2,1')).toBe(false);
});
test('награда подтверждённому NPC делится без повтора, сохраняется и повышает уровень без лечения',()=>{
 const {c,b}=fixture(),dead={...c,gameplay:{...c.gameplay,xpPerLevel:10},characters:c.characters.map(ch=>ch.id===b.id?{...ch,resources:{...ch.resources,hp_max:0}}:ch)},reward=awardExperience(dead,b.id,[c.characters[0].id]);
 expect(nextTurn(reward).encounter?.participants[nextTurn(reward).encounter!.turnIndex].characterId).toBe(c.characters[0].id);expect(reward.characters[0].experience).toBe(100);expect(reward.characters[0].values.level).toBe(5);expect(reward.characters[0].resources.hp_max).toBe(12);expect(()=>awardExperience(reward,b.id,[c.characters[0].id])).toThrow('уже');expect(()=>awardExperience(c,b.id,[c.characters[0].id])).toThrow('0 HP');expect(parseCampaign(JSON.parse(JSON.stringify(reward)))).toEqual(reward);
 expect(campaignSchema.safeParse({...reward,xpAwards:[...reward.xpAwards,...reward.xpAwards]}).success).toBe(false);
});
test('восстановление отсутствующих характеристик сохраняет старые значения и данные v16',()=>{
 const {c}=fixture(),restored=ensureCoreStats({...c,ruleset:emptyRuleset()});expect(restored.ruleset.stats.some(s=>s.key==='strength')).toBe(true);expect(restored.characters).toEqual(c.characters);
 const {gameplay,effects,pendingAttack,xpAwards,events,...old}=c;const migrated=parseCampaign({...old,schemaVersion:16});expect(migrated.effects).toEqual([]);expect(migrated.characters).toEqual(c.characters);expect(migrated.pendingAttack).toBeNull();
});

test('поставляемый пример игрового контента импортируется с применением и бонусами',async()=>{
 const pack=contentSchema.parse(JSON.parse(await readFile(new URL('../examples/gameplay-content.json',import.meta.url),'utf8'))),c=mergeContent(createCampaign('Пример'),pack);
 expect(c.characters).toHaveLength(2);expect(c.itemTemplates).toHaveLength(3);expect(c.itemTemplates.find(t=>t.category==='consumable')?.mechanics).toMatchObject({apCost:1,dice:'1d4',hpChange:2});expect(c.itemTemplates.find(t=>t.name==='Учебный меч')?.mechanics?.modifiers.strength).toBe(1);
});
