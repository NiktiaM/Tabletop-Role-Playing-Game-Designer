import {tokenSize} from './tokens.js';
import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {terrainAt,sight,tokenCenter} from './environment.js';
import {positionFree,wallInsideHull,hull,polygonsOverlap} from './movement.js';
import {health,hpChange,spendAP,notice,bonus,stat,condition,setCondition,battleFor,reactionAvailable} from './prison-state.js';
import {rollDice,type RandomSource} from './dice.js';
export function fallDamageDice(height:number){if(!Number.isFinite(height)||height<0||height>202)throw new Error('Высота падения от 0 до 202 м');return Math.max(0,Math.ceil(height/2)-1);}
export function applyFall(c:Campaign,id:string,height:number,random?:RandomSource):Campaign {const count=fallDamageDice(height);if(!c.characters.some(ch=>ch.id===id))throw new Error('Персонаж не найден');const roll=count?rollDice(count,6,0,`Падение ${height}м`,random):null;let next=hpChange(c,id,-(roll?.total??0));if(roll)next={...next,diceRolls:[...next.diceRolls,roll].slice(-200)};return campaignSchema.parse(notice(next,`Падение ${height}м: ${count}d6, урон ${roll?.total??0}, броня не уменьшает.`));}
export function jump(c:Campaign,tokenId:string,column:number,row:number,withRun=false):Campaign {
 const token=c.tokens.find(t=>t.id===tokenId),ch=c.characters.find(ch=>ch.id===token?.characterId),map=c.maps.find(m=>m.id===token?.mapId);if(!token||!ch||!map||!Number.isInteger(column)||!Number.isInteger(row))throw new Error('Выберите токен и целую клетку');
 if(condition(c,ch.id).grappledBy)throw new Error('Нельзя прыгнуть из захвата');
 const dest={column,row};if(!positionFree(map,dest,ch,token,c.tokens,c.characters))throw new Error('Место приземления не вмещает тело или занято');
 const a=tokenCenter(map,token,ch.footprint),b=tokenCenter(map,dest,ch.footprint);if(!sight(map,a,b))throw new Error('Прыжок не проходит сквозь стену');
 const px=map.grid.cellSizePx,body={x:ch.footprint.width*px,y:ch.footprint.height*px},a0={x:a.x-body.x/2,y:a.y-body.y/2},b0={x:b.x-body.x/2,y:b.y-body.y/2};
 for(const offset of [{x:0,y:0},{x:body.x,y:0},{x:0,y:body.y},{x:body.x,y:body.y}])if(!sight(map,{x:a0.x+offset.x,y:a0.y+offset.y},{x:b0.x+offset.x,y:b0.y+offset.y}))throw new Error('Тело пересекает стену на пути прыжка');
 if(map.annotations.some(z=>z.kind==='cover'&&z.blocking!==false&&z.hp!==0&&b0.x<Math.max(z.from.x,z.to.x)&&b0.x+body.x>Math.min(z.from.x,z.to.x)&&b0.y<Math.max(z.from.y,z.to.y)&&b0.y+body.y>Math.min(z.from.y,z.to.y)))throw new Error('На месте приземления непроходимый объект');
 const polygon=hull([a0,{x:a0.x+body.x,y:a0.y},{x:a0.x+body.x,y:a0.y+body.y},{x:a0.x,y:a0.y+body.y},b0,{x:b0.x+body.x,y:b0.y},{x:b0.x+body.x,y:b0.y+body.y},{x:b0.x,y:b0.y+body.y}]);
 for(const other of c.tokens.filter(t=>t.mapId===map.id&&t.id!==token.id)){const shape=c.characters.find(ch=>ch.id===other.characterId);if(!shape)continue;const fp=tokenSize(shape,other),o=tokenCenter(map,other,fp),lo={x:o.x-fp.width*px/2,y:o.y-fp.height*px/2},hi={x:lo.x+fp.width*px,y:lo.y+fp.height*px};if(polygonsOverlap(polygon,[lo,{x:hi.x,y:lo.y},hi,{x:lo.x,y:hi.y}]))throw new Error('Путь прыжка пересекает чужое тело');}
 const horizontal=Math.hypot(column-token.column,row-token.row)*map.grid.metersPerCell,base=1+Math.floor((bonus(stat(c,ch,'strength'))-1)/2),max=withRun?Math.min(4,base+1):base;
 if(horizontal<=0||horizontal>max+1e-7)throw new Error(`Горизонтальный предел прыжка ${max}м`);
 if(withRun&&(condition(c,ch.id).runUpMeters??0)<3)throw new Error('Сначала пройдите прямой разбег 3 м в текущем ходу');
 const rise=terrainAt(map,dest,ch.footprint).height-terrainAt(map,token,ch.footprint).height,cost=1+Math.hypot(horizontal,rise)+Math.max(0,rise);
 let next=spendAP(c,ch.id,cost);next={...next,tokens:next.tokens.map(t=>t.id===tokenId?{...t,column,row}:t)};next=setCondition(next,ch.id,{runUpMeters:0});if(rise< -2)next=applyFall(next,ch.id,-rise);
 return campaignSchema.parse(notice(next,`Прыжок ${horizontal}м, изменение высоты ${rise}м, цена ${cost.toFixed(2)}ОД в бою. Опасные последствия мастер задаёт до прыжка.`));
}

export function rotateToken(c:Campaign,id:string):Campaign {const token=c.tokens.find(t=>t.id===id),ch=c.characters.find(ch=>ch.id===token?.characterId),map=c.maps.find(m=>m.id===token?.mapId);if(!token||!ch||!map)throw new Error('Токен не найден');spendAP(c,ch.id,0);const rotated={...token,rotation:token.rotation===90?0 as const:90 as const};if(!positionFree(map,rotated,ch,rotated,c.tokens,c.characters))throw new Error('Не хватает места для поворота');const side=Math.max(ch.footprint.width,ch.footprint.height),sweep={...ch,footprint:{width:side,height:side}};if(!positionFree(map,token,sweep,{...token,rotation:0},c.tokens,c.characters))throw new Error('В охватывающей области поворота препятствие');const p=tokenCenter(map,token),size=map.grid.cellSizePx,lo={x:p.x-size/2,y:p.y-size/2},hi={x:lo.x+side*size,y:lo.y+side*size};if(map.annotations.some(z=>z.kind==='wall'&&!z.open&&wallInsideHull(z.from,z.to,[lo,{x:hi.x,y:lo.y},hi,{x:lo.x,y:hi.y}])))throw new Error('Поворот пересекает стену');return campaignSchema.parse({...c,tokens:c.tokens.map(t=>t.id===id?rotated:t)});}
export function movementInterceptors(c:Campaign,tokenId:string,path:{column:number;row:number}[]):{ids:string[];stop:{column:number;row:number}}|null {
 const token=c.tokens.find(t=>t.id===tokenId),ch=c.characters.find(ch=>ch.id===token?.characterId),map=c.maps.find(m=>m.id===token?.mapId);if(!token||!ch||!map)return null;
 const b=battleFor(c,ch.id);if(!b)return null;
 for(let i=0;i<path.length-1;i++){
  const a=tokenCenter(map,path[i],tokenSize(ch,token)),next=tokenCenter(map,path[i+1],tokenSize(ch,token)),ids:string[]=[];
  for(const p of b.participants){if(p.characterId===ch.id||!reactionAvailable(c,p.characterId))continue;const other=c.tokens.find(t=>t.characterId===p.characterId&&t.mapId===map.id),otherChar=c.characters.find(ch=>ch.id===p.characterId);if(!other||!otherChar)continue;const o=tokenCenter(map,other,tokenSize(otherChar,other)),before=Math.hypot(a.x-o.x,a.y-o.y)*map.grid.metersPerCell/map.grid.cellSizePx,after=Math.hypot(next.x-o.x,next.y-o.y)*map.grid.metersPerCell/map.grid.cellSizePx;if(before<=1.5+1e-7&&after>before+1e-7&&sight(map,a,o))ids.push(p.characterId);}
  if(ids.length)return {ids,stop:path[i]};
 }
 return null;
}
