import { cellOrigin } from './grid.js';
import type { Grid } from '../shared/campaign.js';
export interface Footprint { width: number; height: number }
export interface Cell { column: number; row: number }
export function footprintFits(map: {width:number;height:number;grid:Grid}, cell: Cell, footprint: Footprint): boolean {
  const p=cellOrigin(cell.column,cell.row,map.grid), size=map.grid.cellSizePx;
  return p.x>=-1e-7 && p.y>=-1e-7 && p.x+footprint.width*size<=map.width+1e-7 && p.y+footprint.height*size<=map.height+1e-7;
}
export function footprintsOverlap(a: Cell, aSize: Footprint, b: Cell, bSize: Footprint): boolean {
 return a.column < b.column+bSize.width && a.column+aSize.width>b.column && a.row<b.row+bSize.height && a.row+aSize.height>b.row;
}
export function tokenSize(character:{footprint:Footprint},token:{rotation?:0|90}):Footprint {return token.rotation===90?{width:character.footprint.height,height:character.footprint.width}:character.footprint;}
