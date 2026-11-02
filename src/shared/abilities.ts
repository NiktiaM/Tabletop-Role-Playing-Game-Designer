import {mechanicsSchema} from './mechanics.js';
import {z} from 'zod';
export const abilitySchema=z.object({mechanics:mechanicsSchema.optional(),id:z.uuid(),revision:z.number().int().min(1).max(1000000),name:z.string().trim().min(1).max(120),description:z.string().max(4000),costText:z.string().max(200),maxUses:z.number().int().min(0).max(100000)}).strict();
export const assignedAbilitySchema=z.object({id:z.uuid(),ownerId:z.uuid(),definition:abilitySchema,usesRemaining:z.number().int().min(0).max(100000)}).strict().refine(ability=>ability.usesRemaining<=ability.definition.maxUses,'Оставшиеся использования превышают максимум');
export type Ability=z.infer<typeof abilitySchema>;
export type AssignedAbility=z.infer<typeof assignedAbilitySchema>;
