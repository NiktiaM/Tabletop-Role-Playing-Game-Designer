import type {Point} from './grid.js';
export function distanceFromDescription(text:string):number {
 const matches=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(км|km|см|cm|метр(?:а|ов)?|метры|м|m|фут(?:а|ов)?|ft)(?![a-zа-я])/gi)];
 if(matches.length!==1)throw new Error('Укажите одно известное расстояние, например «длина коридора 12 м». Масштабу 1:100 нужны дополнительные данные.');
 const unit=matches[0][2].toLowerCase(),factor=['км','km'].includes(unit)?1000:['см','cm'].includes(unit)?.01:unit.startsWith('фут')||unit==='ft'?.3048:1,value=Number(matches[0][1].replace(',','.'))*factor;
 if(value<=0||value>2048)throw new Error('Длина должна быть от 0 до 2048 м');return value;
}
export function strokeBounds(points:Point[],radius:number,width:number,height:number){
 return {from:{x:Math.max(0,Math.min(...points.map(p=>p.x))-radius),y:Math.max(0,Math.min(...points.map(p=>p.y))-radius)},to:{x:Math.min(width,Math.max(...points.map(p=>p.x))+radius),y:Math.min(height,Math.max(...points.map(p=>p.y))+radius)}};
}
