import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {transferItem} from './items.js';
import {footprintFits} from './tokens.js';

export function placeItem(campaign:Campaign,itemId:string,mapId:string,column:number,row:number):Campaign {
 const item=campaign.items.find(item=>item.id===itemId),map=campaign.maps.find(map=>map.id===mapId);
 if(!item)throw new Error('Предмет не найден');
 if(!map||!Number.isInteger(column)||!Number.isInteger(row)||!footprintFits(map,{column,row},{width:1,height:1}))throw new Error('Выберите целую клетку внутри поля');
 return campaignSchema.parse({...campaign,items:campaign.items.map(existing=>existing.id===itemId?{...transferItem(existing,null),ground:{mapId,column,row}}:existing)});
}

export function takeItem(campaign:Campaign,itemId:string,ownerId:string|null):Campaign {
 if(!campaign.items.some(item=>item.id===itemId))throw new Error('Предмет не найден');
 if(ownerId!==null&&!campaign.characters.some(character=>character.id===ownerId))throw new Error('Персонаж не найден');
 return campaignSchema.parse({...campaign,items:campaign.items.map(item=>item.id===itemId?transferItem(item,ownerId):item)});
}
