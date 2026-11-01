import {z} from 'zod';
import {characterSchema} from './campaign.js';
import {itemTemplateSchema} from './items.js';
export const contentSchema=z.object({format:z.literal('rprison-content'),version:z.literal(1),characters:z.array(characterSchema.omit({id:true})).max(200).default([]),items:z.array(itemTemplateSchema.omit({id:true,revision:true})).max(200).default([])}).strict().refine(pack=>pack.characters.length+pack.items.length>0,'Файл не содержит персонажей или предметов');
export type ContentPack=z.infer<typeof contentSchema>;
