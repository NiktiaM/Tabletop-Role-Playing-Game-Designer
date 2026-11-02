import {z} from 'zod';
import {parseFormula,references,type Expr} from '../domain/rules/formula.js';
export const statKey=z.string().regex(/^[a-z][a-z0-9_]{0,31}$/).refine(key=>!['constructor','prototype','__proto__','ceil','floor','abs','min','max','if'].includes(key),'Недопустимый ключ показателя');
const base={key:statKey,name:z.string().trim().min(1).max(80)};
export const statSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('base'),defaultValue:z.number().finite().min(-1e9).max(1e9)}).strict(),
 z.object({...base,kind:z.literal('derived'),formula:z.string().min(1).max(512)}).strict(),
]);
export type StatDefinition=z.infer<typeof statSchema>;
export function compileStats(stats:StatDefinition[]):Map<string,Expr>{
 const keys=new Set(stats.map(stat=>stat.key));if(keys.size!==stats.length)throw new Error('Ключи показателей должны быть уникальны');
 const formulas=new Map<string,Expr>();
 for(const stat of stats)if(stat.kind==='derived'){
  let ast:Expr;try{ast=parseFormula(stat.formula);}catch(error){throw new Error(`${stat.name}: ${error instanceof Error?error.message:'Неверная формула'}`);}
  for(const ref of references(ast))if(!keys.has(ref))throw new Error(`${stat.name}: неизвестный показатель ${ref}`);
  formulas.set(stat.key,ast);
 }
 const visited=new Set<string>(),active=new Set<string>();
 function visit(key:string){if(active.has(key))throw new Error(`Циклическая зависимость: ${key}`);if(visited.has(key))return;active.add(key);const ast=formulas.get(key);if(ast)for(const ref of references(ast))visit(ref);active.delete(key);visited.add(key);}
 for(const key of keys)visit(key);return formulas;
}
export const defaultMovement=()=>({budgetStat:null as string|null,mode:'meters' as 'meters'|'cells',diagonal:true});
export const movementSchema=z.object({budgetStat:statKey.nullable(),mode:z.enum(['meters','cells']),diagonal:z.boolean()}).strict();
export const rulesetSchema=z.object({id:z.uuid(),name:z.string().trim().min(1).max(120),revision:z.number().int().min(1).max(1000000),engineVersion:z.literal(1),npcXpFormula:z.string().min(1).max(512).default('100 * level'),healthStat:statKey.nullable().optional(),initiativeStat:statKey.nullable().optional(),movement:movementSchema.default(defaultMovement),stats:z.array(statSchema).max(64)}).strict().superRefine((rules,ctx)=>{
 if(rules.initiativeStat&&!rules.stats.some(stat=>stat.key===rules.initiativeStat))ctx.addIssue({code:'custom',message:'Характеристика инициативы не найдена'});
 if(rules.healthStat&&!rules.stats.some(stat=>stat.key===rules.healthStat))ctx.addIssue({code:'custom',message:'Показатель максимума HP не найден'});
 if(rules.movement.budgetStat&&!rules.stats.some(stat=>stat.key===rules.movement.budgetStat))ctx.addIssue({code:'custom',message:'Источник бюджета движения не найден среди показателей'});
 try{const ast=parseFormula(rules.npcXpFormula);if(references(ast).some(key=>key!=='level'))throw new Error('В формуле опыта доступен только level');}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Неверная формула опыта'});}
 try{compileStats(rules.stats);}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Неверные правила'});}
}).transform(rules=>({...rules,initiativeStat:rules.initiativeStat===undefined?(rules.stats.some(stat=>stat.key==='dexterity')?'dexterity':null):rules.initiativeStat,healthStat:rules.healthStat===undefined?(rules.movement.budgetStat!=='hp_max'&&rules.stats.some(stat=>stat.key==='hp_max')?'hp_max':null):rules.healthStat})).refine(rules=>!rules.healthStat||rules.healthStat!==rules.movement.budgetStat,'HP и ОД должны использовать разные показатели');
export type Ruleset=z.infer<typeof rulesetSchema>;
export const emptyRuleset=():Ruleset=>({id:crypto.randomUUID(),name:'Правила партии',revision:1,engineVersion:1,initiativeStat:null,npcXpFormula:'100 * level',healthStat:null,movement:defaultMovement(),stats:[]});
