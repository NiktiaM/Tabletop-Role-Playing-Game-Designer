import {terrainAt} from './environment.js';
import {terrainSchema} from '../shared/gameplay.js';
import type {GameMap,Character,Token} from '../shared/campaign.js';
import {cellOrigin,type Point} from './grid.js';
import {footprintFits,footprintsOverlap,tokenSize,type Cell} from './tokens.js';
export interface MovementOptions {mode:'meters'|'cells';diagonal:boolean;prison?:boolean;freeHands?:number;terrain?:ReturnType<typeof terrainSchema.parse>;target?:Cell}
const rounded=(n:number)=>Math.round(n*1e6)/1e6;
const key=(cell:Cell)=>`${rounded(cell.column)},${rounded(cell.row)}`;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function hull(points:Point[]):Point[]{
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),lower:Point[]=[],upper:Point[]=[];
 for(const p of sorted){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
 for(const p of [...sorted].reverse()){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
 return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
/** A wall blocks the interior of a swept footprint; mere contact with its boundary is allowed. */
export function wallInsideHull(from:Point,to:Point,polygon:Point[]):boolean{
 let low=0,high=1;const epsilon=1e-7;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],start=cross(a,b,from),delta=cross(a,b,to)-start;
  if(Math.abs(delta)<1e-12){if(start<=epsilon)return false;continue;}
  const t=(epsilon-start)/delta;if(delta>0)low=Math.max(low,t);else high=Math.min(high,t);
  if(low>=high)return false;
 }
 return low<high;
}
function corners(map:GameMap,cell:Cell,character:Character,token:Token):Point[]{const footprint=tokenSize(character,token);const p=cellOrigin(cell.column,cell.row,map.grid),w=footprint.width*map.grid.cellSizePx,h=footprint.height*map.grid.cellSizePx;return [p,{x:p.x+w,y:p.y},{x:p.x+w,y:p.y+h},{x:p.x,y:p.y+h}];}
export function positionFree(map:GameMap,cell:Cell,character:Character,token:Token,tokens:Token[],characters:Character[]):boolean{
 if(!footprintFits(map,cell,tokenSize(character,token)))return false;
 return !tokens.some(other=>{if(other.id===token.id||other.mapId!==map.id)return false;const c=characters.find(c=>c.id===other.characterId);return !!c&&footprintsOverlap(cell,tokenSize(character,token),other,tokenSize(c,other));});
}
export function stepAllowed(map:GameMap,from:Cell,to:Cell,character:Character,token:Token,tokens:Token[],characters:Character[],blockCovers=false):boolean{
 const dx=to.column-from.column,dy=to.row-from.row;if(Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy))return false;
 if(!positionFree(map,to,character,token,tokens,characters))return false;
 if(dx&&dy){const sideA={column:from.column+dx,row:from.row},sideB={column:from.column,row:from.row+dy};if(!positionFree(map,sideA,character,token,tokens,characters)||!positionFree(map,sideB,character,token,tokens,characters))return false;}
 const swept=hull([...corners(map,from,character,token),...corners(map,to,character,token)]);
 const left=Math.min(...swept.map(p=>p.x)),right=Math.max(...swept.map(p=>p.x)),top=Math.min(...swept.map(p=>p.y)),bottom=Math.max(...swept.map(p=>p.y));
 if(blockCovers&&map.annotations.some(item=>item.kind==='cover'&&item.blocking!==false&&item.hp!==0&&Math.min(item.from.x,item.to.x)<right&&Math.max(item.from.x,item.to.x)>left&&Math.min(item.from.y,item.to.y)<bottom&&Math.max(item.from.y,item.to.y)>top))return false;
 return !map.annotations.some(item=>item.kind==='wall'&&!item.open&&Math.max(item.from.x,item.to.x)>left&&Math.min(item.from.x,item.to.x)<right&&Math.max(item.from.y,item.to.y)>=top&&Math.min(item.from.y,item.to.y)<=bottom&&wallInsideHull(item.from,item.to,swept));
}
class Heap {
 data:{cell:Cell;cost:number;priority:number}[]=[];
 push(value:{cell:Cell;cost:number;priority?:number}){const v={...value,priority:value.priority??value.cost};this.data.push(v);let i=this.data.length-1;while(i>0){const p=Math.floor((i-1)/2);if(this.data[p].priority<=v.priority)break;this.data[i]=this.data[p];i=p;}this.data[i]=v;}
 pop(){const first=this.data[0],last=this.data.pop()!;if(this.data.length){let i=0;while(2*i+1<this.data.length){let next=2*i+1;if(next+1<this.data.length&&this.data[next+1].priority<this.data[next].priority)next++;if(this.data[next].priority>=last.priority)break;this.data[i]=this.data[next];i=next;}this.data[i]=last;}return first;}
}

export interface Reachable {cells:Map<string,{cell:Cell;cost:number;previous:string|null}>;limited:boolean}
export function reachable(map:GameMap,token:Token,characters:Character[],tokens:Token[],budget:number,options:MovementOptions,maxCells=20000):Reachable{
 if(!Number.isFinite(budget)||budget<0)throw new Error('Бюджет должен быть конечным неотрицательным числом');
 const character=characters.find(c=>c.id===token.characterId);if(!character)throw new Error('Персонаж не найден');
 const cells:Reachable['cells']=new Map([[key(token),{cell:{column:token.column,row:token.row},cost:0,previous:null}]]),heap=new Heap();heap.push({cell:token,cost:0});
 const quantum=map.grid.navigationStep??1,goal=options.target,heuristic=(cell:Cell)=>goal?(options.mode==='meters'?Math.hypot(goal.column-cell.column,goal.row-cell.row)*map.grid.metersPerCell:Math.max(Math.abs(goal.column-cell.column),Math.abs(goal.row-cell.row))):0;
 const directions=[[1,0],[-1,0],[0,1],[0,-1],...(options.diagonal?[[1,1],[1,-1],[-1,1],[-1,-1]]:[])].map(([x,y])=>[x*quantum,y*quantum]);let limited=false;
 const terrainCache=new Map<string,ReturnType<typeof terrainAt>>();const sample=(cell:Cell)=>{const id=key(cell),cached=terrainCache.get(id);if(cached)return cached;const value=terrainAt(map,cell,tokenSize(character,token));terrainCache.set(id,value);return value;};
 while(heap.data.length){const current=heap.pop();if(current.cost>cells.get(key(current.cell))!.cost+1e-9)continue;if(goal&&key(current.cell)===key(goal))break;
  const moves=[...directions];if(goal){const dx=goal.column-current.cell.column,dy=goal.row-current.cell.row;if(Math.abs(dx)<=quantum+1e-7&&Math.abs(dy)<=quantum+1e-7){if(dx)moves.push([dx,0]);if(dy)moves.push([0,dy]);if(options.diagonal)moves.push([dx,dy]);}}
  for(const [dx,dy] of moves){if(Math.hypot(dx,dy)<1e-7)continue;const cell={column:rounded(current.cell.column+dx),row:rounded(current.cell.row+dy)};const terrain=options.terrain,fromTerrain=terrain?sample(current.cell):null,toTerrain=terrain?sample(cell):null;const horizontal=options.mode==='cells'?Math.max(Math.abs(dx),Math.abs(dy)):Math.hypot(dx,dy)*map.grid.metersPerCell,height=terrain?Math.abs(toTerrain!.height-fromTerrain!.height):0,travel=toTerrain?.travel??fromTerrain?.travel;const step=options.prison?(travel==='stairs'?Math.hypot(horizontal,height):horizontal+height*(travel==='ladder'?1:2))*(toTerrain?.rough||toTerrain?.liquid?2:1):horizontal*(toTerrain?.liquid?terrain!.liquidMultiplier:1)+(terrain?Math.max(0,toTerrain!.height-fromTerrain!.height)*terrain.climbCost:0);const cost=current.cost+step;if(options.prison&&height>.5&&(options.freeHands??2)<(travel==='stairs'?0:travel==='ladder'?1:2))continue;if(cost>budget+1e-9)continue;const old=cells.get(key(cell));if(old&&old.cost<=cost+1e-9)continue;if(!stepAllowed(map,current.cell,cell,character,token,tokens,characters,options.prison))continue;if(!old&&cells.size>=maxCells){limited=true;continue;}cells.set(key(cell),{cell,cost,previous:key(current.cell)});heap.push({cell,cost,priority:cost+heuristic(cell)});}
 }
 return {cells,limited};
}
export function route(result:Reachable,to:Cell):Cell[]{let entry=result.cells.get(key(to));if(!entry)return [];const path:Cell[]=[];while(entry){path.push(entry.cell);entry=entry.previous?result.cells.get(entry.previous):undefined;}return path.reverse();}

export function polygonsOverlap(a:Point[],b:Point[]):boolean {for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=q.y-p.y,ny=p.x-q.x,pa=a.map(t=>t.x*nx+t.y*ny),pb=b.map(t=>t.x*nx+t.y*ny);if(Math.max(...pa)<=Math.min(...pb)+1e-7||Math.max(...pb)<=Math.min(...pa)+1e-7)return false;}return true;}
