import {sceneCell} from './scene.js';
import {campaignSchema,gridSchema,type Campaign,type GameMap,type Grid} from '../shared/campaign.js';
import {footprintFits,footprintsOverlap,tokenSize} from './tokens.js';
export function drawnGrid(map:Pick<GameMap,'width'|'height'>,old:Grid,from:{x:number;y:number},to:{x:number;y:number},columns:number,rows:number):Grid{
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1||columns>300||rows>300)throw new Error('Размер сетки: от 1 до 300 клеток по каждой оси');
 const x=Math.max(0,Math.min(from.x,to.x)),y=Math.max(0,Math.min(from.y,to.y)),step=Math.min(Math.abs(to.x-from.x)/columns,Math.abs(to.y-from.y)/rows,(map.width-x)/columns,(map.height-y)/rows);
 if(step<4)throw new Error('Область слишком мала: клетка должна быть не меньше 4 пикселей');
 return gridSchema.parse({...old,visible:true,cellSizePx:Math.min(4096,step),originPx:{x,y},bounds:{width:columns*Math.min(4096,step),height:rows*Math.min(4096,step)}});
}
export function placeCharacter(c:Campaign,id:string,mapId:string,column:number,row:number):Campaign{
 const source=c.maps.find(m=>m.id===mapId);if(source?.placement){const p=sceneCell(c,source,column,row);mapId=p.mapId;column=p.column;row=p.row;}
 const ch=c.characters.find(ch=>ch.id===id),map=c.maps.find(m=>m.id===mapId);if(!ch||!map)throw new Error('Персонаж или карта не найдены');const existing=c.tokens.find(t=>t.characterId===id&&t.mapId===mapId),size=tokenSize(ch,existing??{});
 if(!footprintFits(map,{column,row},size)||c.tokens.some(t=>t.mapId===mapId&&t.id!==existing?.id&&footprintsOverlap({column,row},size,t,tokenSize(c.characters.find(ch=>ch.id===t.characterId)!,t))))throw new Error('Нет места для токена: проверьте границы и занятые клетки');
 if(existing)return campaignSchema.parse({...c,tokens:c.tokens.map(t=>t.id===existing.id?{...t,column,row}:t)});
 return campaignSchema.parse({...c,tokens:[...c.tokens,{id:crypto.randomUUID(),characterId:id,mapId,column,row}]});
}
export function attachRoom(c:Campaign,map:GameMap,parentId:string):Campaign{const parent=c.maps.find(m=>m.id===parentId);if(parent?.placement)throw new Error('Добавляйте комнаты на основную карту');if(!parent)throw new Error('Основная карта не найдена');const scale=Math.min(parent.width*.4/map.width,parent.height*.4/map.height),width=map.width*scale,height=map.height*scale;return campaignSchema.parse({...c,maps:[...c.maps,{...map,placement:{parentId,x:parent.width*.1,y:parent.height*.1,width,height}}]});}
