import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {stat,spendAP,notice} from './prison-state.js';
import {tokenCenter,nearestCenter,sight} from './environment.js';
export function carrySummary(c:Campaign,id:string){
 const ch=c.characters.find(ch=>ch.id===id);if(!ch)throw new Error('Персонаж не найден');const items=c.items.filter(i=>i.ownerId===id),bags=items.filter(i=>i.template.mechanics?.materialTag==='bag').length;
 const weight=items.reduce((n,i)=>n+(i.template.mechanics?.weight??0),0),limit=3+2*stat(c,ch,'strength');
 const loose=items.filter(i=>!i.equipped&&i.template.mechanics?.materialTag!=='bag'),flat=loose.filter(i=>i.template.mechanics?.size==='flat').length,small=loose.filter(i=>!i.template.mechanics?.size||i.template.mechanics.size==='small').length+Math.max(0,flat-1);
 const smallItems=loose.filter(i=>!i.template.mechanics?.size||i.template.mechanics.size==='small'),flatOverflow=loose.filter(i=>i.template.mechanics?.size==='flat').slice(1);
 // Keep the heaviest four items in personal slots, then pack the added bag slots.
 const bagItems=[...smallItems,...flatOverflow].sort((a,b)=>(b.template.mechanics?.weight??0)-(a.template.mechanics?.weight??0)).slice(4);
 const loads=Array.from({length:bags},()=>({weight:0,slots:0}));let bagsValid=true;
 for(const item of bagItems){const w=item.template.mechanics?.weight??0,bag=loads.filter(b=>b.slots<4&&b.weight+w<=5+1e-8).sort((a,b)=>a.weight-b.weight)[0];if(!bag){bagsValid=false;break;}bag.weight+=w;bag.slots++;}
 const hands=items.filter(i=>i.equipped&&(i.template.category==='weapon'||i.template.mechanics?.hands)).reduce((n,i)=>n+(i.template.mechanics?.hands==='two'?2:1),0)+loose.filter(i=>i.template.mechanics?.size==='large').reduce((n,i)=>n+(i.template.mechanics?.hands==='two'?2:1),0);
 return {weight,limit,slots:small,capacity:4+4*bags,hands,valid:weight<=limit+1e-8&&small<=4+4*bags&&hands<=2&&bagsValid};
}
export function pickupPrisonItem(c:Campaign,itemId:string,ownerId:string):Campaign {
 const item=c.items.find(i=>i.id===itemId),ch=c.characters.find(ch=>ch.id===ownerId);if(!item?.ground||!ch)throw new Error('Предмет не находится на поле');const map=c.maps.find(m=>m.id===item.ground!.mapId)!,p=tokenCenter(map,item.ground);
 if(!c.tokens.some(t=>t.mapId===map.id&&t.characterId===ownerId&&Math.hypot(nearestCenter(map,t,ch.footprint,p).x-p.x,nearestCenter(map,t,ch.footprint,p).y-p.y)*map.grid.metersPerCell/map.grid.cellSizePx<=1.5+1e-7&&sight(map,nearestCenter(map,t,ch.footprint,p),p)))throw new Error('Предмет далеко или за стеной');
 let next=spendAP(c,ownerId,1);next={...next,items:next.items.map(i=>i.id===itemId?{...i,ownerId,ground:null,equipped:false}:i)};
 if(!carrySummary(next,ownerId).valid)throw new Error('Нет места, свободных рук или допустимого веса для переноски');
 return campaignSchema.parse(notice(next,`Подобран ${item.template.name};1 ОД в бою.`));
}
