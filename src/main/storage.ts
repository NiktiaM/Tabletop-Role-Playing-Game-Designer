import { open, rename, unlink, readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseCampaign, type Campaign } from '../shared/campaign.js';
export async function writeCampaign(path: string, input: unknown): Promise<Campaign> {
  const campaign = parseCampaign(input);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const serialized = JSON.stringify(campaign, null, 2);
    if (Buffer.byteLength(serialized) > 100 * 1024 * 1024) throw new Error('Партия превышает 100 МБ.');
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(serialized, 'utf8'); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
    return campaign;
  } finally { await unlink(temporary).catch(() => undefined); }
}
export async function readCampaign(path: string): Promise<Campaign> {
  if ((await stat(path)).size > 100 * 1024 * 1024) throw new Error('Файл партии слишком большой (предел 100 МБ).');
  return parseCampaign(JSON.parse(await readFile(path, 'utf8')) as unknown);
}
