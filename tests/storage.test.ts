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
 await writeFile(path, JSON.stringify({...c, schemaVersion: 2})); await expect(readCampaign(path)).rejects.toThrow();
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('пустые и слишком длинные названия отклоняются', () => { expect(() => createCampaign('   ')).toThrow(); expect(() => createCampaign('а'.repeat(121))).toThrow(); });
