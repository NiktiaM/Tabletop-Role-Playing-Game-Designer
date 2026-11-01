import {expect,test} from 'vitest';
import {parseFormula,evaluateFormula} from '../src/domain/rules/formula.js';
import {evaluateStats} from '../src/domain/rules/evaluate.js';
import {emptyRuleset,rulesetSchema} from '../src/shared/rules.js';
import {createCampaign,parseCampaign} from '../src/shared/campaign.js';
const rules={...emptyRuleset(),stats:[
 {key:'body',name:'Тело',kind:'base' as const,defaultValue:5},
 {key:'level',name:'Уровень',kind:'base' as const,defaultValue:1},
 {key:'hp',name:'Максимум',kind:'derived' as const,formula:'(body + level) * 2'},
 {key:'bonus',name:'Бонус',kind:'derived' as const,formula:'if(hp >= 20 && body > 0, ceil(body / 4), 0)'},
]};
test('расчёт зависимостей и объяснение используют значения персонажа и умолчания',()=>{
 const trace=evaluateStats(rules,{body:10});
 expect(trace.find(row=>row.key==='hp')?.value).toBe(22);
 expect(trace.find(row=>row.key==='bonus')?.value).toBe(3);
 expect(trace.find(row=>row.key==='hp')?.explanation).toContain('body=10, level=1');
 expect(evaluateStats(rules,{}).find(row=>row.key==='hp')?.value).toBe(12);
});
test('приоритеты, округление, условия и ленивые ветви работают без выполнения кода',()=>{
 const value=(s:string)=>evaluateFormula(parseFormula(s),()=>{throw new Error('Неизвестная ссылка');});
 expect(value('2 + 3 * 4')).toBe(14);expect(value('-(2+3)')).toBe(-5);
 expect(value('max(2, min(8, 7), abs(-9)) + floor(2.8)')).toBe(11);
 expect(value('if(1, 7, 1/0)')).toBe(7);expect(value('0 && 1/0')).toBe(0);expect(value('1 || 1/0')).toBe(1);
 expect(value('!(2 < 3)')).toBe(0);expect(()=>value('1/0')).toThrow('ноль');expect(()=>value('1000000000 * 1000000000')).toThrow('диапазон');
});
test('неизвестные ссылки, циклы, дубли и небезопасный синтаксис отклоняются',()=>{
 for(const formula of ['window.alert(1)','constructor(1)','body[0]','body;1','(()=>1)()','2d12','min(1)','ceil(1,2)','1 +', '('.repeat(40)+'1'+')'.repeat(40)])expect(()=>parseFormula(formula)).toThrow();
 expect(rulesetSchema.safeParse({...rules,stats:[...rules.stats,{key:'unknown',name:'Ошибка',kind:'derived',formula:'missing+1'}]}).success).toBe(false);
 expect(rulesetSchema.safeParse({...rules,stats:[{key:'x',name:'X',kind:'derived',formula:'y'},{key:'y',name:'Y',kind:'derived',formula:'x'}]}).success).toBe(false);
 expect(rulesetSchema.safeParse({...rules,stats:[rules.stats[0],rules.stats[0]]}).success).toBe(false);
 expect(rulesetSchema.safeParse({...rules,stats:[{key:'constructor',name:'Ошибка',kind:'base',defaultValue:0}]}).success).toBe(false);
});
test('правила и исходные значения восстанавливаются, старой партии добавляется пустой снимок',()=>{
 const c=createCampaign('Расчёт');const id=crypto.randomUUID();
 const next={...c,ruleset:rules,characters:[{id,name:'Герой',kind:'character',footprint:{width:1,height:1},portrait:null,values:{body:10}}]};
 const reopened=parseCampaign(JSON.parse(JSON.stringify(next)));expect(reopened.ruleset).toEqual(rules);expect(reopened.characters[0].values).toEqual({body:10});
 expect(evaluateStats(reopened.ruleset,reopened.characters[0].values).find(row=>row.key==='hp')?.value).toBe(22);
 const {ruleset,...old}=c;const migrated=parseCampaign({...old,schemaVersion:6});expect(migrated.ruleset.stats).toEqual([]);expect(migrated.schemaVersion).toBe(10);
 const other=createCampaign('Другая');expect(other.ruleset.id).not.toBe(c.ruleset.id);expect(other.ruleset.stats.some(stat=>stat.key==='hp_max')).toBe(true);
});
