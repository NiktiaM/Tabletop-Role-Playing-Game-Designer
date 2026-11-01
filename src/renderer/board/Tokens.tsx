import React, { useState } from 'react';
import type { Character, Token, GameMap, Camera } from '../../shared/campaign.js';
import { cellOrigin, imageToScreen, imageToCell, screenToImage } from '../../domain/grid.js';
export function Tokens({tokens,characters,map,camera,disabled,onMove,onRemove}: {tokens:Token[];characters:Character[];map:GameMap;camera:Camera;disabled:boolean;onMove:(id:string,column:number,row:number)=>void;onRemove:(id:string)=>void}) {
 const [selected,setSelected]=useState<string|null>(null);
 const [drag,setDrag]=useState<{id:string;x:number;y:number;dx:number;dy:number}|null>(null);
 return <>{tokens.filter(token=>token.mapId===map.id).map(token=>{
  const character=characters.find(c=>c.id===token.characterId);if(!character)return null;
  const origin=imageToScreen(cellOrigin(token.column,token.row,map.grid),camera), cellSize=map.grid.cellSizePx*camera.zoom;
  const width=character.footprint.width*cellSize,height=character.footprint.height*cellSize,size=Math.min(width,height);
  const dx=drag?.id===token.id?drag.dx:0,dy=drag?.id===token.id?drag.dy:0;
  return <div key={token.id} className={`token-footprint${selected===token.id?' selected-token':''}`} style={{left:origin.x+dx,top:origin.y+dy,width,height}}>
   <button type="button" className="token" disabled={disabled} aria-label={`Токен: ${character.name}`} title={`${character.name} · ${character.footprint.width}×${character.footprint.height}`} style={{width:size,height:size}} onPointerDown={event=>{
     event.stopPropagation();if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);setSelected(token.id);setDrag({id:token.id,x:event.clientX,y:event.clientY,dx:0,dy:0});
   }} onPointerMove={event=>{event.stopPropagation();if(drag?.id===token.id)setDrag({...drag,dx:event.clientX-drag.x,dy:event.clientY-drag.y});}} onPointerUp={event=>{
     event.stopPropagation();if(drag?.id!==token.id)return;
     const point=screenToImage({x:origin.x+event.clientX-drag.x+cellSize/2,y:origin.y+event.clientY-drag.y+cellSize/2},camera);
     const cell=imageToCell(point,map.grid);onMove(token.id,cell.column,cell.row);setDrag(null);
   }} onPointerCancel={()=>setDrag(null)} onLostPointerCapture={()=>setDrag(null)} onKeyDown={event=>{
     if(disabled)return;
     const step:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
     if(step[event.key]){event.preventDefault();onMove(token.id,token.column+step[event.key][0],token.row+step[event.key][1]);}
     if(event.key==='Delete'){event.preventDefault();onRemove(token.id);}
   }} onFocus={()=>setSelected(token.id)}>
    {character.portrait?<img src={character.portrait} alt="" draggable={false}/>:<span>{character.name.slice(0,1).toUpperCase()}</span>}
   </button>
  </div>;
 })}</>;
}
