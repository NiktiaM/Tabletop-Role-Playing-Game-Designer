import {expect,test} from 'vitest';
import {createCampaign,parseCampaign,type Character} from '../src/shared/campaign.js';
import {emptyRuleset,rulesetSchema} from '../src/shared/rules.js';
import {characterLevel,npcExperience} from '../src/domain/progression.js';
import {mergeContent} from '../src/domain/content.js';
import {contentSchema} from '../src/shared/content.js';
import {exportCharacter,importCharacter} from '../src/domain/transfer.js';

const npc:Character={id:crypto.randomUUID(),name:'Страж',kind:'npc',values:{level:3},resources:{hp_max:2},portrait:null,footprint:{width:1,height:1}};
test('уровень один для карточки, формул HP и награды NPC, без изменения ресурсов',()=>{
 const c=createCampaign('Опыт'),before=structuredClone(npc);
 expect(characterLevel(npc,c.ruleset)).toBe(3);expect(npcExperience(npc,c.ruleset)).toBe(300);
 expect(npcExperience(npc,{...c.ruleset,npcXpFormula:'100 * level * level'})).toBe(900);
 expect(npcExperience({...npc,kind:'character'},c.ruleset)).toBe(0);
 expect(characterLevel({...npc,values:{}},c.ruleset)).toBe(1);
 const derived={...c.ruleset,stats:c.ruleset.stats.map(stat=>stat.key==='level'?{key:'level',name:'Уровень',kind:'derived' as const,formula:'5'}:stat)};expect(characterLevel(npc,derived)).toBe(5);expect(npcExperience(npc,derived)).toBe(500);
 expect(characterLevel(npc,emptyRuleset())).toBe(3);expect(npc).toEqual(before);
});
test('формула опыта безопасна, ошибки уровня и результата показываются без начислений',()=>{
 const rules=createCampaign('Опыт').ruleset;
 for(const formula of ['strength * 100','window.alert(1)','level; 1','eval(1)'])expect(rulesetSchema.safeParse({...rules,npcXpFormula:formula}).success).toBe(false);
 for(const level of [0,-1,1.5,1001])expect(()=>npcExperience({...npc,values:{level}},rules)).toThrow('уровень');
 for(const formula of ['-1','1 / 0','0.5','1000000001'])expect(()=>npcExperience(npc,{...rules,npcXpFormula:formula})).toThrow();
 expect(npcExperience(npc,{...rules,npcXpFormula:'0'})).toBe(0);
});
test('импорт и перенос сохраняют уровень и ресурсы, старые партии получают формулу без сброса',()=>{
 const c=createCampaign('Уровни'),source={...c,characters:[npc]},pack=exportCharacter(source,npc.id),copied=importCharacter(c,pack);
 expect(copied.characters[0].values.level).toBe(3);expect(copied.characters[0].resources).toEqual(npc.resources);
 const {id,...portable}=npc;const custom={...c,ruleset:emptyRuleset()},content=contentSchema.parse({format:'rprison-content',version:1,characters:[portable]});
 expect(mergeContent(custom,content).characters[0].values.level).toBe(3);
 const {npcXpFormula,...oldRules}=c.ruleset;
 const old=parseCampaign({...source,schemaVersion:14,ruleset:oldRules});expect(old.ruleset.npcXpFormula).toBe('100 * level');expect(old.characters).toEqual(source.characters);
 expect(parseCampaign(JSON.parse(JSON.stringify(old)))).toEqual(old);
});
