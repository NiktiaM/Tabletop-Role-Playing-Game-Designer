import {z} from 'zod';
import {statKey} from './rules.js';
export const diceText=z.string().max(20).regex(/^(?:[1-9]|[1-9][0-9])d(?:[2-9]|[1-9][0-9]{1,2}|1000)(?:[+-][0-9]{1,4})?$/);
export const modifiersSchema=z.record(statKey,z.number().finite().min(-10000).max(10000)).refine(v=>Object.keys(v).length<=64);
export const mechanicsSchema=z.object({apCost:z.number().min(0).max(10000).default(0),hpCost:z.number().min(0).max(10000).default(0),hpChange:z.number().min(-1000000).max(1000000).default(0),dice:diceText.nullable().default(null),harmful:z.boolean().default(false),rangeMeters:z.number().min(0).max(10000).default(1.5),durationTurns:z.number().int().min(1).max(1000).default(1),modifiers:modifiersSchema.default({}),periodicHP:z.number().min(-1000000).max(1000000).default(0),wearPerUse:z.number().int().min(0).max(10000).default(0),attackType:z.enum(['melee','ranged']).default('melee')}).strict();
export type Mechanics=z.infer<typeof mechanicsSchema>;
export const defaultMechanics=()=>mechanicsSchema.parse({});
