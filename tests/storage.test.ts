import { test, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCampaign } from '../src/shared/campaign.js';
import { readCampaign, writeCampaign } from '../src/main/storage.js';
test('партия восстанавливается и безопасно заменяется', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'rprison-'));
 try { const path = join(dir, 'партия.json'); const c = createCampaign('  Лейквью  ');
 await writeCampaign(path, c); expect(await readCampaign(path)).toEqual(c);
 await writeCampaign(path, { ...c, name: 'Вторая история' }); expect((await readCampaign(path)).name).toBe('Вторая история');
 const before = await readFile(path, 'utf8'); await expect(writeCampaign(path, {...c, schemaVersion: 99})).rejects.toThrow(); expect(await readFile(path,'utf8')).toBe(before);
 await writeFile(path, '{broken'); await expect(readCampaign(path)).rejects.toThrow();
 await writeFile(path, JSON.stringify({...c, schemaVersion: 3})); await expect(readCampaign(path)).rejects.toThrow();
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('пустые и слишком длинные названия отклоняются', () => { expect(() => createCampaign('   ')).toThrow(); expect(() => createCampaign('а'.repeat(121))).toThrow(); });
test('v1 мигрирует без потери метаданных, карты и камеры v2 восстанавливаются', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'rprison-map-'));
 try {
  const path = join(dir,'world.json'); const c = createCampaign('Старый мир');
  const { maps, view, ...metadata } = c;
  await writeFile(path,JSON.stringify({...metadata,schemaVersion:1}));
  expect(await readCampaign(path)).toEqual(c);
  const id = crypto.randomUUID();
  const map = {id,name:'Карта.png',width:1,height:1,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
  const withMap = {...c,maps:[map],view:{activeMapId:id,cameras:{[id]:{x:20,y:-30,zoom:0.75}}}};
  await writeCampaign(path,withMap); expect(await readCampaign(path)).toEqual(withMap);
  await expect(writeCampaign(path,{...withMap,maps:[map,map]})).rejects.toThrow();
  await expect(writeCampaign(path,{...withMap,view:{activeMapId:crypto.randomUUID(),cameras:{}}})).rejects.toThrow();
 } finally {await rm(dir,{recursive:true,force:true});}
});
