import React,{useEffect,useState} from 'react';
import type {Campaign,GameMap,Camera} from '../../shared/campaign.js';
import {cellOrigin,imageToScreen,imageToCell,screenToImage} from '../../domain/grid.js';

export function GroundItems({campaign,map,placing,onArm,onTake}:{campaign:Campaign;map:GameMap;placing:string|null;onArm:(id:string|null)=>void;onTake:(id:string,ownerId:string|null)=>void}){
 const [search,setSearch]=useState(''),[selected,setSelected]=useState(''),[owner,setOwner]=useState('');
 useEffect(()=>{if(owner&&!campaign.characters.some(character=>character.id===owner))setOwner('');},[owner,campaign.characters]);
 const available=campaign.items.filter(item=>!item.ground&&`${item.template.name} ${item.template.description}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));
 const onMap=campaign.items.filter(item=>item.ground?.mapId===map.id);
 return <section className="ground-items" aria-label="Предметы на поле"><h3>Предметы на поле</h3>
 <p className="hint">Размещаются существующие вещи из запаса или инвентаря. Создайте экземпляр во вкладке «Предметы», если список пуст. Действия мастера не расходуют ОД; предметы не мешают движению, несколько вещей могут лежать в одной клетке.</p>
 <div className="grid-fields"><label>Поиск вещи для поля<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>
 <label>Вещь для размещения<select aria-label="Вещь для размещения" value={available.some(item=>item.id===selected)?selected:''} onChange={event=>setSelected(event.target.value)}><option value="">Выберите экземпляр</option>{available.map(item=><option key={item.id} value={item.id}>{item.template.name} · {campaign.characters.find(character=>character.id===item.ownerId)?.name??'Общий запас'} · {item.id.slice(0,8)}</option>)}</select></label></div>
 <button disabled={!available.some(item=>item.id===selected)} onClick={()=>onArm(selected)}>Разместить предмет на поле</button>
 {placing&&<p role="status">Размещение предмета: {campaign.items.find(item=>item.id===placing)?.template.name}. Щёлкните клетку поля. <button onClick={()=>onArm(null)}>Отменить размещение предмета</button></p>}
 <label>Получатель предмета с поля<select aria-label="Получатель предмета с поля" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">Общий запас</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="inventory-cards">{onMap.map(item=><article key={item.id} data-ground-item={item.id}>{item.template.image&&<img className="item-photo" src={item.template.image} alt=""/>}<strong>{item.template.name}</strong><span>Клетка {item.ground!.column}, {item.ground!.row} · {item.id.slice(0,8)}</span><span>Прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}</span><button onClick={()=>onArm(item.id)}>Переместить на поле: {item.template.name}</button><button onClick={()=>onTake(item.id,owner||null)}>Передать с поля: {item.template.name}</button></article>)}</div>{!onMap.length&&<p>На этом поле нет предметов.</p>}
 </section>;
}

export function GroundMarkers({campaign,map,camera,disabled,onMove,onTake}:{campaign:Campaign;map:GameMap;camera:Camera;disabled:boolean;onMove:(id:string,column:number,row:number)=>void;onTake:(id:string,ownerId:string|null)=>void}){
 const [drag,setDrag]=useState<{id:string;x:number;y:number;dx:number;dy:number}|null>(null);
 return <>{campaign.items.filter(item=>item.ground?.mapId===map.id).map(item=>{
 const ground=item.ground!,origin=imageToScreen(cellOrigin(ground.column,ground.row,map.grid),camera),cell=map.grid.cellSizePx*camera.zoom,size=Math.max(18,Math.min(48,cell*0.65));
 const x=origin.x+cell/2,y=origin.y+cell/2;
 return <button key={item.id} className="ground-marker" disabled={disabled} aria-label={`Предмет на поле: ${item.template.name}`} title={`${item.template.name} · ${item.id.slice(0,8)} · перетащите или используйте стрелки; Delete — в запас`} style={{left:x+(drag?.id===item.id?drag.dx:0),top:y+(drag?.id===item.id?drag.dy:0),width:size,height:size}}
 onPointerDown={event=>{event.stopPropagation();if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);setDrag({id:item.id,x:event.clientX,y:event.clientY,dx:0,dy:0});}}
 onPointerMove={event=>{event.stopPropagation();if(drag?.id===item.id)setDrag({...drag,dx:event.clientX-drag.x,dy:event.clientY-drag.y});}}
 onPointerUp={event=>{event.stopPropagation();if(drag?.id!==item.id)return;const cell=imageToCell(screenToImage({x:x+event.clientX-drag.x,y:y+event.clientY-drag.y},camera),map.grid);if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3)onMove(item.id,cell.column,cell.row);setDrag(null);}}
 onPointerCancel={()=>setDrag(null)} onLostPointerCapture={()=>setDrag(null)} onKeyDown={event=>{const steps:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(steps[event.key]){event.preventDefault();onMove(item.id,ground.column+steps[event.key][0],ground.row+steps[event.key][1]);}if(event.key==='Delete'){event.preventDefault();onTake(item.id,null);}}}>
 {item.template.image?<img src={item.template.image} alt="" draggable={false}/>:<span>▣</span>}
 </button>;
 })}</>;
}
