import { z } from 'zod';
export const campaignSchema = z.object({
  schemaVersion: z.literal(1), id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();
export type Campaign = z.infer<typeof campaignSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface CampaignAPI {
  create(name: string): Promise<Result<Campaign>>;
  save(campaign: Campaign): Promise<Result<{ campaign: Campaign; fileName: string } | null>>;
  open(): Promise<Result<{ campaign: Campaign; fileName: string } | null>>;
}
export function createCampaign(name: string): Campaign {
  const now = new Date().toISOString();
  return campaignSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now });
}
