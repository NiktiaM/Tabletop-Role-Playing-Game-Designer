import type {GameMap,Character,Token} from '../shared/campaign.js';
import {cellOrigin,type Point} from './grid.js';
import {footprintFits,footprintsOverlap,type Cell} from './tokens.js';
export interface MovementOptions {mode:'meters'|'cells';diagonal:boolean}
const key=(cell:Cell)=>`${cell.column},${cell.row}`;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points:Point[]):Point[]{
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
function corners(map:GameMap,cell:Cell,character:Character):Point[]{const p=cellOrigin(cell.column,cell.row,map.grid),w=character.footprint.width*map.grid.cellSizePx,h=character.footprint.height*map.grid.cellSizePx;return [p,{x:p.x+w,y:p.y},{x:p.x+w,y:p.y+h},{x:p.x,y:p.y+h}];}
export function positionFree(map:GameMap,cell:Cell,character:Character,token:Token,tokens:Token[],characters:Character[]):boolean{
 if(!footprintFits(map,cell,character.footprint))return false;
 return !tokens.some(other=>{if(other.id===token.id||other.mapId!==map.id)return false;const c=characters.find(c=>c.id===other.characterId);return !!c&&footprintsOverlap(cell,character.footprint,other,c.footprint);});
}
export function stepAllowed(map:GameMap,from:Cell,to:Cell,character:Character,token:Token,tokens:Token[],characters:Character[]):boolean{
 const dx=to.column-from.column,dy=to.row-from.row;if(Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy))return false;
 if(!positionFree(map,to,character,token,tokens,characters))return false;
 if(dx&&dy){const sideA={column:from.column+dx,row:from.row},sideB={column:from.column,row:from.row+dy};if(!positionFree(map,sideA,character,token,tokens,characters)||!positionFree(map,sideB,character,token,tokens,characters))return false;}
 const swept=hull([...corners(map,from,character),...corners(map,to,character)]);
 const left=Math.min(...swept.map(p=>p.x)),right=Math.max(...swept.map(p=>p.x)),top=Math.min(...swept.map(p=>p.y)),bottom=Math.max(...swept.map(p=>p.y));
 return !map.annotations.some(item=>item.kind==='wall'&&Math.max(item.from.x,item.to.x)>left&&Math.min(item.from.x,item.to.x)<right&&Math.max(item.from.y,item.to.y)>=top&&Math.min(item.from.y,item.to.y)<=bottom&&wallInsideHull(item.from,item.to,swept));
}
class Heap {
 data:{cell:Cell;cost:number}[]=[];
 push(value:{cell:Cell;cost:number}){this.data.push(value);let i=this.data.length-1;while(i>0){const p=Math.floor((i-1)/2);if(this.data[p].cost<=value.cost)break;this.data[i]=this.data[p];i=p;}this.data[i]=value;}
 pop(){const first=this.data[0],last=this.data.pop()!;if(this.data.length){let i=0;while(2*i+1<this.data.length){let next=2*i+1;if(next+1<this.data.length&&this.data[next+1].cost<this.data[next].cost)next++;if(this.data[next].cost>=last.cost)break;this.data[i]=this.data[next];i=next;}this.data[i]=last;}return first;}
}
export interface Reachable {cells:Map<string,{cell:Cell;cost:number;previous:string|null}>;limited:boolean}
export function reachable(map:GameMap,token:Token,characters:Character[],tokens:Token[],budget:number,options:MovementOptions,maxCells=20000):Reachable{
 if(!Number.isFinite(budget)||budget<0)throw new Error('Бюджет должен быть конечным неотрицательным числом');
 const character=characters.find(c=>c.id===token.characterId);if(!character)throw new Error('Персонаж не найден');
 const cells:Reachable['cells']=new Map([[key(token),{cell:{column:token.column,row:token.row},cost:0,previous:null}]]),heap=new Heap();heap.push({cell:token,cost:0});
 const directions=[[1,0],[-1,0],[0,1],[0,-1],...(options.diagonal?[[1,1],[1,-1],[-1,1],[-1,-1]]:[])];let limited=false;
 while(heap.data.length){const current=heap.pop();if(current.cost>cells.get(key(current.cell))!.cost+1e-9)continue;
  for(const [dx,dy] of directions){const cell={column:current.cell.column+dx,row:current.cell.row+dy};const cost=current.cost+(options.mode==='cells'?1:map.grid.metersPerCell*(dx&&dy?Math.SQRT2:1));if(cost>budget+1e-9)continue;const old=cells.get(key(cell));if(old&&old.cost<=cost+1e-9)continue;if(!stepAllowed(map,current.cell,cell,character,token,tokens,characters))continue;if(!old&&cells.size>=maxCells){limited=true;continue;}cells.set(key(cell),{cell,cost,previous:key(current.cell)});heap.push({cell,cost});}
 }
 return {cells,limited};
}
export function route(result:Reachable,to:Cell):Cell[]{let entry=result.cells.get(key(to));if(!entry)return [];const path:Cell[]=[];while(entry){path.push(entry.cell);entry=entry.previous?result.cells.get(entry.previous):undefined;}return path.reverse();}
