import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {contentSchema} from '../src/shared/content.js';
import {parseCampaign} from '../src/shared/campaign.js';
import {mergeContent} from '../src/domain/content.js';
import {giveInventory} from '../src/domain/inventory.js';
const pack={format:'rprison-content',version:1,characters:[{name:'NPC',kind:'npc',footprint:{width:1,height:1},portrait:null,values:{strength:8}}],items:[{name:'Меч',category:'weapon',description:'',damageDice:'1d6',maxDurability:100,maxCharges:3,image:null}]};
test('поставляемый пример валиден и импорт не заменяет существующие данные',async()=>{
 const example=contentSchema.parse(JSON.parse(await readFile(new URL('../examples/content-template.json',import.meta.url),'utf8')));
 const c=createCampaign('Импорт');const next=mergeContent(c,example);
 expect(next.characters.length).toBe(2);expect(next.itemTemplates.length).toBe(2);expect(c.characters).toEqual([]);expect(next.ruleset).toEqual(c.ruleset);
 const again=mergeContent(next,example);expect(again.characters.length).toBe(4);expect(new Set(again.characters.map(character=>character.id)).size).toBe(4);
});
test('ошибочный импорт и несовместимые ключи отклоняются целиком',()=>{
 expect(contentSchema.safeParse({...pack,version:2}).success).toBe(false);expect(contentSchema.safeParse({...pack,items:[{...pack.items[0],maxDurability:-1}]}).success).toBe(false);
 const parsed=contentSchema.parse(pack),c=createCampaign('Проверка');
 expect(()=>mergeContent(c,{...parsed,characters:[{...parsed.characters[0],values:{missing:5}}]})).toThrow('missing');expect(c.itemTemplates).toEqual([]);
});
test('выдача из шаблона копирует фото, передача экземпляра сохраняет ресурсы',()=>{
 const c=mergeContent(createCampaign('Инвентари'),contentSchema.parse(pack));const owner=c.characters[0].id;
 c.itemTemplates[0].image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const items=giveInventory(c,{kind:'template',id:c.itemTemplates[0].id},null);expect(items[0].template.image).toBe(c.itemTemplates[0].image);
 const party={...c,items:[{...items[0],durability:20,charges:1}]};const transferred=giveInventory(party,{kind:'instance',id:items[0].id},owner);
 expect(transferred.length).toBe(1);expect(transferred[0].ownerId).toBe(owner);expect(transferred[0].durability).toBe(20);expect(transferred[0].charges).toBe(1);expect(transferred[0].equipped).toBe(false);
 expect(()=>giveInventory(party,{kind:'template',id:crypto.randomUUID()},owner)).toThrow();expect(()=>giveInventory(party,{kind:'instance',id:items[0].id},crypto.randomUUID())).toThrow();
 expect(parseCampaign(JSON.parse(JSON.stringify({...party,items:transferred}))).items[0].template.image).toBe(c.itemTemplates[0].image);
});
test('v8 получает nullable-фотографии без потери инвентаря',()=>{
 const c=mergeContent(createCampaign('Старый файл'),contentSchema.parse(pack));const {image,...oldTemplate}=c.itemTemplates[0];
 const migrated=parseCampaign({...c,schemaVersion:8,itemTemplates:[oldTemplate]});expect(migrated.itemTemplates[0].image).toBe(null);expect(migrated.characters).toEqual(c.characters);
});
