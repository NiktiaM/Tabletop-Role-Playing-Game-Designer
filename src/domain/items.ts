import {itemInstanceSchema,type ItemInstance,type ItemTemplate} from '../shared/items.js';
export function createItem(template:ItemTemplate,ownerId:string|null):ItemInstance {
 return itemInstanceSchema.parse({id:crypto.randomUUID(),ownerId,template:structuredClone(template),durability:template.maxDurability,charges:template.maxCharges,equipped:false});
}
export function transferItem(item:ItemInstance,ownerId:string|null):ItemInstance {
 return {...item,ownerId,ground:null,equipped:false};
}
