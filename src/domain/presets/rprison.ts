import {emptyRuleset,type Ruleset} from '../../shared/rules.js';
export function rPrisonDraft():Ruleset {
 return {...emptyRuleset(),name:'R Prison v1.1 — черновик',healthStat:'hp_max',movement:{budgetStat:'ap_max',mode:'meters',diagonal:true},stats:[
  {key:'strength',name:'Сила',kind:'base',defaultValue:5},
  {key:'dexterity',name:'Ловкость',kind:'base',defaultValue:5},
  {key:'constitution',name:'Телосложение',kind:'base',defaultValue:5},
  {key:'charisma',name:'Харизма',kind:'base',defaultValue:5},
  {key:'level',name:'Уровень',kind:'base',defaultValue:1},
  {key:'armor',name:'Броня',kind:'base',defaultValue:0},
  {key:'hp_max',name:'HP (максимум)',kind:'derived',formula:'(constitution + level) * 2 + armor'},
  {key:'ap_max',name:'ОД (максимум)',kind:'derived',formula:'5 + ceil(dexterity / 3)'},
  {key:'melee_bonus',name:'Бонус ближнего урона',kind:'derived',formula:'ceil(strength / 4)'},
  {key:'ranged_bonus',name:'Бонус дальнего урона',kind:'derived',formula:'ceil(dexterity / 4)'},
 ]};
}
export interface FormulaExample {name:string;formula:string;inputs:{key:string;name:string;value:number}[];note:string}
export const rPrisonExamples:FormulaExample[]=[
 {name:'Урон ближним оружием',formula:'weapon_roll + ceil(strength / 4)',inputs:[{key:'weapon_roll',name:'Выпавший урон оружия',value:4},{key:'strength',name:'Сила',value:5}],note:'Введите результат костей оружия. Пример: 4 + ceil(5/4) = 6. Броня здесь не вычитается: её действие в документах противоречиво.'},
 {name:'Урон дальним оружием',formula:'weapon_roll + ceil(dexterity / 4)',inputs:[{key:'weapon_roll',name:'Выпавший урон оружия',value:4},{key:'dexterity',name:'Ловкость',value:5}],note:'Вводится уже выпавшая сумма костей оружия. Кости пока не бросаются автоматически.'},
 {name:'Попадание в ближнем бою',formula:'attack_roll + strength > defense_roll + dexterity',inputs:[{key:'attack_roll',name:'2d12 атакующего (сумма)',value:13},{key:'strength',name:'Сила атакующего',value:5},{key:'defense_roll',name:'2d12 защитника (сумма)',value:12},{key:'dexterity',name:'Ловкость защитника',value:5}],note:'1 — атакующий выиграл, 0 — нет. При победе защитника выбирается реакция: уклонение 1 ОД, блок 2 ОД, контратака 2 ОД. При ничьей урона нет, стоимость для защитника пока не определена. Ноль сам по себе не означает автоматический блок.'},
 {name:'Попадание в дальнем бою',formula:'attack_roll + dexterity >= 10 + distance_modifier + cover_modifier',inputs:[{key:'attack_roll',name:'2d12 атакующего (сумма)',value:13},{key:'dexterity',name:'Ловкость',value:5},{key:'distance_modifier',name:'Штраф расстояния',value:0},{key:'cover_modifier',name:'Штраф укрытия',value:0}],note:'1 — попадание, 0 — промах. Расстояние: до 5 клеток +0, 6–10 +2, 11–15 +4; 16+ зависит от оружия. Укрытие +0/+2/+4/+6. При полном укрытии выстрел невозможен: этот калькулятор не проверяет геометрию и разрешённость выстрела.'},
];
