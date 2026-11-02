import type {GameMap,Token,Character,Campaign} from '../shared/campaign.js';
import type {Annotation} from '../shared/annotations.js';
import {cellOrigin,type Point} from './grid.js';
export function pointSegmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function inside(p:Point,zone:Annotation):boolean{
 if(zone.kind==='light')return Math.hypot(p.x-zone.center.x,p.y-zone.center.y)<=zone.radius;
 if(p.x<Math.min(zone.from.x,zone.to.x)||p.x>Math.max(zone.from.x,zone.to.x)||p.y<Math.min(zone.from.y,zone.to.y)||p.y>Math.max(zone.from.y,zone.to.y))return false;
 if('brush' in zone&&zone.brush){const ps=zone.brush.points;return ps.length===1?Math.hypot(p.x-ps[0].x,p.y-ps[0].y)<=zone.brush.radius:ps.slice(1).some((b,i)=>pointSegmentDistance(p,ps[i],b)<=zone.brush!.radius);}
 return p.x>=Math.min(zone.from.x,zone.to.x)&&p.x<=Math.max(zone.from.x,zone.to.x)&&p.y>=Math.min(zone.from.y,zone.to.y)&&p.y<=Math.max(zone.from.y,zone.to.y);
}
export function tokenCenter(map:GameMap,token:{column:number;row:number},size={width:1,height:1}){const p=cellOrigin(token.column,token.row,map.grid);return {x:p.x+size.width*map.grid.cellSizePx/2,y:p.y+size.height*map.grid.cellSizePx/2};}
export function nearestCenter(map:GameMap,token:{column:number;row:number},size:{width:number;height:number},p:Point){const first=tokenCenter(map,token),last=tokenCenter(map,{column:token.column+size.width-1,row:token.row+size.height-1});return {x:Math.max(first.x,Math.min(last.x,p.x)),y:Math.max(first.y,Math.min(last.y,p.y))};}
export function terrainAt(map:GameMap,token:{column:number;row:number},size={width:1,height:1}){
 const zones=new Map<string,Annotation>(),heights:number[]=[];for(let x=0;x<size.width;x++)for(let y=0;y<size.height;y++){const p=tokenCenter(map,{column:token.column+x,row:token.row+y}),cellHeights:number[]=[];for(const zone of map.annotations)if(zone.kind!=='wall'&&zone.kind!=='light'&&inside(p,zone)){zones.set(zone.id,zone);if(zone.kind==='elevation')cellHeights.push(zone.heightMeters);}heights.push(cellHeights.length?Math.max(...cellHeights):0);}
 const entries=[...zones.values()];return {height:Math.max(...heights),liquid:entries.some(z=>z.kind==='liquid'),acid:entries.some(z=>z.kind==='liquid'&&z.liquidType==='acid'),lava:entries.some(z=>z.kind==='liquid'&&z.liquidType==='lava')};
}
export function crosses(a:Point,b:Point,c:Point,d:Point){
 const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
 return x*y<=1e-8&&u*v<=1e-8&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-8&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-8;
}
export function sight(map:GameMap,a:Point,b:Point){return !map.annotations.some(z=>z.kind==='wall'&&crosses(a,b,z.from,z.to));}
export function coverPenalty(map:GameMap,a:Point,b:Point){let penalty=0;for(const z of map.annotations)if(z.kind==='cover'){if(inside(a,z)&&!inside(b,z))continue;const min={x:Math.min(z.from.x,z.to.x),y:Math.min(z.from.y,z.to.y)},max={x:Math.max(z.from.x,z.to.x),y:Math.max(z.from.y,z.to.y)},p={x:max.x,y:min.y},q={x:min.x,y:max.y};if(inside(b,z)||[[min,p],[p,max],[max,q],[q,min]].some(([c,d])=>crosses(a,b,c,d)))penalty=Math.max(penalty,z.level==='light'?2:z.level==='medium'?4:6);}return penalty;}
export function tokenGeometry(c:Campaign,actor:Token,target:Token){
 const map=c.maps.find(m=>m.id===actor.mapId),aChar=c.characters.find(ch=>ch.id===actor.characterId),tChar=c.characters.find(ch=>ch.id===target.characterId);if(!map||!aChar||!tChar||actor.mapId!==target.mapId)throw new Error('Атакующий и цель должны быть на одном поле');
 const a=nearestCenter(map,actor,aChar.footprint,tokenCenter(map,target,tChar.footprint)),b=nearestCenter(map,target,tChar.footprint,a),distance=Math.hypot(a.x-b.x,a.y-b.y)/map.grid.cellSizePx*map.grid.metersPerCell;
 const illuminated=c.gameplay.ambientLight||map.annotations.some(z=>z.kind==='light'&&inside(b,z));return {map,a,b,distance,visible:sight(map,a,b)&&illuminated&&distance<=c.gameplay.visionMeters,cover:coverPenalty(map,a,b),high:terrainAt(map,actor,aChar.footprint).height-terrainAt(map,target,tChar.footprint).height};
}
