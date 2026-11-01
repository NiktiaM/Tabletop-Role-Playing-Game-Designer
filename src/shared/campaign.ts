import { z } from 'zod';
import {abilitySchema,assignedAbilitySchema} from './abilities.js';
import type {CharacterBundle} from './transfer.js';
import {portraitSchema} from './images.js';
export {portraitSchema} from './images.js';
import type {ContentPack} from './content.js';
import {itemTemplateSchema,itemInstanceSchema} from './items.js';
import {rPrisonDraft} from '../domain/presets/rprison.js';
import {rulesetSchema,emptyRuleset,statKey} from './rules.js';
import { annotationSchema } from './annotations.js';
import { footprintFits, footprintsOverlap } from '../domain/tokens.js';
const metadata = {
  id: z.uuid(), name: z.string().trim().min(1).max(120),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
};
export const cameraSchema = z.object({ x: z.number().finite().min(-1e7).max(1e7), y: z.number().finite().min(-1e7).max(1e7), zoom: z.number().min(0.02).max(8) }).strict();
export const gridSchema = z.object({
  metersPerCell: z.number().finite().min(0.1).max(1000).default(1),
  locationKind: z.enum(['custom','house','forest']).default('custom'),
  cellSizePx: z.number().finite().min(4).max(4096),
  originPx: z.object({ x: z.number().finite().min(-8192).max(8192), y: z.number().finite().min(-8192).max(8192) }).strict(),
  visible: z.boolean(),
}).strict();
export const defaultGrid = () => ({ metersPerCell:1, locationKind:'custom' as const, cellSizePx: 64, originPx: { x: 0, y: 0 }, visible: false });
export type Grid = z.infer<typeof gridSchema>;
export const mapSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(120),
  width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192),
  grid: gridSchema.default(defaultGrid),
  annotations:z.array(annotationSchema).max(500).default([]),
  image: z.string().max(21 * 1024 * 1024).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
}).strict().refine(m => m.width * m.height <= 32_000_000, 'Карта должна содержать не более 32 млн пикселей').superRefine((map,ctx)=>{
 if(new Set(map.annotations.map(item=>item.id)).size!==map.annotations.length)ctx.addIssue({code:'custom',message:'Повторяющиеся объекты разметки'});
 for(const item of map.annotations){
  const points=item.kind==='light'?[item.center]:[item.from,item.to];
  if(points.some(p=>p.x>map.width||p.y>map.height))ctx.addIssue({code:'custom',message:'Разметка выходит за границы изображения'});
 }
});

export const characterSchema = z.object({
 values:z.record(statKey,z.number().finite().min(-1e9).max(1e9)).refine(values=>Object.keys(values).length<=256).default({}),
 id:z.uuid(), name:z.string().trim().min(1).max(120), kind:z.enum(['character','npc']),
 footprint:z.object({width:z.number().int().min(1).max(10),height:z.number().int().min(1).max(10)}).strict(),
 portrait:portraitSchema.nullable(),
}).strict();
export const tokenSchema = z.object({id:z.uuid(),mapId:z.uuid(),characterId:z.uuid(),column:z.number().int().min(-8192).max(8192),row:z.number().int().min(-8192).max(8192)}).strict();
export type Character = z.infer<typeof characterSchema>;
export type Token = z.infer<typeof tokenSchema>;
export const campaignSchema = z.object({
  ...metadata, schemaVersion: z.literal(10), abilityTemplates:z.array(abilitySchema).max(200).default([]), abilities:z.array(assignedAbilitySchema).max(1000).default([]), itemTemplates:z.array(itemTemplateSchema).max(200).default([]), items:z.array(itemInstanceSchema).max(1000).default([]), ruleset:rulesetSchema.default(emptyRuleset), characters:z.array(characterSchema).max(200).default([]), tokens:z.array(tokenSchema).max(500).default([]), maps: z.array(mapSchema).max(20),
  view: z.object({ activeMapId: z.uuid().nullable(), cameras: z.record(z.uuid(), cameraSchema) }).strict(),
}).strict().superRefine((c, ctx) => {
  const ids = new Set(c.maps.map(m => m.id));
  const characters=new Map(c.characters.map(character=>[character.id,character]));
  if(new Set(c.abilityTemplates.map(ability=>ability.id)).size!==c.abilityTemplates.length||new Set(c.abilities.map(ability=>ability.id)).size!==c.abilities.length)ctx.addIssue({code:'custom',message:'Повторяющиеся способности'});
  if(c.abilities.some(ability=>!characters.has(ability.ownerId)))ctx.addIssue({code:'custom',message:'Владелец способности не найден'});

  if(new Set(c.itemTemplates.map(item=>item.id)).size!==c.itemTemplates.length||new Set(c.items.map(item=>item.id)).size!==c.items.length)ctx.addIssue({code:'custom',message:'Повторяющиеся идентификаторы предметов'});
  if(c.items.some(item=>item.ownerId!==null&&!characters.has(item.ownerId)))ctx.addIssue({code:'custom',message:'Владелец предмета не найден'});

  if(characters.size!==c.characters.length || new Set(c.tokens.map(token=>token.id)).size!==c.tokens.length) ctx.addIssue({code:'custom',message:'Повторяющиеся идентификаторы персонажей или токенов'});
  for(let i=0;i<c.tokens.length;i++) {
    const token=c.tokens[i], map=c.maps.find(map=>map.id===token.mapId), character=characters.get(token.characterId);
    if(!map||!character||!footprintFits(map,token,character.footprint)) {ctx.addIssue({code:'custom',message:'Токен ссылается на отсутствующий объект или выходит за карту'});continue;}
    for(let j=0;j<i;j++) {
      const other=c.tokens[j], otherCharacter=characters.get(other.characterId);
      if(other.mapId===token.mapId && otherCharacter && footprintsOverlap(token,character.footprint,other,otherCharacter.footprint)) ctx.addIssue({code:'custom',message:'Токены занимают одни и те же клетки'});
    }
  }

  if (ids.size !== c.maps.length || (c.view.activeMapId !== null && !ids.has(c.view.activeMapId)) || Object.keys(c.view.cameras).some(id => !ids.has(id)))
    ctx.addIssue({ code: 'custom', message: 'Некорректные ссылки на карты' });
});
const legacySchema = z.object({ ...metadata, schemaVersion: z.literal(1) }).strict();
export function parseCampaign(input: unknown): Campaign {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion === 1) {
    return campaignSchema.parse({ ...legacySchema.parse(input), schemaVersion: 10, maps: [], view: { activeMapId: null, cameras: {} } });
  }
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && (input.schemaVersion === 2 || input.schemaVersion === 3 || input.schemaVersion === 4 || input.schemaVersion === 5 || input.schemaVersion === 6 || input.schemaVersion === 7 || input.schemaVersion === 8 || input.schemaVersion === 9)) {
    return campaignSchema.parse({ ...input, schemaVersion: 10 });
  }
  return campaignSchema.parse(input);
}
export type Campaign = z.infer<typeof campaignSchema>;
export type GameMap = z.infer<typeof mapSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface CampaignAPI {
  create(name: string): Promise<Result<Campaign>>;
  save(campaign: Campaign): Promise<Result<{ campaign: Campaign; fileName: string } | null>>;
  open(): Promise<Result<{ campaign: Campaign; fileName: string } | null>>;
  exportCharacter(bundle:CharacterBundle):Promise<Result<string|null>>;
  importCharacter():Promise<Result<CharacterBundle|null>>;
  importContent(): Promise<Result<ContentPack | null>>;
  importPortrait(): Promise<Result<string | null>>;
  importMap(): Promise<Result<GameMap | null>>;
}
export function createCampaign(name: string): Campaign {
  const now = new Date().toISOString();
  return campaignSchema.parse({ schemaVersion: 10, ruleset:rPrisonDraft(), id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, maps: [], view: { activeMapId: null, cameras: {} } });
}
