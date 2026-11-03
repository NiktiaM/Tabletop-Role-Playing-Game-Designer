import type {Campaign,GameMap,Token} from '../shared/campaign.js';
import {sight,tokenCenter,inside} from './environment.js';
export interface Vision {visible:Set<string>;explored:Set<string>;size:number;columns:number;rows:number;limited:boolean}
export const visionKey=(mapId:string,id:string)=>`${mapId}:${id}`;
export function vision(c:Campaign,map:GameMap,id:string):Vision {
 const meters=Math.min(1,map.grid.metersPerCell),size=map.grid.cellSizePx/map.grid.metersPerCell*meters,columns=Math.ceil(map.width/size),rows=Math.ceil(map.height/size),visible=new Set<string>(),explored=new Set(c.prison.explored[visionKey(map.id,id)]??[]),viewers=c.tokens.filter(t=>t.characterId===id&&t.mapId===map.id);let limited=false,count=0;
 const lights=c.tokens.filter(t=>t.mapId===map.id).flatMap(t=>c.items.filter(i=>i.ownerId===t.characterId&&i.equipped&&i.template.mechanics?.materialTag==='flashlight').map(i=>({center:tokenCenter(map,t),radius:(i.template.mechanics?.rangeMeters??6)*map.grid.cellSizePx/map.grid.metersPerCell})));
 for(const token of viewers){const ch=c.characters.find(ch=>ch.id===id),origin=tokenCenter(map,token,ch?.footprint),radius=c.gameplay.visionMeters/map.grid.metersPerCell*map.grid.cellSizePx;
  for(let y=Math.max(0,Math.floor((origin.y-radius)/size));y<Math.min(rows,Math.ceil((origin.y+radius)/size));y++)for(let x=Math.max(0,Math.floor((origin.x-radius)/size));x<Math.min(columns,Math.ceil((origin.x+radius)/size));x++){
   if(++count>20000){limited=true;break;}const p={x:(x+.5)*size,y:(y+.5)*size},distance=Math.hypot(p.x-origin.x,p.y-origin.y)*map.grid.metersPerCell/map.grid.cellSizePx;
   if(distance>c.gameplay.visionMeters||!sight(map,origin,p))continue;
   const lit=c.gameplay.ambientLight||distance<=2||map.annotations.some(z=>z.kind==='light'&&inside(p,z)&&sight(map,z.center,p))||lights.some(l=>Math.hypot(p.x-l.center.x,p.y-l.center.y)<=l.radius&&sight(map,l.center,p));
   if(lit)visible.add(`${x},${y}`);
  }
 }
 return {visible,explored,size,columns,rows,limited};
}
export function rememberVision(c:Campaign,id:string,mapId:string):Campaign {const map=c.maps.find(m=>m.id===mapId);if(!map)return c;const v=vision(c,map,id);return {...c,prison:{...c.prison,explored:{...c.prison.explored,[visionKey(mapId,id)]:[...new Set([...v.explored,...v.visible])].slice(-20000)}}};}
export function tokenVisible(v:Vision,map:GameMap,t:Token){const p=tokenCenter(map,t);return v.visible.has(`${Math.floor(p.x/v.size)},${Math.floor(p.y/v.size)}`);}
