import React from 'react';
import {annotationNames,type Annotation} from '../../shared/annotations.js';
import type {Camera} from '../../shared/campaign.js';
const colors={wall:'#ff7474',cover:'#79c5ff',elevation:'#cfa2ff',liquid:'#55d9bd',light:'#ffe681'};
export function Annotations({items,camera,width,height,selected,onSelect,selectMode}: {items:Annotation[];camera:Camera;width:number;height:number;selected:string|null;onSelect:(id:string)=>void;selectMode:boolean}) {
 return <svg className="annotations-overlay" aria-label="Разметка карты" width="100%" height="100%">
 <defs><clipPath id="annotation-map-clip"><rect width={width} height={height}/></clipPath></defs>
 <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`} clipPath="url(#annotation-map-clip)">
 {items.filter(item=>item.visible).map(item=>{
  const common={stroke:colors[item.kind],strokeWidth:selected===item.id?4:2,vectorEffect:'non-scaling-stroke' as const};
  const pick=(event:React.PointerEvent)=>{if(selectMode&&!event.altKey){event.stopPropagation();onSelect(item.id);}};
  return <g key={item.id} data-annotation={item.id} className={selectMode?'annotation-pick':''} onPointerDown={pick}>
   <title>{item.name} · {annotationNames[item.kind]}</title>
   {item.kind==='wall'?<><line x1={item.from.x} y1={item.from.y} x2={item.to.x} y2={item.to.y} {...common} strokeDasharray={item.destructible?'8 4':undefined}/>{selectMode&&<line x1={item.from.x} y1={item.from.y} x2={item.to.x} y2={item.to.y} stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke"/>}</>:
   item.kind==='light'?<circle cx={item.center.x} cy={item.center.y} r={item.radius} fill={colors.light} fillOpacity={0.2} {...common}/>:
   ('brush' in item&&item.brush)?<path d={item.brush.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')+(item.brush.points.length===1?` l0.001,0`:'')} fill="none" stroke={colors[item.kind]} strokeWidth={item.brush.radius*2} strokeLinecap="round" strokeLinejoin="round" opacity={.4}/>:<rect x={Math.min(item.from.x,item.to.x)} y={Math.min(item.from.y,item.to.y)} width={Math.abs(item.to.x-item.from.x)} height={Math.abs(item.to.y-item.from.y)} fill={colors[item.kind]} fillOpacity={0.22} {...common}/>}
  </g>;
 })}</g></svg>;
}
