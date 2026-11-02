import {diceRollSchema,type DiceRoll} from '../shared/dice.js';
export type RandomSource=()=>number;
const randomUint32:RandomSource=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export function rollDice(count:number,sides:number,modifier=0,label='Бросок',random:RandomSource=randomUint32):DiceRoll {
 if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(sides)||sides<2||sides>1000||!Number.isInteger(modifier)||Math.abs(modifier)>1000000)throw new Error('Нужно 1–100 кубиков, 2–1000 граней, целый модификатор ±1000000');
 const limit=Math.floor(4294967296/sides)*sides;
 const rolls=Array.from({length:count},()=>{for(let attempt=0;attempt<1000;attempt++){const value=random();if(!Number.isInteger(value)||value<0||value>=4294967296)throw new Error('Неверный источник случайности');if(value<limit)return value%sides+1;}throw new Error('Источник случайности не дал допустимое значение');});
 return diceRollSchema.parse({id:crypto.randomUUID(),at:new Date().toISOString(),label,count,sides,modifier,rolls,total:rolls.reduce((a,b)=>a+b,0)+modifier});
}
