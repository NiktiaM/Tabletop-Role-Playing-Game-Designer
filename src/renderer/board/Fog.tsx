import React from 'react';
import type {Camera,GameMap} from '../../shared/campaign.js';
import type {Vision} from '../../domain/visibility.js';
export function Fog({vision:v,map,camera}:{vision:Vision;map:GameMap;camera:Camera}){
 const revealed=new Set([...v.explored,...v.visible]);
 const holes=(cells:Iterable<string>)=>[...cells].map(key=>{const [x,y]=key.split(',').map(Number);return `M${x*v.size},${y*v.size}h${v.size}v${v.size}h${-v.size}Z`;}).join('');
 return <svg className="fog-overlay" aria-label="Поле зрения персонажа" width="100%" height="100%"><g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}><path fill="#0d1513" fillRule="evenodd" d={`M0,0H${map.width}V${map.height}H0Z ${holes(revealed)}`}/><path fill="#07110e" fillOpacity=".7" fillRule="evenodd" d={`${holes(revealed)} ${holes(v.visible)}`}/></g></svg>;
}
