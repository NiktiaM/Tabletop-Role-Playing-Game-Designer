import {tokenSize} from '../../domain/tokens.js';
import React, { useState,useEffect } from 'react';
import type { Character, Token, GameMap, Camera } from '../../shared/campaign.js';
import { cellOrigin, imageToScreen, imageToCell, screenToImage } from '../../domain/grid.js';
export function Tokens({tokens,characters,map,camera,disabled,onMove,onRemove,onSelect,selectedId,onPreview,activeCharacterId,onRotate}: {onRotate?:(id:string)=>void;activeCharacterId:string|null;tokens:Token[];characters:Character[];map:GameMap;camera:Camera;disabled:boolean;onMove:(id:string,column:number,row:number)=>void;onRemove:(id:string)=>void;onSelect:(id:string)=>void;selectedId:string|null;onPreview:(column:number,row:number)=>void}) {
 const [drag,setDrag]=useState<{id:string;x:number;y:number;dx:number;dy:number}|null>(null);
 useEffect(()=>{const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape')setDrag(null);};document.addEventListener('keydown',cancel);return()=>document.removeEventListener('keydown',cancel);},[]);
 return <>{tokens.filter(token=>token.mapId===map.id).map(token=>{
  const character=characters.find(c=>c.id===token.characterId);if(!character)return null;
  const origin=imageToScreen(cellOrigin(token.column,token.row,map.grid),camera), cellSize=map.grid.cellSizePx*camera.zoom;
  const footprint=tokenSize(character,token),width=footprint.width*cellSize,height=footprint.height*cellSize,size=Math.min(width,height);
  const dx=drag?.id===token.id?drag.dx:0,dy=drag?.id===token.id?drag.dy:0;
  return <div key={token.id} className={`token-footprint${selectedId===token.id?' selected-token':''}`} style={{left:origin.x+dx,top:origin.y+dy,width,height}}>
   <button type="button" className={`token${activeCharacterId===character.id?' actor-token':''}`} disabled={disabled} aria-label={`Токен: ${character.name}`} title={`${character.name} · ${character.footprint.width}×${character.footprint.height}`} style={{width:size,height:size}} onPointerDown={event=>{
     if(event.button!==0)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);onSelect(token.id);setDrag({id:token.id,x:event.clientX,y:event.clientY,dx:0,dy:0});
   }} onPointerMove={event=>{event.stopPropagation();if(drag?.id===token.id){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;setDrag({...drag,dx,dy});const p=screenToImage({x:origin.x+dx,y:origin.y+dy},camera),r=map.grid.regions?.find(r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height),half=(r?.cellSizePx??map.grid.cellSizePx)/2;const cell=imageToCell({x:p.x+half,y:p.y+half},map.grid);onPreview(cell.column,cell.row);}}} onPointerUp={event=>{
     event.stopPropagation();if(drag?.id!==token.id)return;
     if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3){setDrag(null);return;}
     const point=screenToImage({x:origin.x+event.clientX-drag.x,y:origin.y+event.clientY-drag.y},camera),r=map.grid.regions?.find(r=>point.x>=r.x&&point.y>=r.y&&point.x<r.x+r.width&&point.y<r.y+r.height),half=(r?.cellSizePx??map.grid.cellSizePx)/2;
     const cell=imageToCell({x:point.x+half,y:point.y+half},map.grid);onMove(token.id,cell.column,cell.row);setDrag(null);
   }} onPointerCancel={()=>setDrag(null)} onLostPointerCapture={()=>setDrag(null)} onKeyDown={event=>{
     if(disabled)return;
     const step:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
     if(step[event.key]){event.preventDefault();const p=cellOrigin(token.column,token.row,map.grid),region=(q:{x:number;y:number})=>map.grid.regions?.find(r=>q.x>=r.x&&q.y>=r.y&&q.x<r.x+r.width&&q.y<r.y+r.height),r=region({x:p.x+.001,y:p.y+.001}),size=r?.cellSizePx??map.grid.cellSizePx,q={x:p.x+step[event.key][0]*size,y:p.y+step[event.key][1]*size},next=region({x:q.x+.001,y:q.y+.001}),cell=r?.mapId!==next?.mapId?{column:Math.round((q.x-map.grid.originPx.x)/map.grid.cellSizePx*1e6)/1e6,row:Math.round((q.y-map.grid.originPx.y)/map.grid.cellSizePx*1e6)/1e6}:imageToCell({x:q.x+.001,y:q.y+.001},map.grid);onMove(token.id,cell.column,cell.row);}
     if(event.key==='r'||event.key==='R'||event.key==='к'||event.key==='К'){event.preventDefault();onRotate?.(token.id);}
     if(event.key==='Delete'){event.preventDefault();onRemove(token.id);}
   }} onFocus={()=>{onSelect(token.id);}}>
    {character.portrait?<img src={character.portrait} alt="" draggable={false}/>:<span>{character.name.slice(0,1).toUpperCase()}</span>}
   </button>
  </div>;
 })}</>;
}
