import {expect,test} from 'vitest';
import {rPrisonDraft,rPrisonExamples} from '../src/domain/presets/rprison.js';
import {evaluateStats} from '../src/domain/rules/evaluate.js';
import {parseFormula,evaluateFormula} from '../src/domain/rules/formula.js';
import {rulesetSchema} from '../src/shared/rules.js';
test('готовый черновик v1.1 считает HP, ОД и бонусы урона',()=>{
 const rules=rPrisonDraft();expect(rulesetSchema.safeParse(rules).success).toBe(true);
 const values=new Map(evaluateStats(rules,{constitution:10,level:1,armor:2,dexterity:8,strength:12}).map(row=>[row.key,row.value]));
 expect(values.get('hp_max')).toBe(24);expect(values.get('ap_max')).toBe(8);expect(values.get('melee_bonus')).toBe(3);expect(values.get('ranged_bonus')).toBe(2);
 expect(rPrisonDraft().id).not.toBe(rules.id);
});
test('готовые калькуляторы используют тот же безопасный движок',()=>{
 const results=rPrisonExamples.map(example=>evaluateFormula(parseFormula(example.formula),key=>example.inputs.find(input=>input.key===key)!.value));
 expect(results).toEqual([6,6,1,1]);
 const melee=rPrisonExamples[2];expect(evaluateFormula(parseFormula(melee.formula),key=>({attack_roll:13,strength:5,defense_roll:13,dexterity:5})[key as 'strength'])).toBe(0);
});
