import {test,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {campaignSchema,createCampaign,defaultGrid,parseCampaign,type Character,type Campaign} from '../src/shared/campaign.js';
import {rulesetSchema} from '../src/shared/rules.js';
import {startEncounter,nextTurn,endEncounter,reorderEncounter,currentActor} from '../src/domain/encounter.js';
import {resourceBudget,setResource} from '../src/domain/resources.js';
import {moveWithPath} from '../src/domain/movement-action.js';
import {setTacticalMovement} from '../src/domain/session.js';
import {readCampaign,writeCampaign} from '../src/main/storage.js';
import {checkCompatibility} from '../src/domain/transfer.js';

function fixture():Campaign {
 const c=createCampaign('Бой'),a:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{dexterity:5},resources:{hp_max:4,ap_max:2}},b:Character={...a,id:crypto.randomUUID(),name:'NPC',kind:'npc',values:{dexterity:18},resources:{hp_max:0,ap_max:1}},outsider:Character={...a,id:crypto.randomUUID(),name:'Наблюдатель',resources:{ap_max:0}};
 const map={id:crypto.randomUUID(),name:'Поле',width:600,height:600,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
 return {...c,session:{started:true,tacticalMovement:false},characters:[a,b,outsider],maps:[map],tokens:[{id:crypto.randomUUID(),mapId:map.id,characterId:a.id,column:1,row:1},{id:crypto.randomUUID(),mapId:map.id,characterId:b.id,column:3,row:1}]};
}
const participants=(c:Campaign)=>c.characters.slice(0,2).map((character,index)=>({characterId:character.id,initiative:10-index}));

test('текущие ресурсы отделены от максимумов, ручной ввод проверяется и не меняет исходник',()=>{
 const c=fixture(),a=c.characters[0],before=structuredClone(c);
 const dead=setResource(c,a.id,'hp_max',0),fraction=setResource(dead,a.id,'ap_max',1.25);
 expect(fraction.characters[0].resources).toEqual({hp_max:0,ap_max:1.25});expect(fraction.characters[0].values).toEqual(a.values);
 expect(resourceBudget(c,a,'hp_max').maximum).toBe(12);expect(setResource(dead,a.id,'hp_max',null).characters[0].resources.hp_max).toBe(12);
 for(const value of [-1,13,NaN,Infinity])expect(()=>setResource(c,a.id,'hp_max',value)).toThrow();
 expect(()=>setResource(c,a.id,'strength',1)).toThrow();expect(()=>setResource(c,crypto.randomUUID(),'hp_max',1)).toThrow();
 expect(resourceBudget(c,{...a,resources:{}},'hp_max').remaining).toBe(12);
 expect(resourceBudget(c,{...a,resources:{hp_max:100}},'hp_max').remaining).toBe(12);
 expect(c).toEqual(before);
});

test('HP настраиваются в правилах, старый hp_max распознаётся, явное отключение сохраняется',()=>{
 const c=fixture(),{healthStat,...old}=c.ruleset;
 expect(rulesetSchema.parse(old).healthStat).toBe('hp_max');
 expect(rulesetSchema.parse({...old,movement:{...old.movement,budgetStat:'hp_max'}}).healthStat).toBeNull();
 expect(rulesetSchema.parse({...old,healthStat:null}).healthStat).toBeNull();
 expect(rulesetSchema.safeParse({...c.ruleset,healthStat:'missing'}).success).toBe(false);
 expect(rulesetSchema.safeParse({...c.ruleset,healthStat:'ap_max'}).success).toBe(false);
 expect(()=>checkCompatibility(c.ruleset,{...c.ruleset,healthStat:null})).toThrow('несовместимы');
 const negative={...c,ruleset:{...c.ruleset,stats:c.ruleset.stats.map(stat=>stat.key==='hp_max'?{...stat,kind:'derived' as const,formula:'-1'}:stat)}};
 expect(()=>setResource(negative,c.characters[0].id,'hp_max',0)).toThrow('Максимум');
});

test('начало сортирует инициативу стабильно и восстанавливает только ОД первого участника',()=>{
 const c=fixture(),before=structuredClone(c),rows=participants(c).reverse(),battle=startEncounter(c,rows,'turn');
 expect(currentActor(battle)).toBe(c.characters[0].id);expect(battle.encounter).toMatchObject({round:1,turnIndex:0,recovery:'turn'});
 expect(battle.characters.map(character=>character.resources.ap_max)).toEqual([7,1,0]);
 expect(battle.characters.map(character=>character.resources.hp_max)).toEqual([4,0,undefined]);
 expect(c).toEqual(before);expect(battle.session.tacticalMovement).toBe(true);
 const tie=rows.map(row=>({...row,initiative:5}));expect(startEncounter(c,tie,'manual').encounter?.participants).toEqual(tie);
 expect(currentActor(startEncounter(c,rows,'manual',false))).toBe(rows[0].characterId);
});

test('ходы и раунды восстанавливают нужного участника ровно при переходе, не при перестановке',()=>{
 const c=fixture(),started=startEncounter(c,participants(c),'turn'),spent=setResource(started,c.characters[0].id,'ap_max',0),second=nextTurn(spent);
 expect(second.encounter).toMatchObject({round:1,turnIndex:1});expect(second.characters.map(character=>character.resources.ap_max)).toEqual([0,11,0]);
 const exhausted=setResource(second,c.characters[1].id,'ap_max',0),reordered=reorderEncounter(exhausted,participants(c).map(row=>row.characterId).reverse());
 expect(currentActor(reordered)).toBe(c.characters[1].id);expect(reordered.characters).toEqual(exhausted.characters);
 const round=nextTurn(exhausted);expect(round.encounter).toMatchObject({round:2,turnIndex:0});expect(round.characters.map(character=>character.resources.ap_max)).toEqual([7,0,0]);
 expect(()=>reorderEncounter(round,[c.characters[0].id,c.characters[0].id])).toThrow();
});

test('восстановление по раундам и ручное не лечат HP и не затрагивают наблюдателей',()=>{
 const c=fixture(),started=startEncounter(c,participants(c),'round');
 expect(started.characters.map(character=>character.resources.ap_max)).toEqual([7,11,0]);
 const spent=setResource(setResource(started,c.characters[0].id,'ap_max',0),c.characters[1].id,'ap_max',2),second=nextTurn(spent);
 expect(second.characters).toEqual(spent.characters);const round=nextTurn(second);
 expect(round.characters.map(character=>character.resources.ap_max)).toEqual([7,11,0]);expect(round.characters.map(character=>character.resources.hp_max)).toEqual([4,0,undefined]);
 const manual=startEncounter(c,participants(c),'manual');expect(nextTurn(nextTurn(manual)).characters).toEqual(c.characters);
 const solo=startEncounter(c,[participants(c)[0]],'turn');expect(nextTurn(solo).encounter?.round).toBe(2);
});

test('только текущий участник двигается и тратит ОД; закрытие боя сохраняет состояние',()=>{
 const c=fixture(),battle=startEncounter(c,participants(c),'turn'),before=structuredClone(battle);
 expect(()=>moveWithPath(battle,c.tokens[1].id,4,1,false)).toThrow('другого участника');
 const moved=moveWithPath(battle,c.tokens[0].id,2,1,false).campaign;expect(moved.characters[0].resources.ap_max).toBe(6);
 expect(()=>setTacticalMovement(battle,false)).toThrow('Завершите');
 const ended=endEncounter(moved);expect(ended.encounter).toBeNull();expect(ended.session.tacticalMovement).toBe(false);expect(ended.characters).toEqual(moved.characters);expect(ended.tokens).toEqual(moved.tokens);
 expect(endEncounter(startEncounter({...c,session:{...c.session,tacticalMovement:true}},participants(c),'manual')).session.tacticalMovement).toBe(true);
 expect(battle).toEqual(before);
});

test('невалидное начало, ссылки, очередь и смена ОД отклоняются атомарно',()=>{
 const c=fixture(),before=structuredClone(c),rows=participants(c),battle=startEncounter(c,rows,'manual');
 for(const invalid of [[],[rows[0],rows[0]],[{...rows[0],initiative:NaN}],[{...rows[0],characterId:crypto.randomUUID()}]])expect(()=>startEncounter(c,invalid,'turn')).toThrow();
 expect(()=>startEncounter({...c,session:{started:false,tacticalMovement:false}},rows,'turn')).toThrow('начните');
 expect(()=>startEncounter(battle,rows,'turn')).toThrow('уже');expect(()=>nextTurn(c)).toThrow();
 expect(campaignSchema.safeParse({...battle,encounter:{...battle.encounter,turnIndex:2}}).success).toBe(false);
 expect(campaignSchema.safeParse({...battle,characters:[]}).success).toBe(false);
 expect(campaignSchema.safeParse({...battle,ruleset:{...battle.ruleset,movement:{...battle.ruleset.movement,budgetStat:'strength'}}}).success).toBe(false);
 const last={...battle,encounter:{...battle.encounter!,round:1000000,turnIndex:1}};expect(()=>nextTurn(last)).toThrow();
 expect(c).toEqual(before);
});

test('бой и потраченные ресурсы восстанавливаются из файла без повторного восстановления ОД',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'rprison-combat-'));
 try{
 const c=fixture(),second=nextTurn(startEncounter(c,participants(c),'turn')),spent=setResource(second,c.characters[1].id,'ap_max',0),path=join(directory,'бой.json');
 await writeCampaign(path,spent);const opened=await readCampaign(path);expect(opened).toEqual(spent);expect(currentActor(opened)).toBe(c.characters[1].id);expect(opened.characters[1].resources.ap_max).toBe(0);
 const {encounter,...old}=c,{healthStat,...oldRules}=old.ruleset;
 const migrated=parseCampaign({...old,schemaVersion:13,ruleset:oldRules});expect(migrated.encounter).toBeNull();expect(migrated.characters).toEqual(c.characters);expect(migrated.ruleset.healthStat).toBe('hp_max');
 }finally{await rm(directory,{recursive:true,force:true});}
});
