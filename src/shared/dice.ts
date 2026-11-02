import {z} from 'zod';
export const diceRollSchema=z.object({id:z.uuid(),at:z.iso.datetime(),label:z.string().min(1).max(120),count:z.number().int().min(1).max(100),sides:z.number().int().min(2).max(1000),modifier:z.number().int().min(-1000000).max(1000000),rolls:z.array(z.number().int().min(1).max(1000)).min(1).max(100),total:z.number().int().finite()}).strict().refine(r=>r.rolls.length===r.count&&r.rolls.every(v=>v<=r.sides)&&r.total===r.rolls.reduce((a,b)=>a+b,0)+r.modifier,'Неверный результат броска');
export type DiceRoll=z.infer<typeof diceRollSchema>;
