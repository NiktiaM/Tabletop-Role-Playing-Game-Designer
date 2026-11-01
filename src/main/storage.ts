import { open, rename, unlink, readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { campaignSchema, type Campaign } from '../shared/campaign.js';
export async function writeCampaign(path: string, input: unknown): Promise<Campaign> {
  const campaign = campaignSchema.parse(input);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(campaign, null, 2), 'utf8'); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
    return campaign;
  } finally { await unlink(temporary).catch(() => undefined); }
}
export async function readCampaign(path: string): Promise<Campaign> {
  if ((await stat(path)).size > 1024 * 1024) throw new Error('Файл партии слишком большой (предел 1 МБ для версии 0.1).');
  return campaignSchema.parse(JSON.parse(await readFile(path, 'utf8')) as unknown);
}
