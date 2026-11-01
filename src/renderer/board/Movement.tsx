import React,{useMemo} from 'react';
import type {Camera,Character,GameMap} from '../../shared/campaign.js';
import {cellOrigin,type Point} from '../../domain/grid.js';
import type {Cell} from '../../domain/tokens.js';
import type {Reachable} from '../../domain/movement.js';
export function MovementOverlay({result,path,map,camera,character}:{result:Reachable;path:Cell[];map:GameMap;camera:Camera;character:Character}){
 const size=map.grid.cellSizePx;
 const cells=useMemo(()=>[...result.cells.values()].map(({cell})=>{const p=cellOrigin(cell.column,cell.row,map.grid);return `M${p.x},${p.y}h${size}v${size}h${-size}Z`;}).join(''),[result,map.grid]);
 const center=(cell:Cell):Point=>{const p=cellOrigin(cell.column,cell.row,map.grid);return {x:p.x+character.footprint.width*size/2,y:p.y+character.footprint.height*size/2};};
 return <svg className="movement-overlay" width="100%" height="100%" aria-label="Доступная область движения"><g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
 <path d={cells} fill="#3eac81" fillOpacity="0.3"/>
 {path.length>1&&<polyline data-testid="movement-path" points={path.map(cell=>{const p=center(cell);return `${p.x},${p.y}`;}).join(' ')} fill="none" stroke="#ffe681" strokeWidth="3" vectorEffect="non-scaling-stroke"/>}
 </g></svg>;
}
