import {campaignSchema,type Campaign,type GameMap} from '../shared/campaign.js';
import type {Annotation} from '../shared/annotations.js';
import {crosses,inside,pointSegmentDistance,tokenCenter,sight} from './environment.js';
import type {Point} from './grid.js';
import {spendAP,stat,bonus,notice} from './prison-state.js';
import {rollDice,type RandomSource} from './dice.js';
import {dice} from './prison-combat.js';
export type Barrier=Extract<Annotation,{kind:'wall'|'cover'}>;
export function barriersOnLine(map:GameMap,a:Point,b:Point):Barrier[]{return map.annotations.filter((z):z is Barrier=>{
 if(z.kind==='wall')return !z.open&&crosses(a,b,z.from,z.to);
 if(z.kind!=='cover'||z.hp===0||inside(a,z)&&!inside(b,z))return false;
 const lo={x:Math.min(z.from.x,z.to.x),y:Math.min(z.from.y,z.to.y)},hi={x:Math.max(z.from.x,z.to.x),y:Math.max(z.from.y,z.to.y)},p={x:hi.x,y:lo.y},q={x:lo.x,y:hi.y};
 return inside(b,z)||[[lo,p],[p,hi],[hi,q],[q,lo]].some(([x,y])=>crosses(a,b,x,y));
 }).sort((x,y)=>Math.hypot((x.from.x+x.to.x)/2-a.x,(x.from.y+x.to.y)/2-a.y)-Math.hypot((y.from.x+y.to.x)/2-a.x,(y.from.y+y.to.y)/2-a.y));}
export function material(z:Barrier){return z.material??(z.kind==='cover'?{resistance:5,hardness:1,fracture:1}:{resistance:12,hardness:6,fracture:.4});}
export function barrierImpact(z:Barrier,damage:number,penetration=0){const m=material(z),absorbed=Math.min(damage,Math.max(1,m.resistance-penetration));return {remaining:damage-absorbed,damage:Math.max(0,absorbed-m.hardness)*m.fracture};}
export function damageBarrier(c:Campaign,mapId:string,id:string,amount:number,impact?:Point):Campaign {
 if(!Number.isFinite(amount)||amount<0)throw new Error('Некорректный урон преграде');
 const map=c.maps.find(m=>m.id===mapId),z=map?.annotations.find(a=>a.id===id);if(!map||!z||z.kind!=='wall'&&z.kind!=='cover')throw new Error('Преграда не найдена');
 if(z.kind==='wall'&&!z.destructible)return c;
 const max=z.kind==='wall'?z.hp:z.hp??12,left=Math.max(0,max-amount);let annotations:Annotation[]=[];
 if(z.kind==='wall'&&impact){
  const dx=z.to.x-z.from.x,dy=z.to.y-z.from.y,len=Math.hypot(dx,dy),section=map.grid.cellSizePx/map.grid.metersPerCell;
  if(len>section+2){const t=Math.max(0,Math.min(1,((impact.x-z.from.x)*dx+(impact.y-z.from.y)*dy)/(len*len))),lo=Math.max(0,t-section/len/2),hi=Math.min(1,t+section/len/2),p={x:z.from.x+lo*dx,y:z.from.y+lo*dy},q={x:z.from.x+hi*dx,y:z.from.y+hi*dy};
   if(lo*len>=1)annotations.push({...z,id:crypto.randomUUID(),to:p});
   if(left>1e-9)annotations.push({...z,from:p,to:q,hp:left});
   if((1-hi)*len>=1)annotations.push({...z,id:crypto.randomUUID(),from:q});
  }else if(left>1e-9)annotations=[{...z,hp:left}];
 }else if(z.kind==='wall'){if(left>1e-9)annotations=[{...z,hp:left}];}
 else annotations=[{...z,hp:left,maxHP:z.maxHP??max}];
 return {...c,maps:c.maps.map(m=>m.id===mapId?{...m,annotations:m.annotations.flatMap(a=>a.id===id?annotations:[a])}:m)};
}
export function strikePrisonBarrier(c:Campaign,actorId:string,itemId:string,barrierId:string,random?:RandomSource):Campaign {
 const item=c.items.find(i=>i.id===itemId&&i.ownerId===actorId&&i.equipped),actor=c.characters.find(ch=>ch.id===actorId),map=c.maps.find(m=>m.id===c.view.activeMapId),z=map?.annotations.find(a=>a.id===barrierId),token=c.tokens.find(t=>t.characterId===actorId&&t.mapId===map?.id);
 if(!item?.template.damageDice||!actor||!map||!token||!z||z.kind!=='wall'&&z.kind!=='cover')throw new Error('Нужны экипированный инструмент/оружие и преграда на текущем поле');
 const m=item.template.mechanics;if(!m)throw new Error('Нет параметров инструмента');if(item.template.maxCharges&&item.charges<=0)throw new Error('Нужна перезарядка');if(item.template.maxDurability&&item.durability<=0)throw new Error('Предмет сломан');
 const a=tokenCenter(map,token,actor.footprint),b={x:(z.from.x+z.to.x)/2,y:(z.from.y+z.to.y)/2},distance=z.kind==='wall'?pointSegmentDistance(a,z.from,z.to):Math.max(0,Math.hypot(a.x-b.x,a.y-b.y)-map.grid.cellSizePx/2);
 if(distance/map.grid.cellSizePx*map.grid.metersPerCell>m.rangeMeters+1e-7||!sight({...map,annotations:map.annotations.filter(x=>x.id!==z.id)},a,b))throw new Error('Преграда вне досягаемости или за другой стеной');
 const spec=dice(item.template.damageDice),roll=rollDice(spec.count,spec.sides,spec.modifier,'Урон преграде',random),D=roll.total+bonus(stat(c,actor,m.attackType==='ranged'?'dexterity':'strength'));
 const amount=m.attackType==='ranged'?barrierImpact(z,D,m.penetration??0).damage:Math.max(0,D-material(z).hardness)*material(z).fracture*(m.toolFactor??.25);
 let next=spendAP(c,actorId,m.apCost||2);next=damageBarrier(next,map.id,z.id,amount,b);
 next={...next,diceRolls:[...next.diceRolls,roll].slice(-200),items:next.items.map(i=>i.id===item.id?{...i,charges:i.template.maxCharges?i.charges-1:i.charges}:i)};
 return campaignSchema.parse(notice(next,`${item.template.name}: преграда потеряла ${amount.toFixed(3)} прочности. Дробные повреждения сохранены.`));
}
export function toggleDoor(c:Campaign,actorId:string,id:string):Campaign {
 const map=c.maps.find(m=>m.id===c.view.activeMapId),z=map?.annotations.find(a=>a.id===id),token=c.tokens.find(t=>t.characterId===actorId&&t.mapId===map?.id);if(!map||!z||z.kind!=='wall'||!z.door||!token)throw new Error('Выберите дверь и доступного персонажа');
 if(pointSegmentDistance(tokenCenter(map,token),z.from,z.to)/map.grid.cellSizePx*map.grid.metersPerCell>1.5)throw new Error('Дверь вне досягаемости');
 const next=spendAP(c,actorId,1);return campaignSchema.parse(notice({...next,maps:next.maps.map(m=>m.id===map.id?{...m,annotations:m.annotations.map(a=>a.id===id?{...z,open:!z.open}:a)}:m)},z.open?'Дверь закрыта.':'Дверь открыта по решению мастера.'));
}
