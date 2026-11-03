import {emptyRuleset,type Ruleset} from '../../shared/rules.js';
export function rPrisonLegacyDraft():Ruleset {
 return {...emptyRuleset(),name:'R Prison v1.1 — черновик',healthStat:'hp_max',initiativeStat:'dexterity',movement:{budgetStat:'ap_max',mode:'meters',diagonal:true},stats:[
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
export const rPrisonLegacyExamples:FormulaExample[]=[
 {name:'Урон ближним оружием',formula:'weapon_roll + ceil(strength / 4)',inputs:[{key:'weapon_roll',name:'Выпавший урон оружия',value:4},{key:'strength',name:'Сила',value:5}],note:'Введите результат костей оружия. Пример: 4 + ceil(5/4) = 6. Броня здесь не вычитается: её действие в документах противоречиво.'},
 {name:'Урон дальним оружием',formula:'weapon_roll + ceil(dexterity / 4)',inputs:[{key:'weapon_roll',name:'Выпавший урон оружия',value:4},{key:'dexterity',name:'Ловкость',value:5}],note:'Вводится уже выпавшая сумма костей оружия. Кости пока не бросаются автоматически.'},
 {name:'Попадание в ближнем бою',formula:'attack_roll + strength > defense_roll + dexterity',inputs:[{key:'attack_roll',name:'2d12 атакующего (сумма)',value:13},{key:'strength',name:'Сила атакующего',value:5},{key:'defense_roll',name:'2d12 защитника (сумма)',value:12},{key:'dexterity',name:'Ловкость защитника',value:5}],note:'1 — атакующий выиграл, 0 — нет. При победе защитника выбирается реакция: уклонение 1 ОД, блок 2 ОД, контратака 2 ОД. При ничьей урона нет, стоимость для защитника пока не определена. Ноль сам по себе не означает автоматический блок.'},
 {name:'Попадание в дальнем бою',formula:'attack_roll + dexterity >= 10 + distance_modifier + cover_modifier',inputs:[{key:'attack_roll',name:'2d12 атакующего (сумма)',value:13},{key:'dexterity',name:'Ловкость',value:5},{key:'distance_modifier',name:'Штраф расстояния',value:0},{key:'cover_modifier',name:'Штраф укрытия',value:0}],note:'1 — попадание, 0 — промах. Расстояние: до 5 клеток +0, 6–10 +2, 11–15 +4; 16+ зависит от оружия. Укрытие +0/+2/+4/+6. При полном укрытии выстрел невозможен: этот калькулятор не проверяет геометрию и разрешённость выстрела.'},
];

export function rPrisonDraft():Ruleset {
 const legacy=rPrisonLegacyDraft();
 return {...legacy,name:'Prison 0.3 — Лейквью, 1984',npcXpFormula:'if(level < 3, 3, if(level < 6, 7, 15))',stats:legacy.stats.map(s=>s.key==='constitution'?{...s,name:'Выносливость'}:s.kind==='derived'?{...s,formula:s.key==='hp_max'?'10 + 2 * constitution + 2 * (level - 1)':s.key==='ap_max'?'8':s.key==='melee_bonus'?'ceil(strength / 3)':s.key==='ranged_bonus'?'ceil(dexterity / 3)':s.formula}:s)};
}

export const rPrisonExamples:FormulaExample[]=[
 {name:'Обычная проверка',formula:'roll + attribute > threshold',inputs:[{key:'roll',name:'Сумма2d12',value:13},{key:'attribute',name:'Характеристика',value:8},{key:'threshold',name:'Порог',value:20}],note:'Равенство — неудача. Ориентиры16/20/24/29.'},
 {name:'Ближнее попадание',formula:'attack_roll + ceil(strength / 3) > defense_roll + ceil(dexterity / 3) + 2',inputs:[{key:'attack_roll',name:'2d12атаки',value:14},{key:'strength',name:'Сила',value:8},{key:'defense_roll',name:'2d12защиты',value:12},{key:'dexterity',name:'Ловкостьцели',value:5}],note:'Пример против уклонения. Блок и контратака имеют свои бонусы.'},
 {name:'Урон после брони',formula:'max(0, weapon_roll + ceil(strength / 3) - armor)',inputs:[{key:'weapon_roll',name:'Костиоружия',value:4},{key:'strength',name:'Сила',value:8},{key:'armor',name:'Броняцели',value:2}],note:'Броня не увеличивает максимумHP.'},
 {name:'Падение',formula:'max(0, ceil(height / 2) - 1)',inputs:[{key:'height',name:'Высота,м',value:6}],note:'Результат — числоd6 урона; броня не вычитается.'},
];
