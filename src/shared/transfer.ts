import {z} from 'zod';
import {characterSchema} from './campaign.js';
import {rulesetSchema} from './rules.js';
import {itemInstanceSchema} from './items.js';
import {assignedAbilitySchema} from './abilities.js';
export const characterBundleSchema=z.object({format:z.literal('rprison-character'),version:z.literal(1),rules:rulesetSchema,character:characterSchema,items:z.array(itemInstanceSchema).max(1000),abilities:z.array(assignedAbilitySchema).max(1000)}).strict().superRefine((pack,ctx)=>{
 if(pack.items.some(item=>item.ownerId!==pack.character.id)||pack.abilities.some(ability=>ability.ownerId!==pack.character.id))ctx.addIssue({code:'custom',message:'В пакете есть чужие предметы или способности'});
 if(new Set(pack.items.map(item=>item.id)).size!==pack.items.length||new Set(pack.abilities.map(ability=>ability.id)).size!==pack.abilities.length)ctx.addIssue({code:'custom',message:'Повторяющиеся объекты пакета'});
});
export type CharacterBundle=z.infer<typeof characterBundleSchema>;
