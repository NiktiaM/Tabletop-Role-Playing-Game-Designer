import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {test,expect} from 'vitest';
import {defaultGrid,type GameMap,type Character,type Token} from '../src/shared/campaign.js';
import {reachable,route,stepAllowed} from '../src/domain/movement.js';
import {moveWithPath,movementBudget} from '../src/domain/movement-action.js';
const character:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{},resources:{}};
const map:GameMap={id:crypto.randomUUID(),name:'Карта',width:600,height:600,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
const token:Token={id:crypto.randomUUID(),mapId:map.id,characterId:character.id,column:1,row:1};
const settings={mode:'meters' as const,diagonal:true};
test('стоимость учитывает метры и диагональ, путь восстанавливается',()=>{
 const result=reachable(map,token,[character],[token],2,settings);
 expect(result.cells.get('2,2')?.cost).toBeCloseTo(Math.SQRT2);expect(route(result,{column:2,row:2})).toHaveLength(2);
 expect(result.cells.has('3,3')).toBe(false);
 const larger={...map,grid:{...map.grid,metersPerCell:5}};
 expect(reachable(larger,token,[character],[token],4,settings).cells.size).toBe(1);
 expect(reachable(larger,token,[character],[token],5,settings).cells.get('2,1')?.cost).toBe(5);
});
test('стены блокируют весь swept footprint, скрытые тоже, касание края допустимо',()=>{
 const wall={id:crypto.randomUUID(),kind:'wall' as const,name:'Стена',visible:false,destructible:false,hp:10,from:{x:200,y:0},to:{x:200,y:600}};
 const blocked={...map,annotations:[wall]};
 expect(stepAllowed(blocked,token,{column:2,row:1},character,token,[token],[character])).toBe(false);
 expect(stepAllowed(blocked,token,{column:1,row:2},character,token,[token],[character])).toBe(true);
 expect(reachable(blocked,token,[character],[token],20,settings).cells.has('2,1')).toBe(false);
 const partial={...map,annotations:[{...wall,from:{x:200,y:100},to:{x:200,y:200}}]};
 const found=reachable(partial,token,[character],[token],10,settings);expect(route(found,{column:2,row:1}).length).toBeGreaterThan(2);
});
test('крупный токен и диагонали не проходят через занятость и углы',()=>{
 const other={...token,id:crypto.randomUUID(),column:2,row:1};
 expect(stepAllowed(map,token,{column:2,row:2},character,token,[token,other],[character])).toBe(false);
 const large={...character,footprint:{width:2,height:2}},start={...token,column:3,row:3};
 expect(reachable(map,start,[large],[start],10,settings).cells.has('5,3')).toBe(false);
 const wall={id:crypto.randomUUID(),kind:'wall' as const,name:'Стена',visible:true,destructible:true,hp:10,from:{x:150,y:150},to:{x:180,y:180}};
 expect(stepAllowed({...map,annotations:[wall]},token,{column:2,row:1},large,token,[token],[large])).toBe(false);
});
test('движение списывает общий бюджет персонажа, отказ не меняет исходник',()=>{
 const c={...createCampaign('Партия'),characters:[character],maps:[map],tokens:[token,{...token,id:crypto.randomUUID(),column:4,row:4}]};
 const before=structuredClone(c),moved=moveWithPath(c,token.id,2,2);
 expect(moved.cost).toBeCloseTo(Math.SQRT2);expect(movementBudget(moved.campaign,moved.campaign.characters[0]).remaining).toBeCloseTo(7-Math.SQRT2);expect(c).toEqual(before);
 expect(()=>moveWithPath({...c,characters:[{...character,resources:{ap_max:0}}]},token.id,2,2)).toThrow('Нет');
 expect(reachable(map,token,[character],[token],100,settings,5).limited).toBe(true);
});
test('старая партия R Prison получает источник ОД без изменения остальных правил',async()=>{
 const {parseCampaign}=await import('../src/shared/campaign.js');const c=createCampaign('Старая партия');const {movement,...oldRules}=c.ruleset;
 const migrated=parseCampaign({...c,schemaVersion:10,ruleset:oldRules});expect(migrated.ruleset.movement.budgetStat).toBe('ap_max');expect(migrated.ruleset.stats).toEqual(c.ruleset.stats);expect(migrated.characters).toEqual(c.characters);
});
