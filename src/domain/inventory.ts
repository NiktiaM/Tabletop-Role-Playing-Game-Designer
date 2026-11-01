import {z} from 'zod';
import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {createItem,transferItem} from './items.js';
export const inventoryPayload=z.object({kind:z.enum(['template','instance']),id:z.uuid()}).strict();
export function giveInventory(campaign:Campaign,input:unknown,ownerId:string|null){
 const payload=inventoryPayload.parse(input);
 if(ownerId!==null&&!campaign.characters.some(character=>character.id===ownerId))throw new Error('Персонаж больше не существует');
 let items=campaign.items;
 if(payload.kind==='template'){const template=campaign.itemTemplates.find(template=>template.id===payload.id);if(!template)throw new Error('Шаблон больше не существует');items=[...items,createItem(template,ownerId)];}
 else {const item=items.find(item=>item.id===payload.id);if(!item)throw new Error('Экземпляр больше не существует');if(item.ownerId===ownerId&&!item.ground)return items;items=items.map(item=>item.id===payload.id?transferItem(item,ownerId):item);}
 const checked=campaignSchema.safeParse({...campaign,items});if(!checked.success)throw new Error('Нельзя выдать предмет: проверьте предел 1000 экземпляров и данные партии');return checked.data.items;
}
