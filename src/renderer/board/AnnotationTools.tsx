import React,{useEffect,useState} from 'react';
import {annotationSchema,annotationNames,type Annotation} from '../../shared/annotations.js';
import type {Point} from '../../domain/grid.js';
export type AnnotationTool='none'|'select'|Annotation['kind'];
export function AnnotationTools({items,tool,onTool,points,onClear,selected,onSelect,onChange,onDelete}: {
 items:Annotation[];tool:AnnotationTool;onTool:(tool:AnnotationTool)=>void;points:Point[];onClear:()=>void;selected:string|null;onSelect:(id:string|null)=>void;onChange:(item:Annotation)=>boolean;onDelete:(id:string)=>void;
}) {
 const existing=items.find(item=>item.id===selected);
 const [name,setName]=useState(''),[destructible,setDestructible]=useState(false),[hp,setHp]=useState('10'),[level,setLevel]=useState('light'),[height,setHeight]=useState('1'),[liquid,setLiquid]=useState('water'),[error,setError]=useState('');
 useEffect(()=>{
  setError('');setName(existing?.name??'');
  if(existing?.kind==='wall'){setDestructible(existing.destructible);setHp(String(existing.hp));}
  if(existing?.kind==='cover')setLevel(existing.level);
  if(existing?.kind==='elevation')setHeight(String(existing.heightMeters));
  if(existing?.kind==='liquid')setLiquid(existing.liquidType);
 },[existing]);
 const kind=existing?.kind??(tool==='none'||tool==='select'?null:tool);
 function apply(){
  if(!kind)return;
  const base=existing??{id:crypto.randomUUID(),kind,name:'',visible:true,...(kind==='light'?{center:points[0],radius:points.length===2?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0}:{from:points[0],to:points[1]})};
  const geometry=points.length===2?(kind==='light'?{center:points[0],radius:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)}:{from:points[0],to:points[1]}):{};
  const data={...base,...geometry,name:name.trim()||annotationNames[kind],...(kind==='wall'?{destructible,hp:Number(hp)}:kind==='cover'?{level}:kind==='elevation'?{heightMeters:Number(height)}:kind==='liquid'?{liquidType:liquid}:{})};
  const result=annotationSchema.safeParse(data);
  if(!result.success){setError('Проверьте параметры и размер разметки. Прочность — целое число 1–100000; высота — от −1000 до 1000 м; отрезок/область — не менее 1 пикселя.');return;}
  if(onChange(result.data)){setError('');onClear();if(!existing)setName('');}
  else setError('Не удалось применить: максимум 500 объектов на карте; координаты должны находиться внутри изображения.');
 }
 return <section className="annotation-tools"><h3>Разметка карты</h3>
 <label>Инструмент разметки<select value={tool} onChange={event=>{onTool(event.target.value as AnnotationTool);onSelect(null);onClear();setError('');setName('');}}>
 <option value="none">Камера и токены</option><option value="select">Выбрать разметку на карте</option>
 {Object.entries(annotationNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}
 </select></label>
 <p className="hint">Стена — два конца отрезка. Укрытие, высота, жидкость — два противоположных угла прямоугольника. Свет — центр и точка радиуса. Два щелчка, затем «Добавить разметку». Движение и бой пока не учитывают разметку.</p>
 {kind&&<div className="annotation-properties">
 <label>Название разметки<input maxLength={80} value={name} onChange={event=>setName(event.target.value)} /></label>
 {kind==='wall'&&<><label className="grid-toggle"><input type="checkbox" checked={destructible} onChange={event=>setDestructible(event.target.checked)}/>Разрушаемая стена</label>{destructible&&<label>Прочность стены<input type="number" min="1" max="100000" step="1" value={hp} onChange={event=>setHp(event.target.value)}/></label>}</>}
 {kind==='cover'&&<label>Степень укрытия<select value={level} onChange={event=>setLevel(event.target.value)}><option value="light">Лёгкое</option><option value="medium">Среднее</option><option value="nearFull">Почти полное</option></select></label>}
 {kind==='elevation'&&<label>Высота зоны, м<input type="number" min="-1000" max="1000" step="any" value={height} onChange={event=>setHeight(event.target.value)}/></label>}
 {kind==='liquid'&&<label>Тип жидкости<select value={liquid} onChange={event=>setLiquid(event.target.value)}><option value="water">Вода</option><option value="oil">Масло</option><option value="acid">Кислота</option><option value="lava">Лава</option><option value="other">Другое</option></select></label>}
 <button disabled={!existing&&points.length!==2} onClick={apply}>{existing?'Сохранить свойства':'Добавить разметку'}</button>
 {existing&&<button className="secondary" onClick={()=>{onTool(existing.kind);onClear();}}>Заменить геометрию двумя точками</button>}
 {existing&&<button className="secondary" onClick={()=>{onDelete(existing.id);onSelect(null);}}>Удалить выбранное</button>}
 </div>}
 <p className="hint annotation-coordinates">{points.length?`Точки: ${points.map(p=>`(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → ')}`:'Точки ещё не выбраны'}</p>
 <button className="secondary" disabled={!points.length} onClick={onClear}>Сбросить точки</button>
 {error&&<p role="alert">{error}</p>}
 <div className="annotation-list">{items.map(item=><div key={item.id}>
 <button className={selected===item.id?'':'secondary'} onClick={()=>{onTool('select');onSelect(item.id);onClear();}}>{item.name} · {annotationNames[item.kind]}</button>
 <button className="secondary" aria-label={`${item.visible?'Скрыть':'Показать'} разметку: ${item.name}`} onClick={()=>onChange({...item,visible:!item.visible})}>{item.visible?'Скрыть':'Показать'}</button>
 </div>)}</div>
 </section>;
}
