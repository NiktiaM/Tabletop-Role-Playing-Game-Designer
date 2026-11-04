import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {test,expect} from 'vitest';
import {campaignSchema,defaultGrid,parseCampaign,type Character,type GameMap} from '../src/shared/campaign.js';
import {createItem} from '../src/domain/items.js';
import {placeItem,takeItem} from '../src/domain/ground-items.js';
import {giveInventory} from '../src/domain/inventory.js';
import {exportCharacter} from '../src/domain/transfer.js';

const character:Character={id:crypto.randomUUID(),name:'Герой',kind:'character',portrait:null,footprint:{width:1,height:1},values:{},resources:{ap_max:3}};
const map:GameMap={id:crypto.randomUUID(),name:'Дом',width:600,height:600,image:'data:image/png;base64,AAAA',grid:{...defaultGrid(),cellSizePx:100},annotations:[]};
const template={id:crypto.randomUUID(),revision:1,name:'Фонарь',category:'other' as const,description:'Свет',damageDice:null,maxDurability:20,maxCharges:5,image:'data:image/png;base64,AAAA'};
const fixture=()=>({...createCampaign('Предметы на поле'),maps:[map],characters:[character],items:[{...createItem(template,character.id),durability:12,charges:2,equipped:true}]});

test('размещение сохраняет экземпляр, фото, ресурсы и снимок, снимает экипировку и владельца',()=>{
 const source=fixture(),before=structuredClone(source),id=source.items[0].id;
 const placed=placeItem(source,id,map.id,2,3);
 expect(source).toEqual(before);expect(placed.items).toHaveLength(1);
 expect(placed.items[0]).toEqual({...source.items[0],ownerId:null,equipped:false,ground:{mapId:map.id,column:2,row:3}});
 expect(placed.characters).toEqual(source.characters);
 const moved=placeItem(placed,id,map.id,4,4);expect(moved.items[0].id).toBe(id);expect(moved.items[0].charges).toBe(2);
 expect(exportCharacter(placed,character.id).items).toHaveLength(0);
});

test('передача с поля и возврат в запас не копируют вещь, включая inventory с ownerId=null',()=>{
 const c=fixture(),id=c.items[0].id,placed=placeItem(c,id,map.id,2,2);
 const owned=takeItem(placed,id,character.id);
 expect(owned.items[0]).toEqual({...c.items[0],equipped:false,ground:null});
 expect(takeItem(placed,id,null).items[0]).toMatchObject({id,ownerId:null,ground:null,durability:12,charges:2});
 expect(giveInventory(placed,{kind:'instance',id},null)[0].ground).toBeNull();
 expect(()=>takeItem(placed,id,crypto.randomUUID())).toThrow('Персонаж');
});

test('ошибки размещения и неверные ссылки не меняют партию',()=>{
 const c=fixture(),before=structuredClone(c),id=c.items[0].id;
 for(const [column,row] of [[-1,0],[6,0],[0,6],[1.5,1],[NaN,1]])expect(()=>placeItem(c,id,map.id,column,row)).toThrow();
 expect(()=>placeItem(c,crypto.randomUUID(),map.id,1,1)).toThrow('Предмет');
 expect(()=>placeItem(c,id,crypto.randomUUID(),1,1)).toThrow();
 const ground={mapId:map.id,column:1,row:1};
 expect(campaignSchema.safeParse({...c,items:[{...c.items[0],ground}]}).success).toBe(false);
 const placed=placeItem(c,id,map.id,1,1);
 expect(campaignSchema.safeParse({...placed,maps:[]}).success).toBe(false);
 expect(c).toEqual(before);
});

test('предметы могут находиться под токенами и друг на друге, разные поля независимы',()=>{
 const c=fixture(),second={...map,id:crypto.randomUUID()},other=createItem(template,null);
 const source={...c,maps:[map,second],items:[...c.items,other],tokens:[{id:crypto.randomUUID(),characterId:character.id,mapId:map.id,column:1,row:1}]};
 const placed=placeItem(placeItem(source,c.items[0].id,map.id,1,1),other.id,map.id,1,1);
 expect(placed.items.filter(item=>item.ground?.mapId===map.id)).toHaveLength(2);
 const moved=placeItem(placed,other.id,second.id,2,2);
 expect(moved.items[0].ground?.mapId).toBe(map.id);expect(moved.tokens).toEqual(source.tokens);
 expect(parseCampaign(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
});

test('v12 получает пустое размещение без потери состояния сессии и инвентаря',()=>{
 const c=fixture(),{ground,...item}=c.items[0];
 const migrated=parseCampaign({...c,schemaVersion:12,session:{started:true,tacticalMovement:true},items:[item]});
 expect(migrated.items[0]).toEqual(c.items[0]);expect(migrated.session).toEqual({started:true,tacticalMovement:true});
 expect(migrated.schemaVersion).toBe(19);
});
