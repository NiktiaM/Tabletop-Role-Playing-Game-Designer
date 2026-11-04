import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {test,expect} from 'vitest';
import {rollDice} from '../src/domain/dice.js';
import {startAutomaticEncounter} from '../src/domain/initiative.js';
import {parseCampaign,type Character} from '../src/shared/campaign.js';
import {nextTurn} from '../src/domain/encounter.js';
import {diceRollSchema} from '../src/shared/dice.js';
import {annotationSchema} from '../src/shared/annotations.js';
import {distanceFromDescription,strokeBounds} from '../src/domain/map-tools.js';

test('кубики проверяют параметры, используют отбрасывание смещения и сохраняют каждый результат',()=>{
 let i=0;const r=rollDice(3,6,2,'Проверка',()=>[4294967295,0,5,2][i++]);expect(r.rolls).toEqual([1,6,3]);expect(r.total).toBe(12);
 for(const params of [[0,6],[101,6],[1,1],[1,1001],[1.5,6]])expect(()=>rollDice(params[0],params[1])).toThrow();
 expect(()=>rollDice(1,6,0,'Тест',()=>-1)).toThrow();expect(diceRollSchema.safeParse({...r,total:0}).success).toBe(false);
 for(const faces of [4,6,8,10,12,20,100])expect(rollDice(2,faces,0,'Кубики',()=>0).rolls).toEqual([1,1]);
});
test('инициатива D&D бросается один раз на персонажа и сохраняется без переброса по раундам/чтению',()=>{
 const c=createCampaign('Бой'),a:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{dexterity:14},resources:{hp_max:1,ap_max:0}},b={...a,id:crypto.randomUUID(),name:'NPC',kind:'npc' as const,values:{dexterity:5}};
 const source={...c,session:{started:true,tacticalMovement:false},characters:[a,b]},before=structuredClone(source);let i=0;
 const battle=startAutomaticEncounter(source,[a.id,b.id],'manual',()=>[9,19][i++]);
 expect(battle.encounter?.participants.map(p=>p.initiative)).toEqual([17,12]);expect(battle.encounter?.participants[0].characterId).toBe(b.id);expect(battle.diceRolls.map(r=>r.rolls[0])).toEqual([10,20]);
 expect(nextTurn(nextTurn(battle)).diceRolls).toEqual(battle.diceRolls);expect(parseCampaign(JSON.parse(JSON.stringify(battle)))).toEqual(battle);expect(source).toEqual(before);
 expect(()=>startAutomaticEncounter(source,[a.id,a.id],'turn')).toThrow();expect(()=>startAutomaticEncounter({...source,ruleset:{...c.ruleset,initiativeStat:null}},[a.id],'turn')).not.toThrow();
});
test('описание принимает одно расстояние с единицами, не выдумывает масштаб картинки',()=>{
 expect(distanceFromDescription('Коридор длиной 12,5 м')).toBe(12.5);expect(distanceFromDescription('Отрезок 250 см')).toBe(2.5);expect(distanceFromDescription('Улица 1 km')).toBe(1000);expect(distanceFromDescription('10 ft')).toBeCloseTo(3.048);
 for(const text of ['1:100','лес','Дом 10 м, улица 20 м','0 м'])expect(()=>distanceFromDescription(text)).toThrow();
});
test('штрих кисти ограничен картой, сохраняет форму и не ломает старые прямоугольники',()=>{
 const points=[{x:0,y:10},{x:70,y:40},{x:100,y:80}],bounds=strokeBounds(points,20,100,100),base={id:crypto.randomUUID(),name:'Высота',visible:true,kind:'elevation' as const,heightMeters:2,...bounds};
 expect(bounds).toEqual({from:{x:0,y:0},to:{x:100,y:100}});expect(annotationSchema.parse({...base,brush:{points,radius:20}}).kind).toBe('elevation');expect(annotationSchema.parse(base)).toEqual(base);
 expect(annotationSchema.safeParse({...base,brush:{points:[],radius:20}}).success).toBe(false);
});
