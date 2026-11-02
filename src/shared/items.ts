import {mechanicsSchema} from './mechanics.js';
import {z} from 'zod';
import {portraitSchema} from './images.js';
export const itemTemplateSchema=z.object({
mechanics:mechanicsSchema.optional(), image:portraitSchema.nullable().default(null),
 id:z.uuid(),revision:z.number().int().min(1).max(1000000),name:z.string().trim().min(1).max(120),
 category:z.enum(['weapon','armor','consumable','other']),description:z.string().max(2000),
 damageDice:z.string().max(20).regex(/^(?:[1-9]|[1-9][0-9])d(?:[2-9]|[1-9][0-9]{1,2}|1000)(?:[+-][0-9]{1,4})?$/).nullable(),
 maxDurability:z.number().int().min(0).max(100000),maxCharges:z.number().int().min(0).max(100000),
}).strict();
export const itemInstanceSchema=z.object({
 ground:z.object({mapId:z.uuid(),column:z.number().int().min(-100000).max(100000),row:z.number().int().min(-100000).max(100000)}).strict().nullable().default(null),
 id:z.uuid(),ownerId:z.uuid().nullable(),template:itemTemplateSchema,durability:z.number().int().min(0),charges:z.number().int().min(0),equipped:z.boolean(),
}).strict().superRefine((item,ctx)=>{
 if(item.durability>item.template.maxDurability||item.charges>item.template.maxCharges)ctx.addIssue({code:'custom',message:'Прочность или заряды превышают максимум экземпляра'});
 if(item.ground&&item.ownerId!==null)ctx.addIssue({code:'custom',message:'Предмет на поле не может быть в инвентаре'});
 if(item.ownerId===null&&item.equipped)ctx.addIssue({code:'custom',message:'Нельзя экипировать предмет в общем запасе'});
});
export type ItemTemplate=z.infer<typeof itemTemplateSchema>;
export type ItemInstance=z.infer<typeof itemInstanceSchema>;
export const categoryNames:Record<ItemTemplate['category'],string>={weapon:'Оружие',armor:'Броня',consumable:'Расходник',other:'Другое'};
