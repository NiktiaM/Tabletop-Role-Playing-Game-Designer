import type {Campaign,GameMap} from '../shared/campaign.js';
import type {Annotation} from '../shared/annotations.js';
import {cellOrigin} from './grid.js';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const round=(n:number)=>Math.round(n*1e6)/1e6;
function transform(a:Annotation,p:NonNullable<GameMap['placement']>,width:number,inverse=false):Annotation{
 const scale=p.width/width,s=inverse?1/scale:scale;
 const point=(q:{x:number;y:number})=>inverse?{x:round((q.x-p.x)*s),y:round((q.y-p.y)*s)}:{x:round(p.x+q.x*s),y:round(p.y+q.y*s)};
 const base={...a};if(inverse)delete base.sourceMapId;
 return a.kind==='light'?{...base,kind:'light',center:point(a.center),radius:round(a.radius*s)} as Annotation:{...base,from:point(a.from),to:point(a.to),...('brush' in a&&a.brush?{brush:{points:a.brush.points.map(point),radius:round(a.brush.radius*s)}}:{})} as Annotation;
}
/** Rooms are image/grid objects; runtime tokens, collisions and distances share the root's metric space. */
export function syncRooms(before:Campaign,next:Campaign):Campaign{
 let maps=next.maps.map(m=>({...m,grid:{...m.grid},annotations:[...m.annotations]}));
 for(let i=0;i<maps.length;i++){
  const room=maps[i];if(!room.placement)continue;const parent=maps.find(m=>m.id===room.placement!.parentId);if(!parent||parent.placement)throw new Error('Комнаты добавляются к основной карте, без вложенных помещений');
  const old=before.maps.find(m=>m.id===room.id),oldParent=before.maps.find(m=>m.id===parent.id),ppm=parent.grid.cellSizePx/parent.grid.metersPerCell;
  let p={...room.placement};const moved=!old||!same(p,old.placement),parentScaleChanged=!!oldParent&&(oldParent.grid.cellSizePx/oldParent.grid.metersPerCell!==ppm);
  if(moved||parentScaleChanged){p.height=room.height*p.width/room.width;if(p.y+p.height>parent.height)p.height=parent.height-p.y,p.width=p.height*room.width/room.height;room.grid={...room.grid,metersPerCell:room.grid.cellSizePx*(p.width/room.width)/ppm};}
  else if(old&&(old.grid.cellSizePx!==room.grid.cellSizePx||old.grid.metersPerCell!==room.grid.metersPerCell)){const scale=ppm/(room.grid.cellSizePx/room.grid.metersPerCell);p.width=room.width*scale;p.height=room.height*scale;if(p.width>parent.width||p.height>parent.height)throw new Error('При таком масштабе комната больше основной карты. Уменьшите размер клетки в метрах.');p.x=Math.min(p.x,parent.width-p.width);p.y=Math.min(p.y,parent.height-p.height);}
  room.placement=p;
  const projected=parent.annotations.filter(a=>a.sourceMapId===room.id),oldProjected=oldParent?.annotations.filter(a=>a.sourceMapId===room.id)??[];
  const authoredChanged=!old||!same(room.annotations,old.annotations)||moved||parentScaleChanged||!same(p,old.placement);
  if(old&&same(room.annotations,old.annotations)&&!moved&&!parentScaleChanged&&!same(projected,oldProjected))room.annotations=projected.map(a=>transform(a,p,room.width,true));
  if(authoredChanged)parent.annotations=[...parent.annotations.filter(a=>a.sourceMapId!==room.id),...room.annotations.map(a=>({...transform(a,p,room.width),sourceMapId:room.id}))];
 }
 for(const root of maps.filter(m=>!m.placement)){const rooms=maps.filter(m=>m.placement?.parentId===root.id);if(!rooms.length&&!root.grid.regions?.length&&root.grid.navigationStep===undefined)continue;const regions=rooms.filter(m=>m.grid.visible).map(m=>{const p=m.placement!,scale=p.width/m.width;return {mapId:m.id,x:p.x+m.grid.originPx.x*scale,y:p.y+m.grid.originPx.y*scale,width:Math.min(m.grid.bounds?.width??m.width-m.grid.originPx.x,m.width-m.grid.originPx.x)*scale,height:Math.min(m.grid.bounds?.height??m.height-m.grid.originPx.y,m.height-m.grid.originPx.y)*scale,cellSizePx:m.grid.cellSizePx*scale};});root.grid={...root.grid,regions,...(regions.length?{navigationStep:Math.max(.001,Math.min(1,...regions.map(r=>r.cellSizePx/root.grid.cellSizePx))/2)}:{navigationStep:undefined})};}
 const items=next.items.map(item=>{const room=maps.find(m=>m.id===item.ground?.mapId);if(!room?.placement||!item.ground)return item;const loc=sceneCell({...next,maps},room,item.ground.column,item.ground.row);return {...item,ground:{mapId:loc.mapId,column:loc.column,row:loc.row}};});
 return {...next,maps,items};
}
export function sceneCell(c:Campaign,map:GameMap,column:number,row:number){if(!map.placement)return {mapId:map.id,column,row};const parent=c.maps.find(m=>m.id===map.placement!.parentId)!;const p=cellOrigin(column,row,map.grid),scale=map.placement.width/map.width;return {mapId:parent.id,column:round((map.placement.x+p.x*scale-parent.grid.originPx.x)/parent.grid.cellSizePx),row:round((map.placement.y+p.y*scale-parent.grid.originPx.y)/parent.grid.cellSizePx)};}
/** In the source-image editor only, render canonical actors back into the room's local coordinates. */
export function roomView(c:Campaign,map:GameMap):Campaign{
 if(!map.placement)return c;const root=c.maps.find(m=>m.id===map.placement!.parentId)!;const scale=map.placement.width/map.width,factor=root.grid.cellSizePx/(scale*map.grid.cellSizePx);
 const local=(column:number,row:number)=>{const p=cellOrigin(column,row,root.grid);return {column:((p.x-map.placement!.x)/scale-map.grid.originPx.x)/map.grid.cellSizePx,row:((p.y-map.placement!.y)/scale-map.grid.originPx.y)/map.grid.cellSizePx};};
 return {...c,characters:c.characters.map(ch=>({...ch,footprint:{width:ch.footprint.width*factor,height:ch.footprint.height*factor}})),tokens:c.tokens.filter(t=>t.mapId===root.id).map(t=>({...t,...local(t.column,t.row),mapId:map.id})).filter(t=>t.column>=0&&t.row>=0&&t.column*map.grid.cellSizePx<map.width&&t.row*map.grid.cellSizePx<map.height),items:c.items.map(i=>i.ground?.mapId===root.id?{...i,ground:{...i.ground,...local(i.ground.column,i.ground.row),mapId:map.id}}:i)};
}
