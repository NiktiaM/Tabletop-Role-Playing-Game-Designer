import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import { test, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readCampaign, writeCampaign } from '../src/main/storage.js';
test('партия восстанавливается и безопасно заменяется', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'rprison-'));
 try { const path = join(dir, 'партия.json'); const c = createCampaign('  Лейквью  ');
 await writeCampaign(path, c); expect({...await readCampaign(path),ruleset:c.ruleset}).toEqual(c);
 await writeCampaign(path, { ...c, name: 'Вторая история' }); expect((await readCampaign(path)).name).toBe('Вторая история');
 const before = await readFile(path, 'utf8'); await expect(writeCampaign(path, {...c, schemaVersion: 99})).rejects.toThrow(); expect(await readFile(path,'utf8')).toBe(before);
 await writeFile(path, '{broken'); await expect(readCampaign(path)).rejects.toThrow();
 await writeFile(path, JSON.stringify({...c, schemaVersion: 19})); await expect(readCampaign(path)).rejects.toThrow();
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('пустые и слишком длинные названия отклоняются', () => { expect(() => createCampaign('   ')).toThrow(); expect(() => createCampaign('а'.repeat(121))).toThrow(); });
test('v1 мигрирует без потери метаданных, карты и камеры v2 восстанавливаются', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'rprison-map-'));
 try {
  const path = join(dir,'world.json'); const c = createCampaign('Старый мир');
  const { maps, view, characters, tokens, ruleset, itemTemplates, items, abilityTemplates, abilities, session, encounter, diceRolls, gameplay, effects, pendingAttack, xpAwards, events, prison, otherEncounters, ...metadata } = c;
  await writeFile(path,JSON.stringify({...metadata,schemaVersion:1}));
  expect({...await readCampaign(path),ruleset:c.ruleset}).toEqual(c);
  const id = crypto.randomUUID();
  const map = {id,name:'Карта.png',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
  const withMap = {...c,maps:[map],view:{activeMapId:id,cameras:{[id]:{x:20,y:-30,zoom:0.75}}}};
  await writeCampaign(path,withMap); expect(await readCampaign(path)).toEqual({...withMap,maps:[{...map,annotations:[],grid:{metersPerCell:1,locationKind:'custom' as const,cellSizePx:64,originPx:{x:0,y:0},visible:false}}]});
  await expect(writeCampaign(path,{...withMap,maps:[map,map]})).rejects.toThrow();
  await expect(writeCampaign(path,{...withMap,view:{activeMapId:crypto.randomUUID(),cameras:{}}})).rejects.toThrow();
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('v2 открывается без изменения файла, v3 сохраняет индивидуальную калибровку', async () => {
 const dir=await mkdtemp(join(tmpdir(),'rprison-grid-'));
 try {
  const path=join(dir,'party.json'); const c=createCampaign('Сетка'); const id=crypto.randomUUID();
  const map={id,name:'Карта',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
  const old=JSON.stringify({...c,schemaVersion:2,maps:[map],view:{activeMapId:id,cameras:{[id]:{x:10,y:20,zoom:0.5}}}});
  await writeFile(path,old); const migrated=await readCampaign(path);
  expect(await readFile(path,'utf8')).toBe(old); expect(migrated.schemaVersion).toBe(18);
  expect(migrated.maps[0].grid).toEqual({metersPerCell:1,locationKind:'custom',cellSizePx:64,originPx:{x:0,y:0},visible:false});
  const secondId=crypto.randomUUID();
  const current={...migrated,maps:[{...migrated.maps[0],grid:{metersPerCell:1,locationKind:'custom' as const,cellSizePx:80.5,originPx:{x:17.25,y:-23.5},visible:true}},{...migrated.maps[0],id:secondId}]};
  await writeCampaign(path,current); expect(await readCampaign(path)).toEqual(current);
  const saved=await readFile(path,'utf8');
  await expect(writeCampaign(path,{...current,maps:[{...map,annotations:[],grid:{metersPerCell:1,locationKind:'custom' as const,cellSizePx:0,originPx:{x:0,y:0},visible:true}}]})).rejects.toThrow();
  expect(await readFile(path,'utf8')).toBe(saved);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('v3 получает начальный масштаб, v4 восстанавливает метры и тип локации', async () => {
 const dir=await mkdtemp(join(tmpdir(),'rprison-scale-'));
 try {
  const path=join(dir,'party.json');const c=createCampaign('Масштаб');const id=crypto.randomUUID();
  const map={id,name:'Лес',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',grid:{cellSizePx:80,originPx:{x:12,y:13},visible:true}};
  const old=JSON.stringify({...c,schemaVersion:3,maps:[map],view:{activeMapId:id,cameras:{}}});
  await writeFile(path,old);const migrated=await readCampaign(path);
  expect(await readFile(path,'utf8')).toBe(old);expect(migrated.maps[0].grid).toEqual({...map.grid,metersPerCell:1,locationKind:'custom'});
  const updated={...migrated,maps:[{...migrated.maps[0],grid:{...migrated.maps[0].grid,metersPerCell:5,locationKind:'forest'}}]};
  await writeCampaign(path,updated);expect(await readCampaign(path)).toEqual(updated);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('v4 получает пустой каталог; v5 сохраняет персонажа, портрет и несколько токенов',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rprison-tokens-'));
 try {
 const path=join(dir,'party.json');const c=createCampaign('Каталог');const {characters,tokens,...old}=c;
 await writeFile(path,JSON.stringify({...old,schemaVersion:4}));const migrated=await readCampaign(path);
 expect(migrated.characters).toEqual([]);expect(migrated.tokens).toEqual([]);
 const mapId=crypto.randomUUID(),id=crypto.randomUUID();
 const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const current={...migrated,maps:[{annotations:[],id:mapId,name:'Карта',width:500,height:500,image:portrait,grid:{cellSizePx:50,originPx:{x:0,y:0},visible:true,metersPerCell:1,locationKind:'custom'}}],characters:[{resources:{},values:{},id,name:'NPC',kind:'npc',footprint:{width:1,height:2},portrait}],tokens:[{id:crypto.randomUUID(),mapId,characterId:id,column:1,row:1},{id:crypto.randomUUID(),mapId,characterId:id,column:3,row:1}]};
 await writeCampaign(path,current);expect(await readCampaign(path)).toEqual(current);
 const before=await readFile(path,'utf8');await expect(writeCampaign(path,{...current,characters:[]})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe(before);
 } finally {await rm(dir,{recursive:true,force:true});}
});
