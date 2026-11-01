import {test,expect} from 'vitest';
import {createCampaign,defaultGrid,parseCampaign,type Character,type GameMap,type Token} from '../src/shared/campaign.js';
import {startGame,setTacticalMovement} from '../src/domain/session.js';
import {moveWithPath} from '../src/domain/movement-action.js';

const character:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{},resources:{ap_max:0}};
const map:GameMap={id:crypto.randomUUID(),name:'Поле',width:600,height:600,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
const token:Token={id:crypto.randomUUID(),mapId:map.id,characterId:character.id,column:1,row:1};
const fixture=()=>({...createCampaign('Подготовка'),maps:[map],characters:[character],tokens:[token]});

test('старт требует поле, выбирает его и сохраняет подготовленные данные и ресурсы',()=>{
 expect(()=>startGame(createCampaign('Пустая'))).toThrow('поле');
 const source=fixture(),before=structuredClone(source),started=startGame(source);
 expect(started.session).toEqual({started:true,tacticalMovement:false});
 expect(started.view.activeMapId).toBe(map.id);
 expect(started.characters).toEqual(before.characters);expect(started.tokens).toEqual(before.tokens);
 expect(source).toEqual(before);
 expect(()=>setTacticalMovement(source,true)).toThrow('Сначала');
 const tactical=setTacticalMovement(started,true);
 expect(startGame(tactical)).toEqual(tactical);
 expect(setTacticalMovement(tactical,false).characters).toEqual(before.characters);
});

test('свободная игра проверяет стены и путь даже при нуле ОД, не меняя ресурсы',()=>{
 const source=startGame(fixture()),before=structuredClone(source);
 const moved=moveWithPath(source,token.id,2,2,false);
 expect(moved.campaign.tokens[0]).toMatchObject({column:2,row:2});
 expect(moved.campaign.characters).toEqual(before.characters);expect(source).toEqual(before);
 expect(()=>moveWithPath(source,token.id,2,2,true)).toThrow('Нет допустимого пути');
 const wall={id:crypto.randomUUID(),kind:'wall' as const,name:'Стена',visible:false,destructible:false,hp:10,from:{x:200,y:0},to:{x:200,y:600}};
 expect(()=>moveWithPath({...source,maps:[{...map,annotations:[wall]}]},token.id,2,2,false)).toThrow('Нет допустимого пути');
});

test('v11 открывается в подготовке без сброса данных, актуальный формат сохраняет режим игры',()=>{
 const {session,...old}=fixture(),migrated=parseCampaign({...old,schemaVersion:11});
 expect(migrated.session).toEqual({started:false,tacticalMovement:false});
 expect(migrated.characters).toEqual(old.characters);expect(migrated.tokens).toEqual(old.tokens);
 const playing=setTacticalMovement(startGame(migrated),true);
 expect(parseCampaign(JSON.parse(JSON.stringify(playing)))).toEqual(playing);
 expect(()=>parseCampaign({...playing,session:{started:false,tacticalMovement:true}})).toThrow();
});
